import { awscdk } from 'projen';
import { NodePackageManager } from 'projen/lib/javascript';
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.74.0',
  defaultReleaseBranch: 'main',
  name: 'backend',
  projenrcTs: true,
  packageManager: NodePackageManager.PNPM,
  deps: ['fs-extra'],
  devDeps: ['@types/fs-extra'],
  github: false,
});
project.synth();