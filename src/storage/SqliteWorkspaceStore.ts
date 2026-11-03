import type { WorkspaceRecoveryCopy, WorkspaceRecoveryStore } from './BrowserWorkspaceStore';
import { sqliteRequest } from './sqlite/sqliteClient';

export class SqliteWorkspaceStore implements WorkspaceRecoveryStore {
  load(): Promise<WorkspaceRecoveryCopy | undefined> { return sqliteRequest({ action: 'load' }); }
  save(copy: WorkspaceRecoveryCopy, expectedRevision: string | null): Promise<void> {
    return sqliteRequest({ action: 'save', payload: { copy, expectedRevision } });
  }
}
