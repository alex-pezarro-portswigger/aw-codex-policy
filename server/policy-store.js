import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './data-dir.js';
import { cleanPolicy } from './policy.js';

// `{ [sessionId]: policy }`, persisted as one JSON file written temp + rename so
// a crash never leaves it torn.
export class PolicyStore {
  constructor({ file = path.join(DATA_DIR, 'aw-codex-policy', 'policies.json'), log = () => {} } = {}) {
    this.file = file;
    this.log = log;
    this.map = this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (err) {
      if (err.code !== 'ENOENT') this.log(`policies.json unreadable, starting empty: ${err.message}`);
      return {};
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.map, null, 2));
    fs.renameSync(tmp, this.file);
  }

  get(id) {
    return Object.hasOwn(this.map, id) ? { ...this.map[id] } : undefined;
  }

  set(id, policy) {
    this.map[id] = cleanPolicy(policy);
    this._save();
  }

  copy(from, to) {
    const p = this.get(from);
    if (p === undefined) return false;
    this.set(to, p);
    return true;
  }

  delete(id) {
    if (!Object.hasOwn(this.map, id)) return false;
    delete this.map[id];
    this._save();
    return true;
  }
}
