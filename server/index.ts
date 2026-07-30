import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { ExcelSync } from './excel-sync';
import { VersionManager } from './version-manager';
import { apiRouter } from './routes';

const PORT = process.env.PORT || 3001;
const EXCEL_PATH = process.env.EXCEL_PATH || path.join(process.cwd(), 'data', 'equipment.xlsx');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(express.json());

// Initialize Excel sync and version manager
const excelSync = new ExcelSync(EXCEL_PATH);
const versionManager = new VersionManager(EXCEL_PATH);

// Make services available to routes
app.locals.excelSync = excelSync;
app.locals.versionManager = versionManager;
app.locals.io = io;

// API routes
app.use('/api', apiRouter);

// Serve public folder (floor plan images, etc.)
app.use(express.static(path.join(process.cwd(), 'public')));

// Serve built frontend
app.use(express.static(path.join(process.cwd(), 'dist')));

// Fallback to index.html for client-side routing
app.get('*', (_req, res) => {
  const indexPath = path.join(process.cwd(), 'dist', 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send('Not found');
    }
  });
});

// Connected users tracking
const connectedUsers = new Map<string, { alias: string; displayName: string }>();

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // User registration
  socket.on('user:register', (user: { alias: string; displayName: string }) => {
    connectedUsers.set(socket.id, user);
    io.emit('user:joined', user);
    io.emit('sync:status', {
      isOnline: true,
      lastSyncedAt: new Date().toISOString(),
      pendingChanges: 0,
      connectedUsers: connectedUsers.size,
    });
    console.log(`[WS] User registered: ${user.alias} (${connectedUsers.size} total)`);
  });

  // Equipment update
  socket.on('equipment:update', async (equipment) => {
    try {
      // Check if this is a position change — save version first
      const allEquip = await excelSync.getAllEquipment();
      const existing = allEquip.find(e => e.id === equipment.id);

      if (existing && (existing.mapX !== equipment.mapX || existing.mapY !== equipment.mapY)) {
        await versionManager.saveVersion('position-change');
      }

      // Log meaningful changes (not just position moves)
      if (existing) {
        const fieldsToTrack = ['condition', 'jamPoleQty', 'holder', 'zone', 'location'];
        for (const field of fieldsToTrack) {
          const oldVal = String((existing as any)[field] || '');
          const newVal = String((equipment as any)[field] || '');
          if (oldVal !== newVal) {
            let changeType: string = 'edit';
            if (field === 'condition') changeType = 'condition_change';
            if (field === 'jamPoleQty' || field === 'jamHolder') changeType = 'quantity_change';

            await excelSync.addChangeLogEntry({
              id: crypto.randomUUID(),
              equipmentId: equipment.id,
              equipmentIdNumber: equipment.identificationNumber || '',
              field,
              oldValue: oldVal,
              newValue: newVal,
              changedBy: equipment.lastModifiedBy || 'unknown',
              changedAt: new Date().toISOString(),
              changeType: changeType as any,
            });
          }
        }
      }

      await excelSync.updateEquipment(equipment);
      socket.broadcast.emit('equipment:update', equipment);
      console.log(`[WS] Equipment updated: ${equipment.id}`);
    } catch (err) {
      socket.emit('error', { message: 'Failed to save equipment update' });
      console.error('[WS] Update error:', err);
    }
  });

  // Equipment create
  socket.on('equipment:create', async (equipment) => {
    try {
      await excelSync.addEquipment(equipment);
      socket.broadcast.emit('equipment:create', equipment);
      console.log(`[WS] Equipment created: ${equipment.id}`);

      // Log to change log
      await excelSync.addChangeLogEntry({
        id: crypto.randomUUID(),
        equipmentId: equipment.id,
        equipmentIdNumber: equipment.identificationNumber || '',
        field: 'equipment',
        oldValue: '',
        newValue: `${equipment.type} - ${equipment.zone} - ${equipment.location}`,
        changedBy: equipment.lastModifiedBy || 'unknown',
        changedAt: new Date().toISOString(),
        changeType: 'created',
      });
    } catch (err) {
      socket.emit('error', { message: 'Failed to create equipment' });
      console.error('[WS] Create error:', err);
    }
  });

  // Equipment delete
  socket.on('equipment:delete', async (id: string) => {
    try {
      // Get equipment info before deleting (for the log)
      const allEquip = await excelSync.getAllEquipment();
      const item = allEquip.find(e => e.id === id);

      // Save a version before deletion
      await versionManager.saveVersion('pre-delete');

      await excelSync.deleteEquipment(id);
      socket.broadcast.emit('equipment:delete', id);
      console.log(`[WS] Equipment deleted: ${id}`);

      // Log deletion
      if (item) {
        await excelSync.addChangeLogEntry({
          id: crypto.randomUUID(),
          equipmentId: id,
          equipmentIdNumber: item.identificationNumber || '',
          field: 'equipment',
          oldValue: `${item.type} - ${item.zone} - ${item.location}`,
          newValue: 'DELETED',
          changedBy: 'user',
          changedAt: new Date().toISOString(),
          changeType: 'deleted',
        });
      }
    } catch (err) {
      socket.emit('error', { message: 'Failed to delete equipment' });
      console.error('[WS] Delete error:', err);
    }
  });

  // Issue report
  socket.on('issue:create', async (issue) => {
    try {
      await excelSync.addIssue(issue);
      io.emit('issue:create', issue);
      console.log(`[WS] Issue reported: ${issue.id} for equipment ${issue.equipmentId}`);

      // Log to change log
      const allEquip = await excelSync.getAllEquipment();
      const eq = allEquip.find(e => e.id === issue.equipmentId);
      await excelSync.addChangeLogEntry({
        id: crypto.randomUUID(),
        equipmentId: issue.equipmentId,
        equipmentIdNumber: eq?.identificationNumber || '',
        field: 'issue',
        oldValue: '',
        newValue: `${issue.severity}: ${issue.description}`,
        changedBy: issue.reportedBy || 'unknown',
        changedAt: new Date().toISOString(),
        changeType: 'issue_reported',
      });
    } catch (err) {
      socket.emit('error', { message: 'Failed to report issue' });
      console.error('[WS] Issue error:', err);
    }
  });

  // Issue update
  socket.on('issue:update', async (issue) => {
    try {
      await excelSync.updateIssue(issue);
      socket.broadcast.emit('issue:update', issue);
    } catch (err) {
      socket.emit('error', { message: 'Failed to update issue' });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);
    if (user) {
      io.emit('user:left', user);
      io.emit('sync:status', {
        isOnline: true,
        lastSyncedAt: new Date().toISOString(),
        pendingChanges: 0,
        connectedUsers: connectedUsers.size,
      });
    }
    console.log(`[WS] Client disconnected: ${socket.id} (${connectedUsers.size} remaining)`);
  });
});

// Start server
async function start() {
  await excelSync.initialize();
  await versionManager.initialize();
  httpServer.listen(PORT, () => {
    console.log(`[Server] Equipment Tracker running on port ${PORT}`);
    console.log(`[Server] Excel file: ${EXCEL_PATH}`);
  });
}

start().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
