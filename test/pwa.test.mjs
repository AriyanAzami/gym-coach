import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const sw = readFileSync('app/sw.js', 'utf8');
const manifest = JSON.parse(readFileSync('app/manifest.webmanifest', 'utf8'));
const html = readFileSync('app/index.html', 'utf8');

const precache = [...sw.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]);

test('every precached file exists', () => {
  assert.ok(precache.length > 5, 'the precache list looks empty');
  for (const path of precache) {
    const file = `app/${path.replace('./', '')}`;
    if (path === './') continue;
    assert.ok(existsSync(file), `sw.js precaches ${path}, which does not exist`);
  }
});

test('every module the page loads is precached', () => {
  const modules = readdirSync('app/js').filter((f) => f.endsWith('.js'));
  for (const file of modules) {
    assert.ok(
      precache.includes(`./js/${file}`),
      `app/js/${file} is not in the service worker precache, so it would 404 offline`,
    );
  }
});

test('the vendored library and the schema are precached', () => {
  assert.ok(precache.includes('./vendor/supabase.js'));
  assert.ok(precache.includes('./schema/rules.schema.json'));
});

test('the service worker carries a version to bust its own cache', () => {
  assert.match(sw, /const VERSION = '[^']+'/);
});

test('the service worker never caches the Supabase origin', () => {
  assert.match(sw, /supabase\.co/, 'requests to the backend must be network-only');
});

test('every manifest icon exists', () => {
  for (const icon of manifest.icons) {
    assert.ok(existsSync(`app/${icon.src}`), `manifest lists ${icon.src}, which does not exist`);
  }
});

test('the manifest has the fields an install prompt needs', () => {
  for (const key of ['name', 'short_name', 'start_url', 'scope', 'display', 'theme_color', 'background_color']) {
    assert.ok(manifest[key], `manifest is missing ${key}`);
  }
  assert.equal(manifest.display, 'standalone');
});

test('the manifest ships both a maskable and an any icon', () => {
  const purposes = manifest.icons.map((i) => i.purpose ?? 'any').join(' ');
  assert.match(purposes, /maskable/);
  assert.match(purposes, /any/);
});

test('every icon the page links to exists', () => {
  for (const m of html.matchAll(/<link[^>]*href="([^"]+\.png)"/g)) {
    assert.ok(existsSync(`app/${m[1]}`), `index.html links ${m[1]}, which does not exist`);
  }
});

test('the manifest carries no personal data', () => {
  const text = JSON.stringify(manifest);
  assert.doesNotMatch(text, /@[a-z0-9.-]+\.[a-z]{2,}/i);
});

test('the Pages workflow deploys the app directory and nothing else', () => {
  const workflow = readFileSync('.github/workflows/pages.yml', 'utf8');
  assert.match(workflow, /path:\s*app/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.doesNotMatch(workflow, /SERVICE_ROLE|SUPABASE_SERVICE/, 'Pages needs no secrets');
});
