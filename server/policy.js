// The policy vocabulary, mirrored from core's server/extensions/codex-policy.js.
// Validation here is loose on purpose: core normalises every answer again.

export const SANDBOXES = ['read-only', 'workspace-write', 'danger-full-access'];
export const APPROVALS = ['on-request', 'never'];

// Keep only well-formed fields; false flags and empty strings mean "unset".
export function cleanPolicy(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  if (SANDBOXES.includes(raw.sandbox)) out.sandbox = raw.sandbox;
  if (APPROVALS.includes(raw.approval)) out.approval = raw.approval;
  if (raw.approveForMe === true) out.approveForMe = true;
  if (raw.bypass === true) out.bypass = true;
  return out;
}

// The settings are the defaults a dispatch starts from.
export function settingsDefaults(settings) {
  return cleanPolicy(settings?.all?.() || {});
}

// The dialog's choice is the whole policy (it prefills from the settings and
// sends every field), so it never merges with them. Only a dispatch with no
// dialog (ext null) gets the settings defaults.
export function withDefaults(picked, settings) {
  const p = picked == null ? settingsDefaults(settings) : cleanPolicy(picked);
  if (p.bypass) return { bypass: true };
  if (p.approveForMe) return { approveForMe: true };
  return p;
}

// Core's own launch flags: workspace-write + never, no approve-for-me/bypass.
export function isCoreDefault(p) {
  return !p.bypass && !p.approveForMe
    && (p.sandbox ?? 'workspace-write') === 'workspace-write'
    && (p.approval ?? 'never') === 'never';
}

// What codexPolicy answers: bypass alone, else the policy, else undefined when
// it would change nothing.
export function toAnswer(p) {
  const c = cleanPolicy(p);
  if (c.bypass) return { bypass: true };
  // approve-for-me implies workspace-write + on-request; Codex refuses it next
  // to any explicit --sandbox/--ask-for-approval, so it stands alone.
  if (c.approveForMe) return { approveForMe: true };
  return isCoreDefault(c) ? undefined : c;
}
