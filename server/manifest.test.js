import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import manifest, { onBeforeDispatch, onFork, onPurge, codexPolicy } from './manifest.js';
import { PolicyStore } from './policy-store.js';

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'acp-')), 'policies.json');
}

function fakeHost(values = {}) {
  const policies = new PolicyStore({ file: tmpFile() });
  return { stores: { policies }, settings: { all: () => ({ ...values }), get: (k) => values[k] } };
}

test('manifest shape', () => {
  assert.equal(manifest.id, 'aw-codex-policy');
  assert.equal(manifest.engines.wranglerApi, '^1.13.0');
  assert.equal(typeof manifest.codexPolicy, 'function');
  assert.deepEqual(manifest.settings.map((s) => [s.key, s.type]), [
    ['sandbox', 'select'], ['approval', 'select'], ['approveForMe', 'toggle'], ['bypass', 'toggle'],
  ]);
  assert.equal(manifest.client, 'public/client.js');
});

test('store: get, set, copy, delete, and it persists', () => {
  const file = tmpFile();
  const s = new PolicyStore({ file });
  assert.equal(s.get('a'), undefined);
  s.set('a', { sandbox: 'read-only', junk: 1 });
  assert.deepEqual(s.get('a'), { sandbox: 'read-only' });
  assert.equal(s.copy('a', 'b'), true);
  assert.equal(s.copy('missing', 'c'), false);
  assert.deepEqual(new PolicyStore({ file }).get('b'), { sandbox: 'read-only' });
  assert.equal(s.delete('a'), true);
  assert.equal(s.delete('a'), false);
  assert.equal(new PolicyStore({ file }).get('a'), undefined);
});

test('onBeforeDispatch stores ext as sent, never merging settings', () => {
  const host = fakeHost({ sandbox: 'read-only', approval: 'on-request', bypass: true });
  onBeforeDispatch({ sessionId: 's1', agent: 'codex', ext: { sandbox: 'danger-full-access', approval: '', approveForMe: false, bypass: false }, host });
  assert.deepEqual(host.stores.policies.get('s1'), { sandbox: 'danger-full-access' });
});

test('onBeforeDispatch stores the settings defaults when ext is null', () => {
  const host = fakeHost({ sandbox: 'read-only', approval: '', bypass: false });
  onBeforeDispatch({ sessionId: 's1', agent: 'codex', ext: null, host });
  assert.deepEqual(host.stores.policies.get('s1'), { sandbox: 'read-only' });
});

test('onBeforeDispatch: approve-for-me or bypass from the dialog replaces the defaults', () => {
  const host = fakeHost({ sandbox: 'read-only' });
  onBeforeDispatch({ sessionId: 'a', agent: 'codex', ext: { approveForMe: true }, host });
  onBeforeDispatch({ sessionId: 'b', agent: 'codex', ext: { bypass: true, sandbox: 'read-only' }, host });
  assert.deepEqual(host.stores.policies.get('a'), { approveForMe: true });
  assert.deepEqual(host.stores.policies.get('b'), { bypass: true });
});

test('onBeforeDispatch ignores a Claude dispatch', () => {
  const host = fakeHost({ sandbox: 'read-only' });
  onBeforeDispatch({ sessionId: 's1', agent: 'claude', ext: { sandbox: 'read-only' }, host });
  assert.equal(host.stores.policies.get('s1'), undefined);
});

test('onFork copies the parent policy; onPurge deletes', () => {
  const host = fakeHost();
  host.stores.policies.set('p', { approval: 'on-request' });
  onFork({ sessionId: 'f', parentId: 'p', host });
  assert.deepEqual(host.stores.policies.get('f'), { approval: 'on-request' });
  onFork({ sessionId: 'g', parentId: 'nobody', host });
  assert.equal(host.stores.policies.get('g'), undefined);
  onPurge({ sessionId: 'f', host });
  assert.equal(host.stores.policies.get('f'), undefined);
});

test('codexPolicy at dispatch and resume reads the session row', () => {
  const ext = fakeHost();
  ext.stores.policies.set('s', { sandbox: 'read-only', approval: 'on-request' });
  for (const phase of ['dispatch', 'resume']) {
    assert.deepEqual(codexPolicy({ phase, sessionId: 's', entry: null, ext }), { sandbox: 'read-only', approval: 'on-request' });
  }
});

test('codexPolicy at fork reads the parent, then the fork, then defaults', () => {
  const ext = fakeHost({ approval: 'on-request' });
  ext.stores.policies.set('p', { sandbox: 'read-only' });
  assert.deepEqual(codexPolicy({ phase: 'fork', sessionId: 'f', parentId: 'p', entry: {}, ext }), { sandbox: 'read-only' });
  ext.stores.policies.set('f2', { bypass: true });
  assert.deepEqual(codexPolicy({ phase: 'fork', sessionId: 'f2', parentId: 'none', entry: {}, ext }), { bypass: true });
  assert.deepEqual(codexPolicy({ phase: 'fork', sessionId: 'f3', parentId: 'none', entry: {}, ext }), { approval: 'on-request' });
});

test('codexPolicy: a missing row falls back to the settings defaults', () => {
  const ext = fakeHost({ sandbox: 'danger-full-access' });
  assert.deepEqual(codexPolicy({ phase: 'resume', sessionId: 'x', entry: {}, ext }), { sandbox: 'danger-full-access' });
});

test('codexPolicy answers undefined when the policy equals core defaults', () => {
  const ext = fakeHost();
  assert.equal(codexPolicy({ phase: 'resume', sessionId: 'x', entry: {}, ext }), undefined);
  ext.stores.policies.set('y', { sandbox: 'workspace-write', approval: 'never' });
  assert.equal(codexPolicy({ phase: 'resume', sessionId: 'y', entry: {}, ext }), undefined);
});

test('codexPolicy: bypass and approve-for-me stand alone', () => {
  const ext = fakeHost();
  ext.stores.policies.set('b', { bypass: true, approveForMe: true, sandbox: 'read-only' });
  ext.stores.policies.set('a', { approveForMe: true, sandbox: 'read-only' });
  assert.deepEqual(codexPolicy({ phase: 'resume', sessionId: 'b', ext }), { bypass: true });
  assert.deepEqual(codexPolicy({ phase: 'resume', sessionId: 'a', ext }), { approveForMe: true });
});
