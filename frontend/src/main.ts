import App from './App.svelte';

(self as any).MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, label: string) {
    if (label === 'json') {
      return '/monacoeditorwork/json.worker.bundle.js';
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return '/monacoeditorwork/css.worker.bundle.js';
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return '/monacoeditorwork/html.worker.bundle.js';
    }
    if (label === 'typescript' || label === 'javascript') {
      return '/monacoeditorwork/ts.worker.bundle.js';
    }
    return '/monacoeditorwork/editor.worker.bundle.js';
  },
};

const app = new App({
  target: document.getElementById('app'),
})

export default app
