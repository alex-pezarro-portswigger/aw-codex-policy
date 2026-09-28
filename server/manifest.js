import { fileURLToPath } from 'node:url';
import { PolicyStore } from './policy-store.js';
import { withDefaults, settingsDefaults, toAnswer } from './policy.js';

// The repo root: `client` must resolve inside <dir>/public/.
export const dir = fileURLToPath(new URL('..', import.meta.url));

// `ext` is THIS extension's slice of the dialog's `{ [extId]: data }` bag (core
// narrows it in hookPayloadFor), null when the browser sent none: spawn_session,
// a scheduled dispatch, an older tab. Empty fields fall back to the settings
// either way. `host` is our façade.
export function onBeforeDispatch({ sessionId, agent, ext, host }) {
  if (agent !== 'codex') return;
  host.stores.policies.set(sessionId, withDefaults(ext, host.settings));
}

// Runs after the fork's first launch (codexPolicy covers that one by reading the
// parent), so later resumes of the fork find their own row.
export function onFork({ sessionId, parentId, host }) {
  if (parentId) host.stores.policies.copy(parentId, sessionId);
}

export function onPurge({ sessionId, host }) {
  host.stores.policies.delete(sessionId);
}

// Called synchronously by core, for Codex launches only. `ext` is our façade. A
// missing row answers the settings defaults; a policy that equals core's
// defaults answers undefined.
export function codexPolicy({ phase, sessionId, parentId, ext }) {
  const store = ext.stores.policies;
  const stored = (phase === 'fork' && parentId && store.get(parentId)) || store.get(sessionId);
  return toAnswer(stored ?? settingsDefaults(ext.settings));
}

export default {
  id: 'aw-codex-policy',
  label: 'Codex sandbox & approvals',
  description: 'Pick Codex\'s sandbox, approval policy, approve-for-me and bypass per session, from the dispatch dialog\'s Advanced options.',
  help: 'These settings are the defaults a dispatch starts from; unset means core\'s default (workspace-write, never ask). The policy is re-read on every resume, so disabling this extension reverts sessions to core defaults.',
  dir,
  requires: [],
  // 1.12.0 is where the `codexPolicy` manifest key landed.
  engines: { wranglerApi: '^1.12.0' },
  settings: [
    {
      key: 'sandbox', type: 'select', label: 'Default sandbox',
      options: [
        { value: '', label: 'Core default (workspace-write)' },
        { value: 'read-only', label: 'read-only' },
        { value: 'workspace-write', label: 'workspace-write' },
        { value: 'danger-full-access', label: 'danger-full-access' },
      ],
    },
    {
      key: 'approval', type: 'select', label: 'Default approval policy',
      help: 'on-request stalls unattended sessions (spawn_session, schedules) on a prompt nobody sees.',
      options: [
        { value: '', label: 'Core default (never)' },
        { value: 'on-request', label: 'on-request' },
        { value: 'never', label: 'never' },
      ],
    },
    { key: 'approveForMe', type: 'toggle', label: 'Approve for me by default', help: 'Routes approvals through Codex\'s automatic review. Implies workspace-write + on-request, so it overrides the two settings above.' },
    { key: 'bypass', type: 'toggle', label: 'Bypass sandbox and approvals by default', help: 'Dangerous: runs model-generated commands with no sandbox and no approvals.' },
  ],
  stores: { policies: ({ log }) => new PolicyStore({ log }) },
  session: { onBeforeDispatch, onFork, onPurge },
  codexPolicy,
  client: 'public/client.js',
};
