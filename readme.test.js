import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8');

test('README behauptet nicht mehr, dass ein Test absichtlich rot ist', () => {
  assert.doesNotMatch(readme, /absichtlich rot/i);
  assert.doesNotMatch(readme, /1 Test ist absichtlich rot/);
  assert.doesNotMatch(readme, /intentionally (red|failing)/i);
});

test('README sagt verständlich, dass alle Tests erfolgreich laufen', () => {
  assert.match(readme, /Alle Tests laufen erfolgreich/i);
});
