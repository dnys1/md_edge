<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from "svelte";
  import * as monaco from "monaco-editor";
  import "monaco-editor/min/vs/editor/editor.main.css";

  let editor: monaco.editor.IStandaloneCodeEditor;
  let container: HTMLDivElement;
  let code = "# Dart Lambda Functions";

  const dispatch = createEventDispatcher();

  onMount(() => {
    editor = monaco.editor.create(container, {
      value: code,
      language: "markdown",
      theme: "vs-light",
    });

    editor.onDidChangeModelContent(async () => {
      code = editor.getValue();
      dispatch("codechange", code);
    });
  });

  onDestroy(() => {
    if (editor) {
      editor.dispose();
    }
  });
</script>

<div bind:this={container} class="editor-container" />

<style>
  .editor-container {
    height: 100%;
    width: 100%;
  }
</style>
