import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBytes, formatScorePct, getStatusLabel } from './format';

test('formatBytes formats bytes, KB, and MB deterministically', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(1024 * 1024 * 1.5), '1.50 MB');
});

test('formatScorePct clamps and rounds similarity scores', () => {
  assert.equal(formatScorePct(0), '0%');
  assert.equal(formatScorePct(0.674), '67%');
  assert.equal(formatScorePct(1.4), '100%');
});

test('getStatusLabel maps internal status values to clean UI labels', () => {
  assert.equal(getStatusLabel('indexed'), 'Indexed');
  assert.equal(getStatusLabel('ocr_required'), 'OCR Required');
  assert.equal(getStatusLabel('failed'), 'Failed');
});
