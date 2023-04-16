import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';
import ViteMonaco from 'vite-plugin-monaco-editor';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte(), ViteMonaco.default({})],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});