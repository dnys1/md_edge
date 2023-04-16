<script lang="ts">
  import { afterUpdate } from "svelte";
  import CodeEditor from "./lib/CodeEditor.svelte";
  import { debounce } from "./utils";
  import hljs from "highlight.js";
  import "highlight.js/styles/default.css";

  let regularCode = "";
  let edgeCode = "";

  const regularSamples: number[] = [];
  const edgeSamples: number[] = [];
  let regularAverage = 0;
  let edgeAverage = 0;

  afterUpdate(() => {
    hljs.highlightAll();
  });

  const handleCodeChange = debounce(
    async (e: CustomEvent<string>): Promise<void> => {
      const [_regularCode, _edgeCode] = await Promise.all([
        transformCode(e.detail, "api"),
        transformCode(e.detail, "edge"),
      ]);
      if (_regularCode) {
        regularCode = _regularCode;
      }
      if (_edgeCode) {
        edgeCode = _edgeCode;
      }
    },
    500
  );

  const transformCode = async (
    code: string,
    endpoint: "api" | "edge"
  ): Promise<string | null> => {
    console.time(endpoint);
    const start = performance.now();
    const response = await fetch(`/${endpoint}/transform`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    try {
      if (!response.ok) {
        throw new Error(`${response.status} ${await response.text()}`);
      }
      const { code } = await response.json();
      return code;
    } catch (e) {
      console.error(`Failed to transform code: ${e}`);
      return null;
    } finally {
      const end = performance.now();
      const duration = end - start;
      if (endpoint === "api") {
        regularSamples.push(duration);
        regularAverage =
          regularSamples.reduce((a, b) => a + b, 0) / regularSamples.length;
      } else {
        edgeSamples.push(duration);
        edgeAverage =
          edgeSamples.reduce((a, b) => a + b, 0) / edgeSamples.length;
      }
      console.timeEnd(endpoint);
    }
  };
</script>

<div
  style="display: flex; height: 100vh; width: 100vw; box-sizing: border-box;"
>
  <div style="flex: 1;">
    <CodeEditor on:codechange={handleCodeChange} />
  </div>
  <div style="flex: 1; display: flex; flex-direction: column;">
    <div
      style="flex: 1; overflow: auto; border-left: 1px solid #ccc; padding: 1rem;"
    >
      <h2>Regular Lambda (avg: {Math.round(regularAverage)}ms)</h2>
      <hr />
      <div class="code">
        {@html regularCode}
      </div>
    </div>
    <div
      style="flex: 1; overflow: auto; border-left: 1px solid #ccc; padding: 1rem;"
    >
      <h2>Edge Lambda (avg: {Math.round(edgeAverage)}ms)</h2>
      <hr />
      <div class="code">
        {@html edgeCode}
      </div>
    </div>
  </div>
</div>

<style>
  .code {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    background-color: #f3f3f3;
  }
</style>
