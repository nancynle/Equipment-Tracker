import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';

const MAX_VERSIONS = 20; // Keep last 20 versions

export class VersionManager {
  private versionsDir: string;
  private sourceFile: string;

  constructor(excelPath: string) {
    this.sourceFile = excelPath;
    this.versionsDir = path.join(path.dirname(excelPath), 'versions');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.versionsDir, { recursive: true });
  }

  /**
   * Save a snapshot of the current Excel file with a timestamp.
   * Called before any position change or on a schedule.
   */
  async saveVersion(reason: string = 'manual'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `equipment_${timestamp}_${reason}.xlsx`;
    const versionPath = path.join(this.versionsDir, filename);

    try {
      await fs.copyFile(this.sourceFile, versionPath);
      console.log(`[Version] Saved: ${filename}`);
      await this.pruneOldVersions();
      return filename;
    } catch (err) {
      console.error('[Version] Failed to save version:', err);
      throw err;
    }
  }

  /**
   * List all saved versions, newest first.
   */
  async listVersions(): Promise<VersionInfo[]> {
    try {
      const files = await fs.readdir(this.versionsDir);
      const versions: VersionInfo[] = [];

      for (const file of files) {
        if (!file.endsWith('.xlsx')) continue;
        const stat = await fs.stat(path.join(this.versionsDir, file));
        // Parse reason from filename: equipment_2026-07-16T20-45-00-000Z_position-change.xlsx
        const match = file.match(/^equipment_(.+?)_(.+?)\.xlsx$/);
        versions.push({
          filename: file,
          createdAt: stat.mtime.toISOString(),
          reason: match?.[2] || 'unknown',
          size: stat.size,
        });
      }

      return versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch {
      return [];
    }
  }

  /**
   * Restore a specific version — copies it back as the active file.
   * Saves current state as a "pre-restore" version first.
   */
  async restoreVersion(filename: string): Promise<void> {
    const versionPath = path.join(this.versionsDir, filename);

    // Verify version exists
    try {
      await fs.access(versionPath);
    } catch {
      throw new Error(`Version not found: ${filename}`);
    }

    // Save current state before restoring
    await this.saveVersion('pre-restore');

    // Restore
    await fs.copyFile(versionPath, this.sourceFile);
    console.log(`[Version] Restored: ${filename}`);
  }

  /**
   * Keep only the most recent MAX_VERSIONS files.
   */
  private async pruneOldVersions(): Promise<void> {
    const versions = await this.listVersions();
    if (versions.length <= MAX_VERSIONS) return;

    const toDelete = versions.slice(MAX_VERSIONS);
    for (const v of toDelete) {
      try {
        await fs.unlink(path.join(this.versionsDir, v.filename));
        console.log(`[Version] Pruned old version: ${v.filename}`);
      } catch {
        // Ignore deletion errors
      }
    }
  }
}

export interface VersionInfo {
  filename: string;
  createdAt: string;
  reason: string;
  size: number;
}
