import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { gpAliases } from './.platform/packages/cli/src/vite.ts';
import { gpGame } from './.platform/packages/cli/src/vite-plugin.ts';
import { locateGame } from './.platform/packages/cli/src/paths.ts';
export default defineConfig({
 base: './',
 plugins: [gpGame(locateGame(resolve('games/auto-quiz')), 'dev')],
 resolve: {alias: gpAliases()},
 server: {host:'127.0.0.1',port:5173,strictPort:true},
 preview: {host:'127.0.0.1',port:4173,strictPort:true},
 build: {outDir:'dist',target:'es2022',assetsInlineLimit:4096,sourcemap:false}
});
