import { CURRENT_BUSINESS_DATASET_SCHEMA_VERSION } from '../domain/businessDataset';
import {
  CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
  CURRENT_WORKBOOK_FORMAT_VERSION,
  type WorkbookNeutralDocument,
} from './workbookSchema';

export interface WorkbookVersionKey {
  readonly workbookFormatVersion: number;
  readonly datasetSchemaVersion: number;
}

export interface WorkbookVersionMetadata extends WorkbookVersionKey {
  readonly formatId: string;
}

export const CURRENT_WORKBOOK_VERSION_KEY: WorkbookVersionKey = Object.freeze({
  workbookFormatVersion: CURRENT_WORKBOOK_FORMAT_VERSION,
  datasetSchemaVersion: CURRENT_BUSINESS_DATASET_SCHEMA_VERSION,
});

export type WorkbookVersionPreflightIssueCode =
  | 'INVALID_DOCUMENT'
  | 'MISSING_META_SHEET'
  | 'DUPLICATE_META_SHEET'
  | 'INVALID_META_ROW_COUNT'
  | 'INVALID_META_ROW'
  | 'INVALID_FORMAT_ID'
  | 'INVALID_WORKBOOK_FORMAT_VERSION'
  | 'INVALID_DATASET_SCHEMA_VERSION';

export interface WorkbookVersionPreflightIssue {
  readonly code: WorkbookVersionPreflightIssueCode;
  readonly message: string;
  readonly input?: unknown;
}

export type WorkbookVersionPreflightResult =
  | {
      readonly ok: true;
      readonly metadata: WorkbookVersionMetadata;
    }
  | {
      readonly ok: false;
      readonly issues: readonly WorkbookVersionPreflightIssue[];
    };

export interface WorkbookMigrationStep {
  readonly from: WorkbookVersionKey;
  readonly to: WorkbookVersionKey;
  migrate(document: WorkbookNeutralDocument): WorkbookNeutralDocument;
}

export type WorkbookMigrationRegistryErrorCode =
  | 'INVALID_VERSION_KEY'
  | 'DUPLICATE_SOURCE'
  | 'SELF_LOOP'
  | 'CYCLE_DETECTED'
  | 'DOWNGRADE_NOT_ALLOWED';

export class WorkbookMigrationRegistryError extends Error {
  readonly code: WorkbookMigrationRegistryErrorCode;
  readonly from?: WorkbookVersionKey;
  readonly to?: WorkbookVersionKey;

  constructor(
    code: WorkbookMigrationRegistryErrorCode,
    message: string,
    context: { from?: WorkbookVersionKey; to?: WorkbookVersionKey } = {},
  ) {
    super(message);
    this.name = 'WorkbookMigrationRegistryError';
    this.code = code;
    this.from = context.from;
    this.to = context.to;
  }
}

export type WorkbookCompatibilityClassification =
  | {
      readonly status: 'invalid';
      readonly issues: readonly WorkbookVersionPreflightIssue[];
    }
  | {
      readonly status: 'current';
      readonly metadata: WorkbookVersionMetadata;
      readonly version: WorkbookVersionKey;
    }
  | {
      readonly status: 'migratable';
      readonly metadata: WorkbookVersionMetadata;
      readonly version: WorkbookVersionKey;
      readonly target: WorkbookVersionKey;
      readonly path: readonly WorkbookMigrationStep[];
    }
  | {
      readonly status: 'unsupported-older';
      readonly metadata: WorkbookVersionMetadata;
      readonly version: WorkbookVersionKey;
      readonly target: WorkbookVersionKey;
    }
  | {
      readonly status: 'unsupported-future';
      readonly metadata: WorkbookVersionMetadata;
      readonly version: WorkbookVersionKey;
      readonly target: WorkbookVersionKey;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1;
}

function cloneVersionKey(key: WorkbookVersionKey): WorkbookVersionKey {
  return {
    workbookFormatVersion: key.workbookFormatVersion,
    datasetSchemaVersion: key.datasetSchemaVersion,
  };
}

function assertValidVersionKey(key: WorkbookVersionKey): void {
  if (
    !isPositiveInteger(key.workbookFormatVersion) ||
    !isPositiveInteger(key.datasetSchemaVersion)
  ) {
    throw new WorkbookMigrationRegistryError(
      'INVALID_VERSION_KEY',
      'Workbook migration version keys must contain positive integer workbook and dataset versions.',
      { from: cloneVersionKey(key) },
    );
  }
}

function versionKeyString(key: WorkbookVersionKey): string {
  return `${key.workbookFormatVersion}:${key.datasetSchemaVersion}`;
}

function sameVersion(left: WorkbookVersionKey, right: WorkbookVersionKey): boolean {
  return (
    left.workbookFormatVersion === right.workbookFormatVersion &&
    left.datasetSchemaVersion === right.datasetSchemaVersion
  );
}

function cloneNeutralValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneNeutralValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, cloneNeutralValue(nested)]),
  );
}

/**
 * Creates defensive ownership for neutral workbook data without interpreting business semantics.
 */
