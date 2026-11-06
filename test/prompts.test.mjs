import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const KINDS = ['block', 'revise_block', 'checkin', 'ask'];
const read = (kind) => readFileSync(`coach/prompts/${kind}.md`, 'utf8');

test('there is a prompt for every job kind and nothing else', () => {
  const files = readdirSync('coach/prompts').filter((f) => f.endsWith('.md')).sort();
  assert.deepEqual(files, KINDS.map((k) => `${k}.md`).sort());
});

for (const kind of KINDS) {
  test(`${kind}: reads the context file`, () => {
    assert.match(read(kind), /work\/context\.json/);
  });

  test(`${kind}: names the file it must write`, () => {
    const expected = ['block', 'revise_block'].includes(kind) ? /work\/output\.json/ : /work\/output\.md/;
    assert.match(read(kind), expected);
  });

  test(`${kind}: treats the manual and rules as binding`, () => {
    const text = read(kind);
    assert.match(text, /rules/i);
    assert.match(text, /manual/i);
    assert.match(text, /binding|must obey|never override/i);
  });

  test(`${kind}: honours the owner's instructions and unconsumed notes`, () => {
    const text = read(kind);
    assert.match(text, /instructions/i);
    assert.match(text, /coach_notes|notes/i);
  });

  test(`${kind}: requires every claim to cite a logged number`, () => {
    assert.match(read(kind), /cite|quote the number|from the context/i);
  });

  test(`${kind}: contains no personal data`, () => {
    const text = read(kind);
    assert.doesNotMatch(text, /\b\d{2,4}\s?(lb|kg)\b/i, 'a load in a prompt would be personal data');
    assert.doesNotMatch(text, /@[a-z0-9.-]+\.[a-z]{2,}/i, 'an email address');
    assert.doesNotMatch(text, /\b[0-9a-f]{32}\b/i, 'a Notion id');
    assert.doesNotMatch(text, /\bAriyan\b/i, 'a name');
  });

  test(`${kind}: never asks for anything to be printed to the log`, () => {
    assert.doesNotMatch(read(kind), /console\.log|print the|echo /i);
  });
}

for (const kind of ['block', 'revise_block']) {
  test(`${kind}: requires the validator to pass before finishing`, () => {
    const text = read(kind);
    assert.match(text, /node coach\/validate\.mjs/);
    assert.match(text, /until it passes|exits? 0|passes/i);
  });

  test(`${kind}: forbids prescribing a load`, () => {
    assert.match(read(kind), /never.{0,40}weight|no weights?|not prescribe a (load|weight)/i);
  });

  test(`${kind}: requires the volume arithmetic in the rationale`, () => {
    const text = read(kind);
    assert.match(text, /rationale/i);
    assert.match(text, /arithmetic|show the (sums|maths|working)|sets a week/i);
  });
}

test('revise_block works from the existing draft', () => {
  assert.match(read('revise_block'), /draft_block/);
});

test('checkin and ask produce prose, not a plan', () => {
  for (const kind of ['checkin', 'ask']) {
    assert.doesNotMatch(read(kind), /work\/output\.json/);
  }
});

test('ask answers the question that was asked', () => {
  assert.match(read('ask'), /job\.instructions|the question/i);
});
