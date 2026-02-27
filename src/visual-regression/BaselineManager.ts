// ============================================================
// QIA — Baseline Manager
// Manages visual regression baseline screenshots
// ============================================================

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

const BASELINE_DIR = process.env['QIA_BASELINE_DIR'] ?? '.qia/baselines';

export interface BaselineEntry {
  name: string;
  viewport: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  checksum: string;
}

export class BaselineManager {
  private readonly indexPath: string;
  private readonly index: Map<string, BaselineEntry>;

  constructor() {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    this.indexPath = path.join(BASELINE_DIR, 'index.json');
    this.index = this.loadIndex();
  }

  exists(name: string, viewport: string): boolean {
    const key = this.key(name, viewport);
    return this.index.has(key) && fs.existsSync(this.baselinePath(name, viewport));
  }

  save(name: string, viewport: string, buffer: Buffer): string {
    const filePath = this.baselinePath(name, viewport);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, buffer);

    const key = this.key(name, viewport);
    const now = new Date().toISOString();
    const existing = this.index.get(key);

    this.index.set(key, {
      name,
      viewport,
      path: filePath,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      checksum: this.checksum(buffer),
    });

    this.saveIndex();
    console.log(chalk.blue(`[BaselineManager] Saved baseline: ${name} @ ${viewport}`));
    return filePath;
  }

  get(name: string, viewport: string): Buffer | null {
    if (!this.exists(name, viewport)) return null;
    return fs.readFileSync(this.baselinePath(name, viewport));
  }

  delete(name: string, viewport: string): void {
    const key = this.key(name, viewport);
    const filePath = this.baselinePath(name, viewport);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    this.index.delete(key);
    this.saveIndex();
  }

  listAll(): BaselineEntry[] {
    return Array.from(this.index.values());
  }

  private baselinePath(name: string, viewport: string): string {
    const safe = name.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(BASELINE_DIR, viewport, `${safe}.png`);
  }

  private key(name: string, viewport: string): string {
    return `${viewport}::${name}`;
  }

  private checksum(buffer: Buffer): string {
    let hash = 0;
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      if (byte !== undefined) {
        hash = ((hash << 5) - hash + byte) | 0;
      }
    }
    return Math.abs(hash).toString(16);
  }

  private loadIndex(): Map<string, BaselineEntry> {
    if (!fs.existsSync(this.indexPath)) return new Map();
    try {
      const raw = JSON.parse(fs.readFileSync(this.indexPath, 'utf-8')) as BaselineEntry[];
      return new Map(raw.map(e => [this.key(e.name, e.viewport), e]));
    } catch {
      return new Map();
    }
  }

  private saveIndex(): void {
    const entries = Array.from(this.index.values());
    fs.writeFileSync(this.indexPath, JSON.stringify(entries, null, 2));
  }
}
