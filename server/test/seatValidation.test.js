const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const { validateSeatIds } = require('../src/services/seatService');

const seatIds = Array.from({ length: 5 }, () => new mongoose.Types.ObjectId().toString());

test('accepts between one and four valid unique seat ids', () => {
  assert.equal(validateSeatIds(seatIds.slice(0, 1)), null);
  assert.equal(validateSeatIds(seatIds.slice(0, 4)), null);
});

test('rejects missing, excessive, malformed, and duplicate seat ids', () => {
  assert.equal(validateSeatIds(undefined), 'Choose between 1 and 4 held seats.');
  assert.equal(validateSeatIds(seatIds), 'Choose between 1 and 4 held seats.');
  assert.equal(validateSeatIds(['not-an-object-id']), 'Every seat id must be a valid id.');
  assert.equal(validateSeatIds([seatIds[0], seatIds[0]]), 'The seat list contains duplicates.');
  assert.equal(validateSeatIds([seatIds[0].toUpperCase(), seatIds[0]]), 'The seat list contains duplicates.');
});
