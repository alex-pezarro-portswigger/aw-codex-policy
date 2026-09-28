import { test } from 'node:test';
import assert from 'node:assert/strict';
import client from './public/client.js';

// Just enough DOM for the controls: value/checked/disabled/hidden and change
// listeners. No jsdom, matching effort-inline.
function stub(id) {
  const listeners = [];
  return {
    id, value: '', checked: false, disabled: false, hidden: false,
    addEventListener: (type, fn) => { if (type === 'change') listeners.push(fn); },
    change() { for (const fn of listeners) fn(); },
  };
}

function mountContribution() {
  let contribution = null;
  client.register({ register: (slot, c) => { assert.equal(slot, 'dispatch.field'); contribution = c; } });
  const nodes = {};
  const host = {
    innerHTML: '', hidden: false,
    querySelector: (sel) => (nodes[sel.slice(1)] ||= stub(sel.slice(1))),
  };
  contribution.mount(host);
  return { contribution, host, n: (id) => nodes[`acp-${id}`] };
}

const ctx = (agent) => ({ mode: 'launch', draft: { agent }, agents: [] });

test('registers one advanced field', () => {
  const { contribution } = mountContribution();
  assert.equal(contribution.id, 'codex-policy');
  assert.equal(contribution.at, 'advanced');
});

test('the field is Codex-only', () => {
  const { contribution, host } = mountContribution();
  contribution.update(host, ctx('claude'));
  assert.equal(host.hidden, true);
  assert.equal(contribution.ext(host), null);
  contribution.update(host, ctx('codex'));
  assert.equal(host.hidden, false);
  assert.deepEqual(contribution.ext(host), {});
});

test('no prefill: switching to Codex starts empty, edits survive re-renders', () => {
  const { contribution, host, n } = mountContribution();
  contribution.update(host, ctx('codex'));
  assert.equal(n('sandbox').value, '');
  n('sandbox').value = 'read-only';
  contribution.update(host, ctx('codex'));
  assert.equal(n('sandbox').value, 'read-only');
  contribution.update(host, ctx('claude'));
  contribution.update(host, ctx('codex'));
  assert.equal(n('sandbox').value, '');
});

test('ext() leaves out empty values', () => {
  const { contribution, host, n } = mountContribution();
  contribution.update(host, ctx('codex'));
  n('sandbox').value = 'read-only';
  assert.deepEqual(contribution.ext(host), { sandbox: 'read-only' });
  n('approval').value = 'on-request';
  assert.deepEqual(contribution.ext(host), { sandbox: 'read-only', approval: 'on-request' });
});

test('approve-for-me stands alone and disables the selects', () => {
  const { contribution, host, n } = mountContribution();
  contribution.update(host, ctx('codex'));
  n('sandbox').value = 'read-only';
  n('approve-for-me').checked = true;
  n('approve-for-me').change();
  assert.equal(n('sandbox').disabled, true);
  assert.equal(n('approval').disabled, true);
  assert.deepEqual(contribution.ext(host), { approveForMe: true });
});

test('bypass shows the danger note, disables the rest and wins', () => {
  const { contribution, host, n } = mountContribution();
  contribution.update(host, ctx('codex'));
  assert.equal(n('danger').hidden, true);
  n('approve-for-me').checked = true;
  n('bypass').checked = true;
  n('bypass').change();
  assert.equal(n('danger').hidden, false);
  assert.equal(n('sandbox').disabled, true);
  assert.equal(n('approve-for-me').disabled, true);
  assert.deepEqual(contribution.ext(host), { bypass: true });
  n('bypass').checked = false;
  n('bypass').change();
  assert.equal(n('danger').hidden, true);
  assert.equal(n('approve-for-me').disabled, false);
});
