# aw-codex-policy

An [Agent Wrangler](https://github.com/alex-pezarro-portswigger/agent-wrangler) extension
that lets you pick Codex's **sandbox**, **approval policy**, **approve-for-me** and
**bypass** per session, from the dispatch dialog's *Advanced options*.

Requires an Agent Wrangler server serving host API **^1.12.0** (the `codexPolicy`
manifest hook). An older server refuses to load it.

## Install

Settings → Extensions → Install, with this repo's URL or a local path/file URL to a
checkout. The install directory must be named `aw-codex-policy`.

## How it works

- The extension's settings are the defaults a Codex dispatch starts from. Unset means
  core's default: `--sandbox workspace-write --ask-for-approval never`.
- The dialog shows the controls for Codex drafts only. It cannot read the settings, so
  it starts empty: an empty select or unticked box means "use the setting".
- The chosen policy is stored per session (`<AW_DATA_DIR>/aw-codex-policy/policies.json`),
  copied to forks and deleted on purge. Dispatches without the dialog (`spawn_session`,
  schedules) get the settings defaults.
- Approve-for-me implies workspace-write + on-request, so it replaces the sandbox and
  approval choices. Bypass replaces everything.

## Risks

- **Bypass is dangerous.** It runs model-generated commands with no sandbox and no
  approvals. The dialog says so when it is ticked; core never defaults to it.
- **`on-request` without approve-for-me stalls unattended sessions** (`spawn_session`,
  scheduled runs) on a prompt nobody sees.
- **The policy is re-resolved on every resume.** Disabling or uninstalling the
  extension, or losing its store file, silently reverts sessions to core defaults.

## Tests

```
npm test
```
