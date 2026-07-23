export type EquipmentType = 'jam_pole' | 'cotterman';

export type EquipmentCondition = 'good' | 'slight_bend' | 'bad' | 'unavailable';

export interface Equipment {
  id: string;
  zone: string;
  location: string; // Descriptive text (e.g., "North Wall")
  floorLevel: string;
  itemArea: string; // Department/functional area (e.g., "Pack", "Ship")
  type: EquipmentType; // jam_pole (standalone) or cotterman
  identificationNumber: string; // Physical tag (e.g., JP-001)
  jamPoleQty: number; // How many poles at this location
  holder: boolean; // Is there a holder? Yes/No
  condition: EquipmentCondition;
  lastAuditDate: string; // ISO date
  notes?: string;
  mountedOn?: string; // Parent equipment ID if on a Cotterman
  lastModifiedBy: string;
  photoLink?: string; // URL to photo
  // Internal fields for map positioning
  mapX: number; // percentage position on map (0-100)
  mapY: number; // percentage position on map (0-100)
}

export interface IssueReport {
  id: string;
  equipmentId: string;
  reportedBy: string;
  reportedAt: string; // ISO datetime
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'open' | 'in_progress' | 'resolved';
  assignedTo?: string;
  resolvedAt?: string;
}

export interface ChangeLogEntry {
  id: string;
  equipmentId: string;
  equipmentIdNumber: string; // For display
  field: string; // Which field changed
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string; // ISO datetime
  changeType: 'condition_change' | 'quantity_change' | 'issue_reported' | 'issue_resolved' | 'created' | 'deleted' | 'edit';
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncedAt: string | null;
  pendingChanges: number;
  connectedUsers: number;
}

export interface UserInfo {
  alias: string;
  displayName: string;
}

// WebSocket event types
export interface WSEvents {
  'equipment:update': Equipment;
  'equipment:create': Equipment;
  'equipment:delete': string; // id
  'issue:create': IssueReport;
  'issue:update': IssueReport;
  'sync:status': SyncStatus;
  'user:joined': UserInfo;
  'user:left': UserInfo;
}
