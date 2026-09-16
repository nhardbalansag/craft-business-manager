import { describe, expect, it } from 'vitest';
import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from '../domain/businessDataset';
import {
  CURRENT_WORKBOOK_VERSION_KEY,
  PRODUCTION_WORKBOOK_MIGRATION_STEPS,
  WorkbookMigrationRegistry,
  WorkbookMigrationRegistryError,
  classifyWorkbookCompatibility,
  cloneWorkbookNeutralDocument,
  preflightWorkbookVersion,
  type WorkbookMigrationStep,
  type WorkbookVersionKey,
} from './workbookCompatibility';
import {
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
  type WorkbookNeutralDocument,
} from './workbookSchema';

function version(workbookFormatVersion: number, datasetSchemaVersion: number): WorkbookVersionKey {
  return { workbookFormatVersion, datasetSchemaVersion };
}

function createMinimalDocument(
  workbookFormatVersion: number = CURRENT_WORKBOOK_FORMAT_VERSION,
  datasetSchemaVersion: number = CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
  formatId: unknown = CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
): WorkbookNeutralDocument {
  return {
    sheets: [
      {
        name: '_Meta',
        columns: ['formatId', 'workbookFormatVersion', 'datasetSchemaVersion'],
        rows: [{ formatId, workbookFormatVersion, datasetSchemaVersion }],
      },
    ],
  };
}

function step(from: WorkbookVersionKey, to: WorkbookVersionKey): WorkbookMigrationStep {
  return {
    from,
    to,
    migrate(document) {
      return cloneWorkbookNeutralDocument(document);
    },
  };
}

function errorCode(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return error instanceof WorkbookMigrationRegistryError ? error.code : undefined;
  }
}

