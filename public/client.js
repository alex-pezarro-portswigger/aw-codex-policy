// Browser half. One `dispatch.field` contribution in Advanced options, shown
// only for a Codex draft. The board hands a client no way to read its own
// extension settings, so nothing is prefilled: an empty select or an unticked
// box means "use the settings default", which the server half applies.

const MARKUP = `
<div class="acp-field">
  <label for="acp-sandbox">Codex sandbox</label>
  <select id="acp-sandbox">
    <option value="">Default</option>
    <option value="read-only">read-only</option>
    <option value="workspace-write">workspace-write</option>
    <option value="danger-full-access">danger-full-access</option>
  </select>
  <label for="acp-approval">Codex approvals</label>
  <select id="acp-approval">
    <option value="">Default</option>
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

      mount(el) {
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
      // Codex resets the controls (the plan's "prefill on agent switch", with
      // nothing to prefill from); re-renders while Codex stays keep the edits.
      update(el, ctx) {
        if (!ui) return;
        const codex = ctx?.draft?.agent === 'codex';
        el.hidden = !codex;
        if (codex && !ui.codex) {
          ui.sandbox.value = '';
          ui.approval.value = '';
          ui.approveForMe.checked = false;
          ui.bypass.checked = false;
          sync();
        }
        ui.codex = codex;
      },

      ext() {
        if (!ui || !ui.codex) return null;
        if (ui.bypass.checked) return { bypass: true };
        if (ui.approveForMe.checked) return { approveForMe: true };
        const out = {};
        if (ui.sandbox.value) out.sandbox = ui.sandbox.value;
        if (ui.approval.value) out.approval = ui.approval.value;
        return out;
      },
    });
  },
};
