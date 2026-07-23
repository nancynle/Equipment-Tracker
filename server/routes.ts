import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import type { ExcelSync } from './excel-sync';
import type { VersionManager } from './version-manager';
import { v4 as uuidv4 } from 'uuid';
import type { Equipment, IssueReport, ChangeLogEntry } from '../src/types';
import type { Server } from 'socket.io';

// Configure multer for floor plan uploads
const storage = multer.diskStorage({
  destination: path.join(process.cwd(), 'public'),
  filename: (_req, _file, cb) => {
    cb(null, 'floorplan.png');
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export const apiRouter = Router();

// GET /api/equipment - list all equipment
apiRouter.get('/equipment', async (req, res) => {
  try {
    const excelSync: ExcelSync = req.app.locals.excelSync;
    const equipment = await excelSync.getAllEquipment();
    res.json(equipment);
  } catch (err) {
    console.error('[API] Error fetching equipment:', err);
    res.status(500).json({ error: 'Failed to fetch equipment data' });
  }
});

// POST /api/equipment - create new equipment
apiRouter.post('/equipment', async (req, res) => {
  try {
    const excelSync: ExcelSync = req.app.locals.excelSync;
    const io: Server = req.app.locals.io;

    const equipment: Equipment = {
      ...req.body,
      id: req.body.id || uuidv4(),
      lastModifiedAt: new Date().toISOString(),
    };

    await excelSync.addEquipment(equipment);
    io.emit('equipment:create', equipment);
    res.status(201).json(equipment);
  } catch (err) {
    console.error('[API] Error creating equipment:', err);
    res.status(500).json({ error: 'Failed to create equipment' });
  }
});

// PUT /api/equipment/:id - update equipment
apiRouter.put('/equipment/:id', async (req, res) => {
  try {
    const excelSync: ExcelSync = req.app.locals.excelSync;
    const io: Server = req.app.locals.io;

    const equipment: Equipment = {
      ...req.body,
      id: req.params.id,
      lastModifiedAt: new Date().toISOString(),
    };

    await excelSync.updateEquipment(equipment);
    io.emit('equipment:update', equipment);
    res.json(equipment);
  } catch (err) {
    console.error('[API] Error updating equipment:', err);
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

// DELETE /api/equipment/:id - delete equipment
apiRouter.delete('/equipment/:id', async (req, res) => {
  try {
    const excelSync: ExcelSync = req.app.locals.excelSync;
    const io: Server = req.app.locals.io;

    await excelSync.deleteEquipment(req.params.id);
    io.emit('equipment:delete', req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error('[API] Error deleting equipment:', err);
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

// GET /api/issues - list all issues
apiRouter.get('/issues', async (req, res) => {
  try {
    const excelSync: ExcelSync = req.app.locals.excelSync;
    const issues = await excelSync.getAllIssues();
    res.json(issues);
  } catch (err) {
    console.error('[API] Error fetching issues:', err);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// POST /api/issues - report an issue
apiRouter.post('/issues', async (req, res) => {
  try {
    const excelSync: ExcelSync = req.app.locals.excelSync;
    const io: Server = req.app.locals.io;

    const issue: IssueReport = {
      ...req.body,
      id: req.body.id || uuidv4(),
      reportedAt: new Date().toISOString(),
      status: 'open',
    };

    await excelSync.addIssue(issue);
    io.emit('issue:create', issue);

    // TODO: Send notification to assignedTo person
    // Could integrate with SES, SNS, or Slack webhook here
    if (issue.assignedTo) {
      console.log(`[Notify] Issue ${issue.id} assigned to ${issue.assignedTo}: ${issue.description}`);
    }

    res.status(201).json(issue);
  } catch (err) {
    console.error('[API] Error creating issue:', err);
    res.status(500).json({ error: 'Failed to report issue' });
  }
});

// PUT /api/issues/:id - update issue status
apiRouter.put('/issues/:id', async (req, res) => {
  try {
    const excelSync: ExcelSync = req.app.locals.excelSync;
    const io: Server = req.app.locals.io;

    const issue: IssueReport = {
      ...req.body,
      id: req.params.id,
    };

    await excelSync.updateIssue(issue);
    io.emit('issue:update', issue);
    res.json(issue);
  } catch (err) {
    console.error('[API] Error updating issue:', err);
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

// GET /api/changelog - get change history
apiRouter.get('/changelog', async (req, res) => {
  try {
    const excelSync: ExcelSync = req.app.locals.excelSync;
    const entries = await excelSync.getChangeLog();
    res.json(entries);
  } catch (err) {
    console.error('[API] Error fetching changelog:', err);
    res.status(500).json({ error: 'Failed to fetch change log' });
  }
});

// GET /api/sync/status - get sync status
apiRouter.get('/sync/status', (_req, res) => {
  res.json({
    isOnline: true,
    lastSyncedAt: new Date().toISOString(),
    pendingChanges: 0,
  });
});

// POST /api/sync/refresh - force re-read from Excel
apiRouter.post('/sync/refresh', async (req, res) => {
  try {
    const excelSync: ExcelSync = req.app.locals.excelSync;
    const equipment = await excelSync.getAllEquipment();
    res.json({ equipment, refreshedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[API] Error refreshing sync:', err);
    res.status(500).json({ error: 'Failed to refresh from Excel' });
  }
});

// --- Versions ---

// GET /api/versions - list saved versions
apiRouter.get('/versions', async (req, res) => {
  try {
    const versionManager = req.app.locals.versionManager;
    const versions = await versionManager.listVersions();
    res.json(versions);
  } catch (err) {
    console.error('[API] Error listing versions:', err);
    res.status(500).json({ error: 'Failed to list versions' });
  }
});

// POST /api/versions - manually save a version
apiRouter.post('/versions', async (req, res) => {
  try {
    const versionManager = req.app.locals.versionManager;
    const reason = req.body.reason || 'manual-save';
    const filename = await versionManager.saveVersion(reason);
    res.status(201).json({ filename, savedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[API] Error saving version:', err);
    res.status(500).json({ error: 'Failed to save version' });
  }
});

// POST /api/versions/:filename/restore - restore a version
apiRouter.post('/versions/:filename/restore', async (req, res) => {
  try {
    const versionManager = req.app.locals.versionManager;
    const io: Server = req.app.locals.io;
    const excelSync: ExcelSync = req.app.locals.excelSync;

    await versionManager.restoreVersion(req.params.filename);

    // Reload data and broadcast to all clients
    const equipment = await excelSync.getAllEquipment();
    io.emit('sync:refresh', equipment);

    res.json({ restored: req.params.filename, restoredAt: new Date().toISOString() });
  } catch (err) {
    console.error('[API] Error restoring version:', err);
    res.status(500).json({ error: 'Failed to restore version' });
  }
});

// GET /api/download - download current Excel file
apiRouter.get('/download', (req, res) => {
  const excelSync: ExcelSync = req.app.locals.excelSync;
  const filePath = (excelSync as any).filePath;
  res.download(filePath, 'equipment-tracker.xlsx');
});

// POST /api/upload-floorplan - upload building floor plan image
apiRouter.post('/upload-floorplan', upload.single('floorplan'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  console.log(`[Upload] Floor plan saved: ${req.file.filename} (${req.file.size} bytes)`);
  res.json({ success: true, filename: req.file.filename, size: req.file.size });
});

// POST /api/import - import equipment from an existing Excel file
const importUpload = multer({
  dest: path.join(process.cwd(), 'data', 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

apiRouter.post('/import', importUpload.single('spreadsheet'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const excelSync: ExcelSync = req.app.locals.excelSync;
    const versionManager = req.app.locals.versionManager;
    const io: Server = req.app.locals.io;

    // Save a version before importing
    await versionManager.saveVersion('pre-import');

    // Run import
    const results = await excelSync.importFromFile(req.file.path);

    // Notify all connected clients to refresh
    const equipment = await excelSync.getAllEquipment();
    io.emit('sync:refresh', equipment);

    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(() => {});

    res.json({
      success: true,
      imported: results.imported,
      skipped: results.skipped,
      errors: results.errors,
      total: equipment.length,
    });
  } catch (err) {
    console.error('[API] Import error:', err);
    res.status(500).json({ error: 'Failed to import spreadsheet' });
  }
});

// GET /api/versions/:filename/download - download a specific version
apiRouter.get('/versions/:filename/download', (req, res) => {
  const versionManager = req.app.locals.versionManager;
  const versionsDir = (versionManager as any).versionsDir;
  const filePath = path.join(versionsDir, req.params.filename);
  res.download(filePath, req.params.filename);
});
