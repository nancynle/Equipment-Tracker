import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs/promises';
import type { Equipment, IssueReport, ChangeLogEntry } from '../src/types';

const EQUIPMENT_SHEET = 'Equipment';
const ISSUES_SHEET = 'Issues';

const EQUIPMENT_COLUMNS = [
  { header: 'Zone', key: 'zone', width: 10 },
  { header: 'Location', key: 'location', width: 20 },
  { header: 'Floor Level', key: 'floorLevel', width: 12 },
  { header: 'Item Area', key: 'itemArea', width: 15 },
  { header: 'Equipment Type', key: 'type', width: 15 },
  { header: 'ID #', key: 'identificationNumber', width: 15 },
  { header: 'Jam Pole Qty', key: 'jamPoleQty', width: 12 },
  { header: 'Holder', key: 'holder', width: 8 },
  { header: 'Condition', key: 'condition', width: 12 },
  { header: 'Last Audit Date', key: 'lastAuditDate', width: 15 },
  { header: 'Notes', key: 'notes', width: 30 },
  { header: 'Mounted On', key: 'mountedOn', width: 15 },
  { header: 'Modified By', key: 'lastModifiedBy', width: 15 },
  { header: 'Photo Link', key: 'photoLink', width: 30 },
  // Internal fields
  { header: 'App ID', key: 'id', width: 20 },
  { header: 'Map X', key: 'mapX', width: 8 },
  { header: 'Map Y', key: 'mapY', width: 8 },
];

const ISSUE_COLUMNS = [
  { header: 'ID', key: 'id', width: 20 },
  { header: 'Equipment ID#', key: 'equipmentId', width: 20 },
  { header: 'Reported By', key: 'reportedBy', width: 20 },
  { header: 'Reported At', key: 'reportedAt', width: 25 },
  { header: 'Severity', key: 'severity', width: 12 },
  { header: 'Description', key: 'description', width: 50 },
  { header: 'Status', key: 'status', width: 15 },
  { header: 'Assigned To', key: 'assignedTo', width: 20 },
  { header: 'Resolved At', key: 'resolvedAt', width: 25 },
];

// Mapping from user's existing spreadsheet headers to our field names
// Uses normalized matching (lowercase, trimmed, common variations)
function matchHeader(header: string): string | null {
  const raw = header.toLowerCase().trim();
  const h = raw.replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  
  if (h.includes('location name') || h === 'location name') return '_skip';
  if (h === 'zone') return 'zone';
  if (h === 'location' || h === 'loc') return 'location';
  if (h.includes('floor')) return 'floorLevel';
  if (h.includes('item area') || h === 'area') return 'itemArea';
  if (h.includes('equipment type') || h === 'type') return 'type';
  if (h === 'id' || h === 'id number' || raw.includes('id #') || raw.includes('id#') || raw.includes('id ') || h.match(/^id\b/)) return 'identificationNumber';
  if (h.includes('jam pole') && (h.includes('qty') || h.includes('quant'))) return 'jamPoleQty';
  if (h.includes('jam') && h.includes('hold')) return 'holder';
  if (h.includes('holder')) return 'holder';
  if (h.includes('condition') || h === 'cond') return 'condition';
  if (h.includes('audit') || h.includes('last audit')) return 'lastAuditDate';
  if (h.includes('note')) return 'notes';
  if (h.includes('mounted')) return 'mountedOn';
  if (h.includes('status')) return '_skip';
  
  return null;
}

