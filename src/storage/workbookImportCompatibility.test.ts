import { describe, expect, it } from 'vitest';
import {
  WorkbookMigrationRegistry,
  cloneWorkbookNeutralDocument,
  type WorkbookMigrationStep,
  type WorkbookVersionKey,
} from './workbookCompatibility';
import { prepareWorkbookForCurrentImport } from './workbookImportCompatibility';
import { CRAFT_BUSINESS_WORKBOOK_FORMAT_ID, type WorkbookNeutralDocument } from './workbookSchema';

function version(workbookFormatVersion: number, datasetSchemaVersion: number): WorkbookVersionKey {
  return { workbookFormatVersion, datasetSchemaVersion };
}

function documentAt(
  workbookFormatVersion: number,
  datasetSchemaVersion: number,
): WorkbookNeutralDocument {
  return {
    sheets: [
      {
        name: '_Meta',
        columns: ['formatId', 'workbookFormatVersion', 'datasetSchemaVersion', 'probe'],
        rows: [
          {
            formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
            workbookFormatVersion,
            datasetSchemaVersion,
            probe: { nested: ['source'] },
          },
        ],
      },
    ],
  };
}

function rewriteVersion(
  document: WorkbookNeutralDocument,
  target: WorkbookVersionKey,
): WorkbookNeutralDocument {
  const output = cloneWorkbookNeutralDocument(document);
  const meta = output.sheets[0].rows[0] as Record<string, unknown>;
  meta.workbookFormatVersion = target.workbookFormatVersion;
  meta.datasetSchemaVersion = target.datasetSchemaVersion;
  return output;
}

function step(from: WorkbookVersionKey, to: WorkbookVersionKey): WorkbookMigrationStep {
  return {
    from,
    to,
    migrate(document) {
      return rewriteVersion(document, to);
    },
  };
}

