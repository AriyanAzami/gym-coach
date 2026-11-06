/* The coach's output is deliberately never printed, which makes a failed run
   hard to diagnose. The answer is to classify it: match the log against a fixed
   list of known signatures and report only which one matched — a category name
   is not training data. Anything unrecognised reports as unclassified rather
   than echoing a line back. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailure, CATEGORIES } from '../coach/lib/classify.mjs';

test('an authentication failure is recognised', () => {
  assert.equal(classifyFailure('Error: invalid API key · Fix external API key'), 'claude authentication failed');
  assert.equal(classifyFailure('API Error: 401 {"type":"authentication_error"}'), 'claude authentication failed');
  assert.equal(classifyFailure('OAuth token has expired'), 'claude authentication failed');
});

test('a quota or rate limit is recognised', () => {
  assert.equal(classifyFailure('Credit balance is too low'), 'claude quota or rate limit');
  assert.equal(classifyFailure('API Error: 429 rate_limit_error'), 'claude quota or rate limit');
  assert.equal(classifyFailure('usage limit reached'), 'claude quota or rate limit');
});

test('a missing command is recognised', () => {
  assert.equal(classifyFailure('/bin/sh: 1: claude: not found'), 'a command was missing');
  assert.equal(classifyFailure("Error: spawn ENOENT"), 'a command was missing');
});

test('a refused tool is recognised', () => {
  assert.equal(classifyFailure('Claude requested permissions to use Bash, but you have not granted it yet'),
    'a tool was refused by the permission rules');
});

test('the turn limit is recognised', () => {
  assert.equal(classifyFailure('Reached max turns (40)'), 'hit the turn limit without finishing');
});

test('a timeout is recognised', () => {
  assert.equal(classifyFailure('Error: operation timed out after 600000ms'), 'timed out');
});

test('a validator failure is recognised', () => {
  assert.equal(classifyFailure('3 problems to fix:\n1. Volume: back gets 2 sets'),
    'the plan never passed the validator');
});

test('an unrecognised log is reported as unclassified, never echoed', () => {
  const secret = 'Bench press 185 lb for 3x8, bodyweight 70.4 kg';
  const result = classifyFailure(secret);
  assert.equal(result, 'unclassified');
  assert.doesNotMatch(result, /185|70\.4|Bench/);
});

test('an empty or missing log is handled', () => {
  assert.equal(classifyFailure(''), 'the coach wrote nothing');
  assert.equal(classifyFailure(null), 'the coach wrote nothing');
  assert.equal(classifyFailure(undefined), 'the coach wrote nothing');
});

test('every category is a fixed string that carries no data', () => {
  for (const category of CATEGORIES) {
    assert.match(category, /^[a-z0-9 ,'()-]+$/i, `"${category}" is not a plain phrase`);
    assert.doesNotMatch(category, /\d{2,}/, `"${category}" contains a number that could be data`);
  }
});

test('classification never returns anything outside the fixed list', () => {
  const inputs = [
    'random text', '', 'weight 225 lb', 'Error: 500', 'something odd happened',
    'invalid api key', 'rate_limit_error', 'ENOENT',
  ];
  for (const input of inputs) {
    assert.ok(CATEGORIES.includes(classifyFailure(input)), `"${classifyFailure(input)}" is not a known category`);
  }
});

test('the first matching signature wins, so a log with several is still one category', () => {
  const both = 'invalid api key\nlater: rate_limit_error';
  assert.ok(CATEGORIES.includes(classifyFailure(both)));
});