export class ExcelSync {
  private filePath: string;
  private workbook: ExcelJS.Workbook;
  private writeLock = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.workbook = new ExcelJS.Workbook();
  }

  async initialize(): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });

    try {
      await fs.access(this.filePath);
      await this.workbook.xlsx.readFile(this.filePath);
      // Verify the file has data
      const sheet = this.workbook.getWorksheet(EQUIPMENT_SHEET);
      const rowCount = sheet ? sheet.rowCount : 0;
      console.log(`[Excel] Loaded existing workbook: ${this.filePath} (${rowCount} rows in Equipment sheet)`);
    } catch (err) {
      console.log(`[Excel] Could not load file (${err}), creating new workbook`);
      this.createDefaultSheets();
      await this.save();
      console.log('[Excel] Created new workbook');
    }
  }

  private createDefaultSheets(): void {
    const equipSheet = this.workbook.addWorksheet(EQUIPMENT_SHEET);
    equipSheet.columns = EQUIPMENT_COLUMNS;
    this.styleHeader(equipSheet);

    const issueSheet = this.workbook.addWorksheet(ISSUES_SHEET);
    issueSheet.columns = ISSUE_COLUMNS;
    this.styleHeader(issueSheet);
  }

  private styleHeader(sheet: ExcelJS.Worksheet): void {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF232F3E' },
    };
    headerRow.alignment = { vertical: 'middle' };
  }

  private reassignColumnKeys(sheet: ExcelJS.Worksheet, columns: { key: string }[]): void {
    columns.forEach((col, idx) => {
      const column = sheet.getColumn(idx + 1);
      column.key = col.key;
    });
  }

  private async save(): Promise<void> {
    while (this.writeLock) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    this.writeLock = true;
    try {
      await this.workbook.xlsx.writeFile(this.filePath);
    } finally {
      this.writeLock = false;
    }
  }

  // --- Import from existing spreadsheet ---

  async importFromFile(filePath: string): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const importWorkbook = new ExcelJS.Workbook();
    await importWorkbook.xlsx.readFile(filePath);

    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    // Save existing positions before replacing data
    const existingEquipment = await this.getAllEquipment();
    const positionMap = new Map<string, { mapX: number; mapY: number }>();
    for (const eq of existingEquipment) {
      // Key by zone+location to match items across imports (case-insensitive)
      const key = `${eq.zone}|${eq.location}`.toLowerCase();
      if (eq.mapX !== 50 || eq.mapY !== 50) {
        // Only save positions that have been moved from default center
        positionMap.set(key, { mapX: eq.mapX, mapY: eq.mapY });
      }
    }

    // Clear existing equipment data (replace mode)
    const existingSheet = this.workbook.getWorksheet(EQUIPMENT_SHEET);
    if (existingSheet) {
      this.workbook.removeWorksheet(existingSheet.id);
    }
    const newSheet = this.workbook.addWorksheet(EQUIPMENT_SHEET);
    newSheet.columns = EQUIPMENT_COLUMNS;
    this.styleHeader(newSheet);

    // Try first sheet
    const sheet = importWorkbook.worksheets[0];
    if (!sheet) {
      results.errors.push('No worksheets found in uploaded file');
      return results;
    }

    // Read header row and map columns
    const headerRow = sheet.getRow(1);
    const columnMap: Record<number, string> = {};

    headerRow.eachCell((cell, colNumber) => {
      const header = String(cell.value || '');
      const fieldName = matchHeader(header);
      console.log(`[Import] Column ${colNumber}: "${header}" → ${fieldName || '(not matched)'}`);
      if (fieldName && fieldName !== '_skip') {
        columnMap[colNumber] = fieldName;
      }
    });

    if (Object.keys(columnMap).length === 0) {
      results.errors.push('Could not match any column headers. Expected: Location Name, Zone, Location, Floor Level, Item Area, Equipment Type, ID #, Jam Pole Qty, Jam Holder, Condition, Last Audit Date, Notes');
      return results;
    }

    console.log(`[Import] Mapped columns:`, columnMap);

    // Read data rows
    const equipment: Equipment[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      try {
        const item: Partial<Equipment> = {};

        for (const [colNum, fieldName] of Object.entries(columnMap)) {
          const value = row.getCell(Number(colNum)).value;
          const strValue = value != null ? String(value).trim() : '';

          switch (fieldName) {
            case 'zone': item.zone = strValue; break;
            case 'location': item.location = strValue; break;
            case 'floorLevel': item.floorLevel = strValue; break;
            case 'itemArea': item.itemArea = strValue; break;
            case 'type':
              const typeStr = strValue.toLowerCase();
              if (typeStr.includes('cotterman') || typeStr.includes('ladder')) item.type = 'cotterman';
              else item.type = 'jam_pole';
              break;
            case 'itemArea':
              item.itemArea = strValue;
              // Auto-detect type from item area if type wasn't explicitly set
              if (!item.type) {
                const areaLower = strValue.toLowerCase();
                if (areaLower.includes('cotterman') || areaLower.includes('ladder')) item.type = 'cotterman';
              }
              break;
            case 'identificationNumber': item.identificationNumber = strValue; break;
            case 'jamPoleQty': item.jamPoleQty = Number(value) || 0; break;
            case 'holder':
              const holderStr = strValue.toLowerCase();
              item.holder = holderStr === 'yes' || holderStr === 'y' || holderStr === 'true' || holderStr === '1' || Number(value) > 0;
              break;
            case 'condition':
              const condStr = strValue.toLowerCase();
              if (condStr.includes('bad') || condStr.includes('poor') || condStr.includes('damaged')) item.condition = 'bad';
              else if (condStr.includes('unavailable') || condStr.includes('n/a') || condStr.includes('out')) item.condition = 'unavailable';
              else if (condStr.includes('slight') || condStr.includes('bend') || condStr.includes('fair') || condStr.includes('neutral')) item.condition = 'slight_bend';
              else item.condition = 'good';
              break;
            case 'lastAuditDate':
              if (value instanceof Date) {
                item.lastAuditDate = value.toISOString().split('T')[0];
              } else {
                item.lastAuditDate = strValue;
              }
              break;
            case 'notes': item.notes = strValue || undefined; break;
            case 'mountedOn': item.mountedOn = strValue || undefined; break;
          }
        }

        // Skip completely empty rows
        if (!item.identificationNumber && !item.zone && !item.location) {
          results.skipped++;
          return;
        }

        const fullItem: Equipment = {
          id: crypto.randomUUID(),
          zone: item.zone || '',
          location: item.location || '',
          floorLevel: item.floorLevel || '1',
          itemArea: item.itemArea || '',
          type: item.type || (item.itemArea?.toLowerCase().includes('cotterman') || item.itemArea?.toLowerCase().includes('ladder') ? 'cotterman' : 'jam_pole'),
          identificationNumber: item.identificationNumber || `ROW-${rowNumber}`,
          jamPoleQty: item.jamPoleQty || 0,
          holder: item.holder ?? false,
          condition: item.condition || 'good',
          lastAuditDate: item.lastAuditDate || '',
          notes: item.notes,
          mountedOn: item.mountedOn,
          lastModifiedBy: 'import',
          mapX: 50,
          mapY: 50,
        };

        // Restore saved position if this item was previously positioned
        const posKey = `${fullItem.zone}|${fullItem.location}`.toLowerCase();
        const savedPos = positionMap.get(posKey);
        if (savedPos) {
          fullItem.mapX = savedPos.mapX;
          fullItem.mapY = savedPos.mapY;
        }

        equipment.push(fullItem);
        results.imported++;
      } catch (err) {
        results.errors.push(`Row ${rowNumber}: ${err}`);
        results.skipped++;
      }
    });

    // Write all imported items to our workbook
    for (const item of equipment) {
      await this.addEquipment(item);
    }

    console.log(`[Import] Done: ${results.imported} imported, ${results.skipped} skipped`);
    return results;
  }

  // --- Equipment CRUD ---

  async getAllEquipment(): Promise<Equipment[]> {
    try {
      await this.workbook.xlsx.readFile(this.filePath);
    } catch {
      // File might be locked, use cached version
    }

    const sheet = this.workbook.getWorksheet(EQUIPMENT_SHEET);
    if (!sheet) return [];

    this.reassignColumnKeys(sheet, EQUIPMENT_COLUMNS);

    const equipment: Equipment[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const item: Equipment = {
        id: String(row.getCell('id').value || ''),
        zone: String(row.getCell('zone').value || ''),
        location: String(row.getCell('location').value || ''),
        floorLevel: String(row.getCell('floorLevel').value || ''),
        itemArea: String(row.getCell('itemArea').value || ''),
        type: String(row.getCell('type').value || 'jam_pole') as Equipment['type'],
        identificationNumber: String(row.getCell('identificationNumber').value || ''),
        jamPoleQty: Number(row.getCell('jamPoleQty').value) || 0,
        holder: (() => {
          const v = row.getCell('holder').value;
          if (typeof v === 'boolean') return v;
          const s = String(v || '').toLowerCase();
          return s === 'yes' || s === 'y' || s === 'true' || s === '1';
        })(),
        condition: String(row.getCell('condition').value || 'good') as Equipment['condition'],
        lastAuditDate: String(row.getCell('lastAuditDate').value || ''),
        notes: String(row.getCell('notes').value || '') || undefined,
        mountedOn: String(row.getCell('mountedOn').value || '') || undefined,
        lastModifiedBy: String(row.getCell('lastModifiedBy').value || ''),
        photoLink: String(row.getCell('photoLink').value || '') || undefined,
        mapX: Number(row.getCell('mapX').value) || 50,
        mapY: Number(row.getCell('mapY').value) || 50,
      };

      if (item.id || item.identificationNumber) {
        if (!item.id) {
          item.id = crypto.randomUUID();
        }
        equipment.push(item);
      }
    });

    return equipment;
  }

  async addEquipment(equipment: Equipment): Promise<void> {
    const sheet = this.workbook.getWorksheet(EQUIPMENT_SHEET);
    if (!sheet) throw new Error('Equipment sheet not found');

    this.reassignColumnKeys(sheet, EQUIPMENT_COLUMNS);

    sheet.addRow({
      zone: equipment.zone,
      location: equipment.location,
      floorLevel: equipment.floorLevel,
      itemArea: equipment.itemArea,
      type: equipment.type,
      identificationNumber: equipment.identificationNumber,
      jamPoleQty: equipment.jamPoleQty,
      holder: equipment.holder ? 'Yes' : 'No',
      condition: equipment.condition,
      lastAuditDate: equipment.lastAuditDate,
      notes: equipment.notes || '',
      mountedOn: equipment.mountedOn || '',
      lastModifiedBy: equipment.lastModifiedBy,
      photoLink: equipment.photoLink || '',
      id: equipment.id,
      mapX: equipment.mapX,
      mapY: equipment.mapY,
    });

    await this.save();
  }

  async updateEquipment(equipment: Equipment): Promise<void> {
    const sheet = this.workbook.getWorksheet(EQUIPMENT_SHEET);
    if (!sheet) throw new Error('Equipment sheet not found');

    this.reassignColumnKeys(sheet, EQUIPMENT_COLUMNS);

    let found = false;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (String(row.getCell('id').value) === equipment.id) {
        row.getCell('zone').value = equipment.zone;
        row.getCell('location').value = equipment.location;
        row.getCell('floorLevel').value = equipment.floorLevel;
        row.getCell('itemArea').value = equipment.itemArea;
        row.getCell('type').value = equipment.type;
        row.getCell('identificationNumber').value = equipment.identificationNumber;
        row.getCell('jamPoleQty').value = equipment.jamPoleQty;
        row.getCell('holder').value = equipment.holder ? 'Yes' : 'No';
        row.getCell('condition').value = equipment.condition;
        row.getCell('lastAuditDate').value = equipment.lastAuditDate;
        row.getCell('notes').value = equipment.notes || '';
        row.getCell('mountedOn').value = equipment.mountedOn || '';
        row.getCell('lastModifiedBy').value = equipment.lastModifiedBy;
        row.getCell('photoLink').value = equipment.photoLink || '';
        row.getCell('mapX').value = equipment.mapX;
        row.getCell('mapY').value = equipment.mapY;
        found = true;
      }
    });

    if (!found) {
      await this.addEquipment(equipment);
      return;
    }

    await this.save();
  }

  async deleteEquipment(id: string): Promise<void> {
    const sheet = this.workbook.getWorksheet(EQUIPMENT_SHEET);
    if (!sheet) throw new Error('Equipment sheet not found');

    this.reassignColumnKeys(sheet, EQUIPMENT_COLUMNS);

    let targetRow: number | null = null;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (String(row.getCell('id').value) === id) {
        targetRow = rowNumber;
      }
    });

    if (targetRow) {
      sheet.spliceRows(targetRow, 1);
      await this.save();
    }
  }

  // --- Issues ---

  async getAllIssues(): Promise<IssueReport[]> {
    const sheet = this.workbook.getWorksheet(ISSUES_SHEET);
    if (!sheet) return [];

    this.reassignColumnKeys(sheet, ISSUE_COLUMNS);

    const issues: IssueReport[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const issue: IssueReport = {
        id: String(row.getCell('id').value || ''),
        equipmentId: String(row.getCell('equipmentId').value || ''),
        reportedBy: String(row.getCell('reportedBy').value || ''),
        reportedAt: String(row.getCell('reportedAt').value || ''),
        severity: String(row.getCell('severity').value || 'medium') as IssueReport['severity'],
        description: String(row.getCell('description').value || ''),
        status: String(row.getCell('status').value || 'open') as IssueReport['status'],
        assignedTo: String(row.getCell('assignedTo').value || '') || undefined,
        resolvedAt: String(row.getCell('resolvedAt').value || '') || undefined,
      };

      if (issue.id) {
        issues.push(issue);
      }
    });

    return issues;
  }

  async addIssue(issue: IssueReport): Promise<void> {
    const sheet = this.workbook.getWorksheet(ISSUES_SHEET);
    if (!sheet) throw new Error('Issues sheet not found');

    this.reassignColumnKeys(sheet, ISSUE_COLUMNS);

    sheet.addRow({
      id: issue.id,
      equipmentId: issue.equipmentId,
      reportedBy: issue.reportedBy,
      reportedAt: issue.reportedAt,
      severity: issue.severity,
      description: issue.description,
      status: issue.status,
      assignedTo: issue.assignedTo || '',
      resolvedAt: issue.resolvedAt || '',
    });

    await this.save();
  }

  async updateIssue(issue: IssueReport): Promise<void> {
    const sheet = this.workbook.getWorksheet(ISSUES_SHEET);
    if (!sheet) throw new Error('Issues sheet not found');

    this.reassignColumnKeys(sheet, ISSUE_COLUMNS);

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (String(row.getCell('id').value) === issue.id) {
        row.getCell('status').value = issue.status;
        row.getCell('assignedTo').value = issue.assignedTo || '';
        row.getCell('resolvedAt').value = issue.resolvedAt || '';
      }
    });

    await this.save();
  }

  // --- Change Log ---

  async addChangeLogEntry(entry: ChangeLogEntry): Promise<void> {
    let sheet = this.workbook.getWorksheet('Change Log');
    if (!sheet) {
      sheet = this.workbook.addWorksheet('Change Log');
      sheet.columns = [
        { header: 'ID', key: 'id', width: 20 },
        { header: 'Equipment ID', key: 'equipmentId', width: 20 },
        { header: 'Equipment ID#', key: 'equipmentIdNumber', width: 15 },
        { header: 'Field', key: 'field', width: 15 },
        { header: 'Old Value', key: 'oldValue', width: 20 },
        { header: 'New Value', key: 'newValue', width: 20 },
        { header: 'Changed By', key: 'changedBy', width: 15 },
        { header: 'Changed At', key: 'changedAt', width: 25 },
        { header: 'Change Type', key: 'changeType', width: 18 },
      ];
      this.styleHeader(sheet);
    }

    sheet.addRow({
      id: entry.id,
      equipmentId: entry.equipmentId,
      equipmentIdNumber: entry.equipmentIdNumber,
      field: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      changedBy: entry.changedBy,
      changedAt: entry.changedAt,
      changeType: entry.changeType,
    });

    await this.save();
  }

  async getChangeLog(): Promise<ChangeLogEntry[]> {
    let sheet = this.workbook.getWorksheet('Change Log');
    if (!sheet) return [];

    const columns = [
      { key: 'id' }, { key: 'equipmentId' }, { key: 'equipmentIdNumber' },
      { key: 'field' }, { key: 'oldValue' }, { key: 'newValue' },
      { key: 'changedBy' }, { key: 'changedAt' }, { key: 'changeType' },
    ];
    this.reassignColumnKeys(sheet, columns);

    const entries: ChangeLogEntry[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      entries.push({
        id: String(row.getCell('id').value || ''),
        equipmentId: String(row.getCell('equipmentId').value || ''),
        equipmentIdNumber: String(row.getCell('equipmentIdNumber').value || ''),
        field: String(row.getCell('field').value || ''),
        oldValue: String(row.getCell('oldValue').value || ''),
        newValue: String(row.getCell('newValue').value || ''),
        changedBy: String(row.getCell('changedBy').value || ''),
        changedAt: String(row.getCell('changedAt').value || ''),
        changeType: String(row.getCell('changeType').value || 'edit') as ChangeLogEntry['changeType'],
      });
    });

    return entries;
  }
}