describe('Phase 5.4A1 workbook compatibility foundation', () => {
  it('preflights current version metadata without requiring current business sheets', () => {
    expect(preflightWorkbookVersion(createMinimalDocument())).toEqual({
      ok: true,
      metadata: {
        formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
        workbookFormatVersion: 1,
        datasetSchemaVersion: 1,
      },
    });
  });

  it('rejects a missing _Meta sheet without heuristic legacy detection', () => {
    expect(
      preflightWorkbookVersion({ sheets: [{ name: 'Materials', rows: [], columns: [] }] }),
    ).toEqual({
      ok: false,
      issues: [expect.objectContaining({ code: 'MISSING_META_SHEET' })],
    });
  });

  it('rejects duplicate _Meta sheets deterministically', () => {
    const meta = createMinimalDocument().sheets[0];
    expect(preflightWorkbookVersion({ sheets: [meta, meta] })).toEqual({
      ok: false,
      issues: [expect.objectContaining({ code: 'DUPLICATE_META_SHEET', input: 2 })],
    });
  });

  it('requires exactly one authoritative metadata row', () => {
    expect(
      preflightWorkbookVersion({ sheets: [{ name: '_Meta', columns: [], rows: [] }] }),
    ).toEqual({
      ok: false,
      issues: [expect.objectContaining({ code: 'INVALID_META_ROW_COUNT', input: 0 })],
    });
  });

  it('rejects the wrong format identity before migration classification', () => {
    expect(preflightWorkbookVersion(createMinimalDocument(1, 1, 'other-app'))).toEqual({
      ok: false,
      issues: [expect.objectContaining({ code: 'INVALID_FORMAT_ID', input: 'other-app' })],
    });
  });

  it('reports invalid version shapes in stable workbook-then-dataset order', () => {
    expect(preflightWorkbookVersion(createMinimalDocument(0, 1.5))).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({ code: 'INVALID_WORKBOOK_FORMAT_VERSION', input: 0 }),
        expect.objectContaining({ code: 'INVALID_DATASET_SCHEMA_VERSION', input: 1.5 }),
      ],
    });
  });

  it('classifies the public v1/v1 contract as current with an empty production registry', () => {
    expect(PRODUCTION_WORKBOOK_MIGRATION_STEPS).toEqual([]);
    expect(CURRENT_WORKBOOK_VERSION_KEY).toEqual(version(1, 1));
    expect(classifyWorkbookCompatibility(createMinimalDocument())).toEqual({
      status: 'current',
      metadata: {
        formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
        workbookFormatVersion: 1,
        datasetSchemaVersion: 1,
      },
      version: version(1, 1),
    });
  });

  it('classifies any future version axis as unsupported future', () => {
    expect(classifyWorkbookCompatibility(createMinimalDocument(2, 1))).toEqual(
      expect.objectContaining({ status: 'unsupported-future' }),
    );
    expect(classifyWorkbookCompatibility(createMinimalDocument(1, 2))).toEqual(
      expect.objectContaining({ status: 'unsupported-future' }),
    );
  });

  it('classifies an older synthetic pair without a registered path as unsupported older', () => {
    const target = version(3, 3);
    expect(
      classifyWorkbookCompatibility(
        createMinimalDocument(1, 2),
        new WorkbookMigrationRegistry([]),
        target,
      ),
    ).toEqual({
      status: 'unsupported-older',
      metadata: {
        formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
        workbookFormatVersion: 1,
        datasetSchemaVersion: 2,
      },
      version: version(1, 2),
      target,
    });
  });

  it('classifies an older synthetic pair with an exact registered path as migratable', () => {
    const registry = new WorkbookMigrationRegistry([
      step(version(1, 1), version(2, 1)),
      step(version(2, 1), version(2, 2)),
    ]);
    const classification = classifyWorkbookCompatibility(
      createMinimalDocument(1, 1),
      registry,
      version(2, 2),
    );

    expect(classification.status).toBe('migratable');
    if (classification.status === 'migratable') {
      expect(classification.path.map((candidate) => [candidate.from, candidate.to])).toEqual([
        [version(1, 1), version(2, 1)],
        [version(2, 1), version(2, 2)],
      ]);
    }
  });

  it('resolves deterministic single-step and multi-step paths', () => {
    const registry = new WorkbookMigrationRegistry([
      step(version(1, 1), version(2, 1)),
      step(version(2, 1), version(2, 2)),
      step(version(2, 2), version(3, 2)),
    ]);

    expect(registry.resolvePath(version(1, 1), version(2, 1))?.length).toBe(1);
    expect(registry.resolvePath(version(1, 1), version(3, 2))?.length).toBe(3);
    expect(registry.resolvePath(version(3, 2), version(3, 2))).toEqual([]);
  });

  it('returns null when an exact migration path is unavailable', () => {
    const registry = new WorkbookMigrationRegistry([step(version(1, 1), version(2, 1))]);
    expect(registry.resolvePath(version(1, 1), version(2, 2))).toBeNull();
    expect(registry.resolvePath(version(2, 1), version(1, 1))).toBeNull();
  });

  it('rejects duplicate or ambiguous migration sources', () => {
    expect(
      errorCode(
        () =>
          new WorkbookMigrationRegistry([
            step(version(1, 1), version(2, 1)),
            step(version(1, 1), version(1, 2)),
          ]),
      ),
    ).toBe('DUPLICATE_SOURCE');
  });

  it('rejects migration self-loops', () => {
    expect(
      errorCode(() => new WorkbookMigrationRegistry([step(version(1, 1), version(1, 1))])),
    ).toBe('SELF_LOOP');
  });

  it('detects registry cycles explicitly', () => {
    expect(
      errorCode(
        () =>
          new WorkbookMigrationRegistry([
            step(version(1, 1), version(2, 1)),
            step(version(2, 1), version(1, 1)),
          ]),
      ),
    ).toBe('CYCLE_DETECTED');
  });

  it('rejects non-cyclic steps that downgrade either version axis', () => {
    expect(
      errorCode(() => new WorkbookMigrationRegistry([step(version(2, 2), version(1, 2))])),
    ).toBe('DOWNGRADE_NOT_ALLOWED');
    expect(
      errorCode(() => new WorkbookMigrationRegistry([step(version(2, 2), version(2, 1))])),
    ).toBe('DOWNGRADE_NOT_ALLOWED');
  });

  it('defensively owns registered version keys', () => {
    const from = { workbookFormatVersion: 1, datasetSchemaVersion: 1 };
    const to = { workbookFormatVersion: 2, datasetSchemaVersion: 1 };
    const registry = new WorkbookMigrationRegistry([step(from, to)]);

    from.workbookFormatVersion = 9;
    to.workbookFormatVersion = 9;

    const path = registry.resolvePath(version(1, 1), version(2, 1));
    expect(path).toHaveLength(1);
    expect(path?.[0].from).toEqual(version(1, 1));
    expect(path?.[0].to).toEqual(version(2, 1));
  });

  it('provides defensive neutral-workbook ownership for pure migration fixtures', () => {
    const source: WorkbookNeutralDocument = {
      sheets: [
        {
          name: '_Meta',
          columns: ['formatId', 'workbookFormatVersion', 'datasetSchemaVersion', 'probe'],
          rows: [
            {
              formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
              workbookFormatVersion: 1,
              datasetSchemaVersion: 1,
              probe: { formula: '1+1', cachedValue: { nested: ['original'] } },
            },
          ],
        },
      ],
    };

    const migrated = cloneWorkbookNeutralDocument(source);
    const migratedProbe = migrated.sheets[0].rows[0].probe as {
      formula: string;
      cachedValue: { nested: string[] };
    };
    migratedProbe.cachedValue.nested[0] = 'changed';

    expect(
      (source.sheets[0].rows[0].probe as { cachedValue: { nested: string[] } }).cachedValue
        .nested[0],
    ).toBe('original');
  });
});
