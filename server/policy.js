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

// Fields the dialog left empty fall back to the settings one by one: the
// browser half cannot read settings, so it sends only what the human picked.
// A ticked approve-for-me or bypass in the dialog replaces the defaults
// outright, since the dialog disables the other controls under it.
export function withDefaults(picked, settings) {
  const own = cleanPolicy(picked);
  if (own.bypass) return { bypass: true };
  if (own.approveForMe) return { approveForMe: true };
  return { ...settingsDefaults(settings), ...own };
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
