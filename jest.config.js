import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export const tsjPreset = require('ts-jest/presets');

export default {
  ...tsjPreset.defaultsESM,
  testEnvironment: 'node',
};