describe('Phase 5.4A2 workbook import compatibility preparation', () => {
  it('returns a defensive current-form document without requiring current business sheets', () => {
    const source = documentAt(2, 1);
    const result = prepareWorkbookForCurrentImport(source);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(false);
    expect(result.sourceVersion).toEqual(version(2, 1));
    expect(result.targetVersion).toEqual(version(2, 1));
    expect(result.document).toEqual(source);
    expect(result.document).not.toBe(source);
    expect(result.document.sheets[0]).not.toBe(source.sheets[0]);
  });

  it('migrates a v1 Products sheet to v2 with a blank preferred Yield reference', () => {
    const source: WorkbookNeutralDocument = {
      sheets: [
        {
          name: '_Meta',
          columns: ['formatId', 'workbookFormatVersion', 'datasetSchemaVersion'],
          rows: [{
            formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
            workbookFormatVersion: 1,
            datasetSchemaVersion: 1,
          }],
        },
        {
          name: 'Products',
          columns: ['id', 'name', 'category', 'mixPresetId', 'safetyWasteRate', 'notes', 'isActive'],
          rows: [{
            id: 'PROD-LEGACY',
            name: 'Legacy product',
            category: 'paintable-art',
            mixPresetId: undefined,
            safetyWasteRate: 0.05,
            notes: undefined,
            isActive: true,
          }],
        },
      ],
    };

    const result = prepareWorkbookForCurrentImport(source);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(true);
    expect(result.sourceVersion).toEqual(version(1, 1));
    expect(result.targetVersion).toEqual(version(2, 1));

    const meta = result.document.sheets.find((sheet) => sheet.name === '_Meta')!;
    const products = result.document.sheets.find((sheet) => sheet.name === 'Products')!;
    expect(meta.rows[0].workbookFormatVersion).toBe(2);
    expect(products.columns).toEqual([
      'id',
      'name',
      'category',
      'mixPresetId',
      'preferredYieldSampleId',
      'safetyWasteRate',
      'notes',
      'isActive',
    ]);
    expect(products.rows[0].preferredYieldSampleId).toBeUndefined();
    expect(source.sheets[1].columns).not.toContain('preferredYieldSampleId');
  });

  it('preserves structured missing-metadata preflight diagnostics', () => {
    const result = prepareWorkbookForCurrentImport({ sheets: [] });
    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          stage: 'preflight',
          code: 'MISSING_META_SHEET',
          targetVersion: version(2, 1),
        }),
      ],
    });
  });

  it('fails closed when any source version axis is newer than the target', () => {
    const result = prepareWorkbookForCurrentImport(documentAt(3, 1));
    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          stage: 'compatibility',
          code: 'UNSUPPORTED_FUTURE_VERSION',
          compatibilityStatus: 'unsupported-future',
          sourceVersion: version(3, 1),
          targetVersion: version(2, 1),
        }),
      ],
    });
  });

  it('reports an unsupported older synthetic pair as an exact migration-path miss', () => {
    const target = version(3, 3);
    const result = prepareWorkbookForCurrentImport(
      documentAt(1, 2),
      new WorkbookMigrationRegistry([]),
      target,
    );
    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          stage: 'compatibility',
          code: 'MIGRATION_PATH_NOT_FOUND',
          compatibilityStatus: 'unsupported-older',
          sourceVersion: version(1, 2),
          targetVersion: target,
        }),
      ],
    });
  });

  it('executes a registered single-step synthetic migration deterministically', () => {
    const target = version(2, 2);
    const registry = new WorkbookMigrationRegistry([step(version(1, 1), target)]);
    const result = prepareWorkbookForCurrentImport(documentAt(1, 1), registry, target);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migrated).toBe(true);
    expect(result.sourceVersion).toEqual(version(1, 1));
    expect(result.targetVersion).toEqual(target);
    expect(result.document.sheets[0].rows[0]).toEqual(
      expect.objectContaining({ workbookFormatVersion: 2, datasetSchemaVersion: 2 }),
    );
  });

  it('executes a registered multi-step synthetic migration in path order', () => {
    const calls: string[] = [];
    const firstTo = version(2, 1);
    const target = version(2, 2);
    const registry = new WorkbookMigrationRegistry([
      {
        from: version(1, 1),
        to: firstTo,
        migrate(document) {
          calls.push('first');
          return rewriteVersion(document, firstTo);
        },
      },
      {
        from: firstTo,
        to: target,
        migrate(document) {
          calls.push('second');
          return rewriteVersion(document, target);
        },
      },
    ]);

    const result = prepareWorkbookForCurrentImport(documentAt(1, 1), registry, target);
    expect(result.ok).toBe(true);
    expect(calls).toEqual(['first', 'second']);
  });

  it('protects the source document even when a migration step mutates its owned input', () => {
    const source = documentAt(1, 1);
    const before = structuredClone(source);
    const target = version(2, 1);
    const registry = new WorkbookMigrationRegistry([
      {
        from: version(1, 1),
        to: target,
        migrate(document) {
          const meta = document.sheets[0].rows[0] as Record<string, unknown>;
          meta.workbookFormatVersion = 2;
          (meta.probe as { nested: string[] }).nested[0] = 'migrated';
          return document;
        },
      },
    ]);

    const result = prepareWorkbookForCurrentImport(source, registry, target);
    expect(result.ok).toBe(true);
    expect(source).toEqual(before);
  });

  it('retains the original cause when a migration step throws', () => {
    const cause = new Error('synthetic migration failure');
    const target = version(2, 1);
    const registry = new WorkbookMigrationRegistry([
      {
        from: version(1, 1),
        to: target,
        migrate() {
          throw cause;
        },
      },
    ]);

    const result = prepareWorkbookForCurrentImport(documentAt(1, 1), registry, target);
    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          stage: 'migration',
          code: 'MIGRATION_STEP_FAILED',
          stepIndex: 0,
          causeValue: cause,
        }),
      ],
    });
  });

  it('rejects a migration step that returns a malformed neutral workbook', () => {
    const target = version(2, 1);
    const registry = new WorkbookMigrationRegistry([
      {
        from: version(1, 1),
        to: target,
        migrate() {
          return { sheets: [{ name: '_Meta', columns: [], rows: 'invalid' }] } as unknown as WorkbookNeutralDocument;
        },
      },
    ]);

    const result = prepareWorkbookForCurrentImport(documentAt(1, 1), registry, target);
    expect(result).toEqual({
      ok: false,
      issues: [expect.objectContaining({ code: 'MIGRATION_OUTPUT_INVALID', stepIndex: 0 })],
    });
  });

  it('rejects migration output that changes the application format identity', () => {
    const target = version(2, 1);
    const registry = new WorkbookMigrationRegistry([
      {
        from: version(1, 1),
        to: target,
        migrate(document) {
          const output = rewriteVersion(document, target);
          (output.sheets[0].rows[0] as Record<string, unknown>).formatId = 'other-app';
          return output;
        },
      },
    ]);

    const result = prepareWorkbookForCurrentImport(documentAt(1, 1), registry, target);
    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'MIGRATION_OUTPUT_FORMAT_ID_MISMATCH',
          stepIndex: 0,
        }),
      ],
    });
  });

  it('rejects migration output whose metadata does not match the declared step target', () => {
    const target = version(2, 2);
    const registry = new WorkbookMigrationRegistry([
      {
        from: version(1, 1),
        to: target,
        migrate(document) {
          return rewriteVersion(document, version(2, 1));
        },
      },
    ]);

    const result = prepareWorkbookForCurrentImport(documentAt(1, 1), registry, target);
    expect(result).toEqual({
      ok: false,
      issues: [
        expect.objectContaining({
          code: 'MIGRATION_OUTPUT_VERSION_MISMATCH',
          input: version(2, 1),
          stepIndex: 0,
        }),
      ],
    });
  });

  it('returns migration output with defensive ownership', () => {
    const target = version(2, 1);
    let returnedByStep: WorkbookNeutralDocument | undefined;
    const registry = new WorkbookMigrationRegistry([
      {
        from: version(1, 1),
        to: target,
        migrate(document) {
          returnedByStep = rewriteVersion(document, target);
          return returnedByStep;
        },
      },
    ]);

    const result = prepareWorkbookForCurrentImport(documentAt(1, 1), registry, target);
    expect(result.ok).toBe(true);
    if (!result.ok || !returnedByStep) return;

    (returnedByStep.sheets[0].rows[0] as Record<string, unknown>).probe = 'changed-after-return';
    expect(result.document.sheets[0].rows[0].probe).toEqual({ nested: ['source'] });
  });
});
