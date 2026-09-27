import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  // shared — исходники TS в монорепо, вшиваем в бандл
  noExternal: ['@hyzmat/shared'],
});