export function cloneWorkbookNeutralDocument(
  document: WorkbookNeutralDocument,
): WorkbookNeutralDocument {
  return {
    sheets: document.sheets.map((sheet) => ({
      name: sheet.name,
      columns: [...sheet.columns],
      rows: sheet.rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([key, value]) => [key, cloneNeutralValue(value)]),
        ),
      ),
    })),
  };
}

/**
 * Reads only authoritative workbook identity/version metadata.
 *
 * This deliberately does not validate current business sheets or reconstruct source entities.
 */
export function preflightWorkbookVersion(input: unknown): WorkbookVersionPreflightResult {
  if (!isRecord(input) || !Array.isArray(input.sheets)) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_DOCUMENT',
          message: 'Workbook version preflight requires a document with a sheets array.',
          input,
        },
      ],
    };
  }

  const metaSheets = input.sheets.filter(
    (candidate) => isRecord(candidate) && candidate.name === '_Meta',
  );

  if (metaSheets.length === 0) {
    return {
      ok: false,
      issues: [
        {
          code: 'MISSING_META_SHEET',
          message: 'Workbook version preflight requires exactly one _Meta sheet.',
        },
      ],
    };
  }

  if (metaSheets.length > 1) {
    return {
      ok: false,
      issues: [
        {
          code: 'DUPLICATE_META_SHEET',
          message: 'Workbook version preflight found more than one _Meta sheet.',
          input: metaSheets.length,
        },
      ],
    };
  }

  const meta = metaSheets[0];
  if (!Array.isArray(meta.rows) || meta.rows.length !== 1) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_META_ROW_COUNT',
          message: '_Meta must contain exactly one authoritative metadata row.',
          input: Array.isArray(meta.rows) ? meta.rows.length : meta.rows,
        },
      ],
    };
  }

  const row = meta.rows[0];
  if (!isRecord(row)) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_META_ROW',
          message: '_Meta authoritative row must be an object.',
          input: row,
        },
      ],
    };
  }

  const issues: WorkbookVersionPreflightIssue[] = [];
  const formatId = row.formatId;
  const workbookFormatVersion = row.workbookFormatVersion;
  const datasetSchemaVersion = row.datasetSchemaVersion;

  if (formatId !== CRAFT_BUSINESS_WORKBOOK_FORMAT_ID) {
    issues.push({
      code: 'INVALID_FORMAT_ID',
      message: `Workbook formatId must be ${CRAFT_BUSINESS_WORKBOOK_FORMAT_ID}.`,
      input: formatId,
    });
  }

  if (!isPositiveInteger(workbookFormatVersion)) {
    issues.push({
      code: 'INVALID_WORKBOOK_FORMAT_VERSION',
      message: 'Workbook format version must be a positive integer.',
      input: workbookFormatVersion,
    });
  }

  if (!isPositiveInteger(datasetSchemaVersion)) {
    issues.push({
      code: 'INVALID_DATASET_SCHEMA_VERSION',
      message: 'Business dataset schema version must be a positive integer.',
      input: datasetSchemaVersion,
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    metadata: {
      formatId: CRAFT_BUSINESS_WORKBOOK_FORMAT_ID,
      workbookFormatVersion: workbookFormatVersion as number,
      datasetSchemaVersion: datasetSchemaVersion as number,
    },
  };
}

/**
 * Immutable, deterministic registry of explicit workbook migration edges.
 *
 * A source version may have only one next step. Steps may not downgrade either version axis.
 */
export class WorkbookMigrationRegistry {
  private readonly stepBySource: ReadonlyMap<string, WorkbookMigrationStep>;
  private readonly stepCount: number;

  constructor(steps: readonly WorkbookMigrationStep[]) {
    const ownedSteps = steps.map<WorkbookMigrationStep>((step) => {
      assertValidVersionKey(step.from);
      assertValidVersionKey(step.to);

      return Object.freeze({
        from: Object.freeze(cloneVersionKey(step.from)),
        to: Object.freeze(cloneVersionKey(step.to)),
        migrate: step.migrate,
      });
    });

    const bySource = new Map<string, WorkbookMigrationStep>();
    for (const step of ownedSteps) {
      if (sameVersion(step.from, step.to)) {
        throw new WorkbookMigrationRegistryError(
          'SELF_LOOP',
          `Migration step ${versionKeyString(step.from)} may not target itself.`,
          { from: step.from, to: step.to },
        );
      }

      const sourceKey = versionKeyString(step.from);
      if (bySource.has(sourceKey)) {
        throw new WorkbookMigrationRegistryError(
          'DUPLICATE_SOURCE',
          `Migration source ${sourceKey} has more than one registered next step.`,
          { from: step.from, to: step.to },
        );
      }
      bySource.set(sourceKey, step);
    }

    for (const sourceKey of bySource.keys()) {
      const visited = new Set<string>();
      let currentKey = sourceKey;

      while (bySource.has(currentKey)) {
        if (visited.has(currentKey)) {
          const step = bySource.get(currentKey)!;
          throw new WorkbookMigrationRegistryError(
            'CYCLE_DETECTED',
            `Migration registry contains a cycle at ${currentKey}.`,
            { from: step.from, to: step.to },
          );
        }

        visited.add(currentKey);
        currentKey = versionKeyString(bySource.get(currentKey)!.to);
      }
    }

    for (const step of ownedSteps) {
      if (
        step.to.workbookFormatVersion < step.from.workbookFormatVersion ||
        step.to.datasetSchemaVersion < step.from.datasetSchemaVersion
      ) {
        throw new WorkbookMigrationRegistryError(
          'DOWNGRADE_NOT_ALLOWED',
          `Migration step ${versionKeyString(step.from)} -> ${versionKeyString(step.to)} would downgrade a version axis.`,
          { from: step.from, to: step.to },
        );
      }
    }

    this.stepBySource = bySource;
    this.stepCount = ownedSteps.length;
  }

  resolvePath(
    from: WorkbookVersionKey,
    to: WorkbookVersionKey,
  ): readonly WorkbookMigrationStep[] | null {
    assertValidVersionKey(from);
    assertValidVersionKey(to);

    if (sameVersion(from, to)) return [];
    if (
      to.workbookFormatVersion < from.workbookFormatVersion ||
      to.datasetSchemaVersion < from.datasetSchemaVersion
    ) {
      return null;
    }

    const path: WorkbookMigrationStep[] = [];
    const visited = new Set<string>();
    let current = cloneVersionKey(from);

    while (!sameVersion(current, to)) {
      const currentKey = versionKeyString(current);
      if (visited.has(currentKey) || path.length > this.stepCount) {
        throw new WorkbookMigrationRegistryError(
          'CYCLE_DETECTED',
          `Migration path traversal encountered a cycle at ${currentKey}.`,
          { from: current, to },
        );
      }
      visited.add(currentKey);

      const step = this.stepBySource.get(currentKey);
      if (!step) return null;

      path.push(step);
      current = step.to;
    }

    return [...path];
  }
}

function migrateDatasetV1ToV2(document: WorkbookNeutralDocument): WorkbookNeutralDocument {
  const migrated = cloneWorkbookNeutralDocument(document);
  const meta = migrated.sheets.find((sheet) => sheet.name === '_Meta');
  const products = migrated.sheets.find((sheet) => sheet.name === 'Products');

  if (meta?.rows[0]) {
    meta.rows[0].datasetSchemaVersion = 2;
  }

  if (products && !products.columns.includes('preferredYieldSampleId')) {
    const mixPresetIndex = products.columns.indexOf('mixPresetId');
    const insertAt = mixPresetIndex >= 0 ? mixPresetIndex + 1 : products.columns.length;
    products.columns.splice(insertAt, 0, 'preferredYieldSampleId');
    for (const row of products.rows) {
      row.preferredYieldSampleId = undefined;
    }
  }

  return migrated;
}

export const PRODUCTION_WORKBOOK_MIGRATION_STEPS: readonly WorkbookMigrationStep[] = [
  {
    from: { workbookFormatVersion: 1, datasetSchemaVersion: 1 },
    to: { workbookFormatVersion: 1, datasetSchemaVersion: 2 },
    migrate: migrateDatasetV1ToV2,
  },
];

export const productionWorkbookMigrationRegistry = new WorkbookMigrationRegistry(
  PRODUCTION_WORKBOOK_MIGRATION_STEPS,
);

export function classifyWorkbookCompatibility(
  input: unknown,
  registry: WorkbookMigrationRegistry = productionWorkbookMigrationRegistry,
  target: WorkbookVersionKey = CURRENT_WORKBOOK_VERSION_KEY,
): WorkbookCompatibilityClassification {
  assertValidVersionKey(target);

  const preflight = preflightWorkbookVersion(input);
  if (!preflight.ok) {
    return { status: 'invalid', issues: preflight.issues };
  }

  const version: WorkbookVersionKey = {
    workbookFormatVersion: preflight.metadata.workbookFormatVersion,
    datasetSchemaVersion: preflight.metadata.datasetSchemaVersion,
  };
  const ownedTarget = cloneVersionKey(target);

  if (sameVersion(version, ownedTarget)) {
    return {
      status: 'current',
      metadata: preflight.metadata,
      version,
    };
  }

  if (
    version.workbookFormatVersion > ownedTarget.workbookFormatVersion ||
    version.datasetSchemaVersion > ownedTarget.datasetSchemaVersion
  ) {
    return {
      status: 'unsupported-future',
      metadata: preflight.metadata,
      version,
      target: ownedTarget,
    };
  }

  const path = registry.resolvePath(version, ownedTarget);
  if (path && path.length > 0) {
    return {
      status: 'migratable',
      metadata: preflight.metadata,
      version,
      target: ownedTarget,
      path,
    };
  }

  return {
    status: 'unsupported-older',
    metadata: preflight.metadata,
    version,
    target: ownedTarget,
  };
}
