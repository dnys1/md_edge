import 'dart:convert';

import 'package:js/js.dart';
import 'package:js/js_util.dart' as js_util;
import 'package:markdown/markdown.dart';

@JS()
@anonymous
@staticInterop
abstract class ApiGatewayProxyEvent {}

extension on ApiGatewayProxyEvent {
  external String get body;
  // external bool get isBase64Encoded;
}

String stringify(Object? object) => js_util.callMethod(
      js_util.getProperty(js_util.globalThis, 'JSON'),
      'stringify',
      [object],
    );

typedef HandlerFn = void Function(
  ApiGatewayProxyEvent event,
  dynamic context,
  void Function(Object) callback,
);

@JS()
external Object get exports;

set handler(HandlerFn handler) {
  js_util.setProperty(exports, 'handler', handler);
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
    final body = jsonDecode(event.body) as Map<String, Object?>;
    final code = body['code']! as String;
    print('Code: $code');
    return respond(
      js_util.jsify({'code': markdownToHtml(code)}),
    );
  });
}
