// Browser half. One `dispatch.field` contribution in Advanced options, shown
// only for a Codex draft. It prefills from this extension's settings
// (api.settings(), host API 1.13.0) and sends every value explicitly, so the
// dialog's choice is the whole policy: an empty select means core's default.

const MARKUP = `
<div class="acp-field">
  <label for="acp-sandbox">Codex sandbox</label>
  <select id="acp-sandbox">
    <option value="">Core default (workspace-write)</option>
    <option value="read-only">read-only</option>
    <option value="workspace-write">workspace-write</option>
    <option value="danger-full-access">danger-full-access</option>
  </select>
  <label for="acp-approval">Codex approvals</label>
  <select id="acp-approval">
    <option value="">Core default (never)</option>
    <option value="on-request">on-request</option>
    <option value="never">never</option>
  </select>
  <label><input type="checkbox" id="acp-approve-for-me"> Approve for me (auto review, workspace-write)</label>
  <label><input type="checkbox" id="acp-bypass"> Bypass sandbox and approvals</label>
  <p id="acp-danger" hidden>Runs without sandbox or approvals.</p>
</div>`;

export default {
  register(reg) {
    let ui = null;
    let api = null;

    // approve-for-me stands alone (it implies workspace-write + on-request);
    // bypass overrides everything. Disabled controls are also left out of ext().
    function sync() {
      const bypass = ui.bypass.checked;
      const afm = ui.approveForMe.checked;
      ui.approveForMe.disabled = bypass;
      ui.sandbox.disabled = bypass || afm;
      ui.approval.disabled = bypass || afm;
      ui.danger.hidden = !bypass;
    }

    reg.register('dispatch.field', {
      id: 'codex-policy',
      at: 'advanced',

      mount(el, hostApi) {
        api = hostApi;
        el.innerHTML = MARKUP;
        const q = (id) => el.querySelector(`#${id}`);
        ui = {
          sandbox: q('acp-sandbox'),
          approval: q('acp-approval'),
          approveForMe: q('acp-approve-for-me'),
          bypass: q('acp-bypass'),
          danger: q('acp-danger'),
          codex: false,
        };
        for (const box of [ui.approveForMe, ui.bypass]) box.addEventListener('change', sync);
        sync();
      },

      // ctx: { mode, draft, agents }. Hide for anything but Codex. Switching TO
      // Codex prefills from the settings as they are now; re-renders while
      // Codex stays keep the edits.
      update(el, ctx) {
        if (!ui) return;
        const codex = ctx?.draft?.agent === 'codex';
        el.hidden = !codex;
        if (codex && !ui.codex) {
          const s = api?.settings?.() || {};
          ui.sandbox.value = s.sandbox || '';
          ui.approval.value = s.approval || '';
          ui.approveForMe.checked = s.approveForMe === true;
          ui.bypass.checked = s.bypass === true;
          sync();
        }
        ui.codex = codex;
      },

      // Every field, always: the server half stores this as-is, so an unticked
      // box really is off even when Settings has it on.
      ext() {
        if (!ui || !ui.codex) return null;
        const bypass = ui.bypass.checked;
        const approveForMe = !bypass && ui.approveForMe.checked;
        const plain = !bypass && !approveForMe;
        return {
          sandbox: plain ? ui.sandbox.value : '',
          approval: plain ? ui.approval.value : '',
          approveForMe,
          bypass,
        };
      },
    });
  },
};
