import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toUnit, incrementFor, addIncrement } from '../app/js/engine.js';

const rules = {
  progression: {
    increments: { barbell: 5, dumbbell: 5, machine: 10, cable: 5 },
    increment_unit: 'lb',
  },
};

test('toUnit converts pounds to kilograms', () => {
  assert.equal(toUnit(100, 'lb', 'kg'), 45.36);
});

test('toUnit converts kilograms to pounds', () => {
  assert.equal(toUnit(45.36, 'kg', 'lb'), 100);
});

test('toUnit is a no-op when the units match', () => {
  assert.equal(toUnit(137.5, 'lb', 'lb'), 137.5);
});

test('toUnit rejects an unknown unit rather than guessing', () => {
  assert.throws(() => toUnit(10, 'stone', 'kg'), /unit/i);
});

test('addIncrement keeps the logged unit and converts the increment', () => {
  assert.deepEqual(
    addIncrement({ value: 100, unit: 'kg' }, { value: 5, unit: 'lb' }),
    { value: 102.27, unit: 'kg' },
  );
});

test('addIncrement in matching units is exact', () => {
  assert.deepEqual(
    addIncrement({ value: 135, unit: 'lb' }, { value: 5, unit: 'lb' }),
    { value: 140, unit: 'lb' },
  );
});

test('addIncrement on a null load returns the increment as the opening load', () => {
  assert.deepEqual(
    addIncrement({ value: null, unit: 'lb' }, { value: 5, unit: 'lb' }),
    { value: null, unit: 'lb' },
  );
});

test('incrementFor prefers the exercise increment over the rules default', () => {
  const ex = { equipment: 'barbell', increment: 2.5, unit: 'kg' };
  assert.deepEqual(incrementFor(ex, rules), { value: 2.5, unit: 'kg' });
});

test('incrementFor falls back to the rules increment for the equipment', () => {
  const ex = { equipment: 'machine', increment: null, unit: null };
  assert.deepEqual(incrementFor(ex, rules), { value: 10, unit: 'lb' });
});

test('incrementFor throws a named error for unknown equipment', () => {
  const ex = { equipment: 'sandbag', increment: null, unit: null };
  assert.throws(() => incrementFor(ex, rules), /sandbag/);
});

test('incrementFor throws when the rules carry no increments at all', () => {
  const ex = { equipment: 'barbell', increment: null, unit: null };
  assert.throws(() => incrementFor(ex, { progression: {} }), /increment/i);
});
