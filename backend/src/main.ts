import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { App, BundlingOptions, CfnOutput, DockerImage, Fn, ILocalBundling, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { AllowedMethods, CachePolicy, Distribution, OriginAccessIdentity, OriginProtocolPolicy, OriginRequestPolicy, PriceClass, SecurityPolicyProtocol, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Code, Function, FunctionUrlAuthType, Runtime } from 'aws-cdk-lib/aws-lambda';
import { BlockPublicAccess, Bucket, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import * as fs_extra from 'fs-extra';
import { PREAMBLE } from './preamble';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const frontend = new Bucket(this, 'frontend', {
      bucketName: 'dart-edge-lambda',
      removalPolicy: RemovalPolicy.DESTROY,
      enforceSSL: true,
      autoDeleteObjects: true,
      accessControl: BucketAccessControl.PRIVATE,
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    });

    const originAccessIdentity = new OriginAccessIdentity(this, 'OriginAccessIdentity', {
      comment: 'Access to the frontend bucket',
    });

    frontend.grantRead(originAccessIdentity);

    const renderer = new Function(this, 'Renderer', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: Code.fromAsset('../renderer', {
        bundling: {
          image: DockerImage.fromRegistry('dart:beta'),
          local: new LambdaBundler('main'),
        },
      }),
    });

    const rendererUrl = renderer.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      cors: {
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      },
    });

    const rendererEdge = new cloudfront.experimental.EdgeFunction(this, 'RendererEdge', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: Code.fromAsset('../renderer', {
        bundling: {
          image: DockerImage.fromRegistry('dart:beta'),
          local: new LambdaBundler('edge'),
        },
      }),
    });

    const distribution = new Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new S3Origin(frontend, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        'api/*': {
          origin: new origins.HttpOrigin(
            Fn.select(
              0, Fn.split('/', Fn.select(1, Fn.split('https://', rendererUrl.url))),
            ),
            {
              protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
            },
          ),
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        'edge/*': {
          origin: new origins.HttpOrigin(
            Fn.select(
              0, Fn.split('/', Fn.select(1, Fn.split('https://', rendererUrl.url))),
            ),
            {
              protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
            },
          ),
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          edgeLambdas: [
            {
              functionVersion: rendererEdge.currentVersion,
              eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
              includeBody: true,
            },
          ],
        },
      },
      defaultRootObject: 'index.html',
      priceClass: PriceClass.PRICE_CLASS_ALL,
      minimumProtocolVersion: SecurityPolicyProtocol.TLS_V1_2_2021,
      enableIpv6: true,
      enableLogging: true,
    });

    new BucketDeployment(this, 'DeployWithInvalidation', {
      sources: [
        Source.asset('../frontend', {
          bundling: {
            image: DockerImage.fromRegistry('node:18'),
            local: new FrontendBundler(),
          },
        }),
      ],
      destinationBucket: frontend,
      distribution: distribution,
      distributionPaths: ['/*'],
    });

    new CfnOutput(this, 'RendererUrl', {
      value: rendererUrl.url,
    });
    new CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
    });
    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    });
  }
}

class LambdaBundler implements ILocalBundling {
  constructor(private entrypoint: 'main' | 'edge') {}

  tryBundle(outputDir: string, _: BundlingOptions): boolean {
    console.log('Attempting to bundle the lambda locally');
    const lambdaDir = '../renderer';

    const bundleOutputDir = path.join(lambdaDir, 'dist');
    if (fs_extra.existsSync(bundleOutputDir)) {
      fs_extra.removeSync(bundleOutputDir);
    }
    fs_extra.mkdirSync(bundleOutputDir);

    // Bundle the lambda using dart
    const dartOut = spawnSync(
      'dart',
      ['compile', 'js', '--server-mode', '--output', 'dist/index.js', `lib/${this.entrypoint}.dart`],
      {
        cwd: lambdaDir,
        stdio: 'inherit',
      },
    );
    if (dartOut.status !== 0) {
      throw new Error('Failed to bundle the lambda using Dart');
    }

    // Prepend preamble to index.js
    const indexJsPath = path.join(lambdaDir, 'dist/index.js');
    const indexJs = fs_extra.readFileSync(indexJsPath, 'utf8');
    fs_extra.writeFileSync(indexJsPath, `${PREAMBLE}\n${indexJs}`);

    // Copy the build directory to the output directory
    console.log(`Copying build directory ${bundleOutputDir} to ${outputDir}`);
    fs_extra.copySync(bundleOutputDir, outputDir);
    return true;
  }
}

class FrontendBundler implements ILocalBundling {
  /**
   * Attempt to bundle the frontend using local bundling.
   */
  tryBundle(outputDir: string, _: BundlingOptions): boolean {
    console.log('Attempting to bundle the frontend locally');
    const frontendDir = '../frontend';
    const pnpm = spawnSync(
      'pnpm',
      ['run', 'build'],
      {
        cwd: frontendDir,
        stdio: 'inherit',
      },
    );
    if (pnpm.status !== 0) {
      throw new Error('Failed to bundle the frontend using pnpm');
    }
    // Copy the build directory to the output directory
    const bundleOutputDir = path.join(frontendDir, 'dist');
    console.log(`Copying build directory ${bundleOutputDir} to ${outputDir}`);
    fs_extra.copySync(bundleOutputDir, outputDir);
    return true;
  }
}

const app = new App();

new MyStack(app, 'dart-edge', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

app.synth();
