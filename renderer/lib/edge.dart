import 'dart:convert';

import 'package:js/js.dart';
import 'package:js/js_util.dart' as js_util;
import 'package:markdown/markdown.dart';

@JS()
@anonymous
@staticInterop
abstract class CloudFrontRequestEvent {}

extension on CloudFrontRequestEvent {
  @JS('Records')
  List<CloudFrontRequestEventRecord> get records {
    final jsArray = js_util.getProperty(this, 'Records');
    return (jsArray as List<Object?>).cast();
  }
}

@JS()
@anonymous
@staticInterop
abstract class CloudFrontRequestEventRecord {}

extension on CloudFrontRequestEventRecord {
  external CloudFrontRequestEventRecordRequest get cf;
}

@JS()
@anonymous
@staticInterop
abstract class CloudFrontRequestEventRecordRequest {}

extension on CloudFrontRequestEventRecordRequest {
  external CloudFrontRequest get request;
}

@JS()
@anonymous
@staticInterop
abstract class CloudFrontRequest {}

extension on CloudFrontRequest {
  external String get method;
  external CloudFrontRequestBody get body;
}

@JS()
@anonymous
@staticInterop
abstract class CloudFrontRequestBody {}

extension on CloudFrontRequestBody {
  external String get data;
  external String get encoding;
}

@JS()
@anonymous
@staticInterop
abstract class CloudFrontResultResponse {
  external factory CloudFrontResultResponse({
    required String status,
    String? body,
  });
}

String stringify(Object? object) => js_util.callMethod(
      js_util.getProperty(js_util.globalThis, 'JSON'),
      'stringify',
      [object],
    );

typedef HandlerFn = void Function(
  CloudFrontRequestEvent event,
  dynamic context,
  void Function(Object) callback,
);

@JS()
external Object get exports;

set handler(HandlerFn handler) {
  js_util.setProperty(exports, 'handler', handler);
  js_util.setProperty(js_util.globalThis, 'handler', handler);
}

void eval(String js) => js_util.callMethod(js_util.globalThis, 'eval', [js]);

void main() {
  handler = allowInterop((event, context, callback) {
    void respond(Object response) {
      js_util.callMethod(
        callback,
        'apply',
        [
          null, // thisArg
          js_util.jsify([
            null, // error
            response,
          ]),
        ],
      );
    }

    print(stringify(event));
    final request = event.records.first.cf.request;
    print('Method: ${request.method}');
    if (request.method != 'POST') {
      return respond(request);
    }
    var bodyJson = request.body.data;
    if (request.body.encoding == 'base64') {
      bodyJson = utf8.decode(base64Decode(bodyJson));
    }
    print('Body: $bodyJson');
    final body = jsonDecode(bodyJson) as Map<String, Object?>;
    final code = body['code']! as String;
    print('Code: $code');
    return respond(
      CloudFrontResultResponse(
        status: '200',
        body: jsonEncode({'code': markdownToHtml(code)}),
      ),
    );
  });
//   eval(
//     '''
// const event = {
//   Records: [
//     {
//       cf: {
//         request: {
//           method: 'POST',
//           body: {
//             data: '{"code":"# Hello World"}',
//             encoding: 'text',
//           },
//         },
//       },
//     },
//   ],
// };
// globalThis.handler(event, {}, (err, res) => console.log(JSON.stringify(res)));
// ''',
//   );
}
