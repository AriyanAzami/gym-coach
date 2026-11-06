/* All numbers below are fabricated. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { line, bars } from '../app/js/charts.js';
import { readFileSync } from 'node:fs';

const css = readFileSync('app/css/app.css', 'utf8');

/* A mark drawn with a class that has no CSS rule renders invisible, so the
   stylesheet is part of the chart's contract. */
function assertClassesStyled(svg) {
  const used = new Set();
  for (const m of svg.matchAll(/class="([^"]+)"/g)) {
    for (const name of m[1].trim().split(/\s+/)) used.add(name);
  }
  for (const name of used) {
    if (name === 'chart' || name === 'chart-fig') continue;
    assert.match(css, new RegExp(`\\.${name}[\\s,.:{]`), `.${name} is used in an SVG but has no CSS rule`);
  }
}


const points = [
  { x: '2026-09-07', y: 175, label: '175 lb' },
  { x: '2026-09-21', y: 180, label: '180 lb' },
  { x: '2026-10-05', y: 185, label: '185 lb' },
  { x: '2026-10-30', y: 190, label: '190 lb' },
];

// ---- line ----

test('a line chart draws one path through every point', () => {
  const svg = line(points, { title: 'Bench press' });
  assert.match(svg, /<svg/);
  const path = svg.match(/<polyline[^>]*points="([^"]+)"/);
  assert.ok(path, 'no polyline drawn');
  assert.equal(path[1].trim().split(/\s+/).length, 4);
});

test('the line is a 2px stroke, not a filled area', () => {
  const svg = line(points, { title: 'Bench press' });
  assert.match(svg, /stroke-width="2"/);
});

test('a single point draws a marker and no line', () => {
  const svg = line([points[0]], { title: 'Bench press' });
  assert.doesNotMatch(svg, /<polyline/);
  assert.match(svg, /<circle/);
});

test('markers are at least 8px across', () => {
  const svg = line(points, { title: 'Bench press' });
  const radii = [...svg.matchAll(/<circle[^>]*r="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(radii.length > 0, 'no markers drawn');
  assert.ok(radii.every((r) => r * 2 >= 8), `a marker is under 8px: ${radii}`);
});

test('no data draws a message rather than an empty chart', () => {
  const svg = line([], { title: 'Bench press' });
  assert.doesNotMatch(svg, /<polyline/);
  assert.match(svg, /nothing logged/i);
});

test('only the first and last points are labelled, never every point', () => {
  const svg = line(points, { title: 'Bench press' });
  const labels = [...svg.matchAll(/class="pt-label"/g)];
  assert.equal(labels.length, 2, 'a number on every point is noise');
  assert.match(svg, /175 lb/);
  assert.match(svg, /190 lb/);
  assert.doesNotMatch(svg, />180 lb</);
});

test('every point carries a native tooltip so hover reveals its value', () => {
  const svg = line(points, { title: 'Bench press' });
  assert.equal([...svg.matchAll(/<title>/g)].length, points.length);
});

test('the line chart hardcodes no colour and every class it uses is styled', () => {
  const svg = line(points, { title: 'Bench press' });
  assert.doesNotMatch(svg, /#[0-9a-f]{3,6}/i, 'a hardcoded colour cannot adapt to dark mode');
  assertClassesStyled(svg);
});

test('a hostile label cannot inject markup', () => {
  const svg = line([{ x: '2026-01-01', y: 1, label: '<script>alert(1)</script>' }], { title: 'x' });
  assert.doesNotMatch(svg, /<script>alert/);
});

test('a hostile title cannot inject markup', () => {
  const svg = line(points, { title: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(svg, /<img src=x/);
});

test('a flat series does not collapse to a zero-height chart', () => {
  const flat = [{ x: 'a', y: 100 }, { x: 'b', y: 100 }, { x: 'c', y: 100 }];
  const svg = line(flat, { title: 'flat' });
  const ys = [...svg.matchAll(/<circle[^>]*cy="([\d.]+)"/g)].map((m) => Number(m[1]));
  assert.ok(ys.every(Number.isFinite), 'a flat series produced a NaN coordinate');
  assert.equal(new Set(ys).size, 1, 'a flat series should sit on one line');
});

// ---- bars ----

const rows = [
  { label: 'back', value: 12, target: 8 },
  { label: 'chest', value: 6, target: 10 },
  { label: 'legs', value: 0, target: 8 },
];

test('a bar chart draws one bar per row', () => {
  const svg = bars(rows, { title: 'Sets this week' });
  assert.equal([...svg.matchAll(/class="bar-fill[ "]/g)].length, 3);
});

test('bars have 4px rounded data-ends', () => {
  assert.match(bars(rows, { title: 'x' }), /rx="4"/);
});

test('a row short of its target is labelled in text, not by colour alone', () => {
  const svg = bars(rows, { title: 'x' });
  assert.match(svg, /short 4/);
  assert.match(svg, /short 8/);
  assert.match(svg, /met/);
});

test('each bar shows its own value', () => {
  const svg = bars(rows, { title: 'x' });
  assert.match(svg, />12</);
  assert.match(svg, />6</);
});

test('every bar carries a native tooltip', () => {
  assert.equal([...bars(rows, { title: 'x' }).matchAll(/<title>/g)].length, 3);
});

test('the target is drawn as a reference mark on each row', () => {
  assert.equal([...bars(rows, { title: 'x' }).matchAll(/class="target-tick"/g)].length, 3);
});

test('a zero value still renders its row and label', () => {
  const svg = bars(rows, { title: 'x' });
  assert.match(svg, /legs/);
});

test('no rows draws a message rather than an empty chart', () => {
  const svg = bars([], { title: 'x' });
  assert.doesNotMatch(svg, /class="bar-fill"/);
  assert.match(svg, /nothing logged/i);
});

test('the bar chart hardcodes no colour and every class it uses is styled', () => {
  const svg = bars(rows, { title: 'x' });
  assert.doesNotMatch(svg, /#[0-9a-f]{3,6}/i);
  assertClassesStyled(svg);
});

test('a hostile row label cannot inject markup', () => {
  const svg = bars([{ label: '<script>x</script>', value: 1, target: 1 }], { title: 'x' });
  assert.doesNotMatch(svg, /<script>x/);
});

test('a row whose value exceeds the widest target still fits the chart', () => {
  const svg = bars([{ label: 'back', value: 40, target: 8 }], { title: 'x' });
  const track = Number(svg.match(/class="bar-track"[\s\S]*?width="([\d.]+)"/)[1]);
  const fill = Number(svg.match(/class="bar-fill[^"]*"[\s\S]*?width="([\d.]+)"/)[1]);
  assert.ok(fill <= track, `a bar overflowed its track: ${fill} > ${track}`);
});
