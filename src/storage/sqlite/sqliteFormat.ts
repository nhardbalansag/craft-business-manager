import type { SqlJsStatic } from 'sql.js';
import { validatePhysicalBusinessDatasetV5Integrity, type PhysicalBusinessDatasetV5 } from '../../domain/physicalBusinessDatasetV5';
import { emptyTransactionArchive, validatePortableTransactions, type PortableTransactionArchive } from '../../ui/transactions/portableTransactions';
import { emptyBusinessWorkspace, validateBusinessWorkspace, type BusinessWorkspace } from '../../domain/businessInsights';

export const SQLITE_APPLICATION_ID = 0x4d4c4346;
export const SQLITE_FORMAT = 'my-lovely-craft-backup';
export const COLLECTIONS = ['materials', 'materialCalibrations', 'mixPresets', 'products', 'yieldSamples', 'recipeItems',
  'productComponents', 'productStocks', 'productFinancialProfiles', 'productPriceTiers', 'storageLocations', 'molds',
  'plasterMoldYieldProfiles', 'yieldMoldFormulaSources'] as const;
const MAX_STATE = 32 * 1024 * 1024;
const MAX_FILE = 256 * 1024 * 1024;
const imageKeys = new Set(['uri', 'thumbnailUri', 'sourceImageUri', 'sourceBrochureUri']);
type JsonObject = Record<string, any>;
export interface SqliteDocument {
  dataset: PhysicalBusinessDatasetV5 | null;
  state: JsonObject;
  images: Map<string, Uint8Array>;
  workspaceRevision: string | null;
  savedAt: string;
  historyRevision: number;
  businessRevision: number;
  business: BusinessWorkspace;
}

const textEncoder = new TextEncoder();
export async function sha256(value: string | Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Open the app over HTTPS or localhost to use verified SQLite storage and backups.');
  const bytes = typeof value === 'string' ? textEncoder.encode(value) : new Uint8Array(value);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map((n) => n.toString(16).padStart(2, '0')).join('');
}
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function object(value: unknown): value is JsonObject { return !!value && typeof value === 'object' && !Array.isArray(value); }
export function newSqliteDocument(): SqliteDocument {
  return { dataset: null, workspaceRevision: null, savedAt: new Date().toISOString(), historyRevision: 0, businessRevision: 0, business: emptyBusinessWorkspace(), images: new Map(),
    state: { version: 1, sourceUrl: '', snapshot: null,
      printer: { address: '', name: '', columns: 32, qrEnabled: false, copies: 1 },
      production: { includeBreakdown: true, materialsSize: 1, materialsBold: false },
      requests: [], jobs: [], quotations: [], customerReceipts: [], transactionEntries: [] } };
}
function validateState(state: JsonObject) {
  assert(state.version === 1 && typeof state.sourceUrl === 'string' && object(state.printer) &&
    typeof state.printer.address === 'string' && typeof state.printer.name === 'string' &&
    [32, 42, 48].includes(state.printer.columns) && typeof state.printer.qrEnabled === 'boolean' &&
    Number.isInteger(state.printer.copies) && state.printer.copies >= 1 && state.printer.copies <= 20 &&
    Array.isArray(state.requests) && Array.isArray(state.jobs) &&
    (state.snapshot === null || (object(state.snapshot) && typeof state.snapshot.revision === 'string' &&
      typeof state.snapshot.sourceUrl === 'string' && Number.isFinite(Date.parse(state.snapshot.importedAt)) &&
      Number.isFinite(Date.parse(state.snapshot.exportedAt)))), 'The SQLite backup has invalid mobile app state.');
  const receipt = (value: any) => object(value) && typeof value.title === 'string' && typeof value.text === 'string' && value.text.length <= 120000 &&
    (value.qr === undefined || typeof value.qr === 'string') &&
    (value.sections === undefined || (Array.isArray(value.sections) && value.sections.length <= 1000 &&
      value.sections.every((section: any) => object(section) && typeof section.text === 'string' && [1, 2].includes(section.size) && typeof section.bold === 'boolean') &&
      value.sections.map((section: any) => section.text).join('\n') === value.text)) &&
    (value.photo === undefined || (object(value.photo) && typeof value.photo.uri === 'string' && typeof value.photo.thumbnailUri === 'string' && [384, 576].includes(value.photo.dots)));
  assert(state.requests.every((request: any) => object(request) && typeof request.id === 'string' && typeof request.title === 'string' &&
    typeof request.createdAt === 'string' && ['production', 'order', 'calibration'].includes(request.kind) && Array.isArray(request.lines) && receipt(request.receipt)), 'The backup contains unsupported or invalid mobile requests.');
  assert(state.jobs.every((job: any) => object(job) && typeof job.id === 'string' && typeof job.createdAt === 'string' && typeof job.printer === 'string' &&
    ['sending', 'sent', 'failed', 'outcome-unknown'].includes(job.status) && Number.isInteger(job.copies) && job.copies >= 1 && job.copies <= 20 && receipt(job.receipt)), 'The backup contains invalid print history.');
  if (state.production !== undefined) assert(object(state.production) && typeof state.production.includeBreakdown === 'boolean' &&
    [1, 2].includes(state.production.materialsSize) && typeof state.production.materialsBold === 'boolean', 'The backup has invalid mobile print settings.');
  if (state.snapshot?.photos !== undefined) assert(object(state.snapshot.photos) && Object.values(state.snapshot.photos).every((photo) => object(photo) &&
    typeof photo.uri === 'string' && typeof photo.thumbnailUri === 'string' &&
    (photo.sourceImageUri === undefined || typeof photo.sourceImageUri === 'string') &&
    (photo.sourceBrochureUri === undefined || typeof photo.sourceBrochureUri === 'string')), 'The backup has invalid product photo metadata.');
  if (state.inventory !== undefined) {
    const inventory = state.inventory, ids = new Set<string>(), movements = new Set<string>();
    const whole = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
    assert(object(inventory) && Array.isArray(inventory.balances) && Array.isArray(inventory.movements) &&
      inventory.balances.every((row: any) => object(row) && typeof row.productId === 'string' && row.productId.trim() && whole(row.quantity) &&
        !ids.has(row.productId) && !!ids.add(row.productId)) &&
      inventory.movements.every((row: any) => object(row) && typeof row.id === 'string' && row.id.trim() && !movements.has(row.id) && !!movements.add(row.id) &&
        typeof row.productId === 'string' && row.productId.trim() && typeof row.productName === 'string' && Number.isFinite(Date.parse(row.createdAt)) &&
        ['in', 'out', 'count'].includes(row.action) && whole(row.quantity) && row.quantity <= 1000000 && whole(row.before) && whole(row.after) &&
        typeof row.note === 'string' && row.note.length <= 500 && (row.action === 'count' || row.quantity >= 1) &&
        row.after === (row.action === 'count' ? row.quantity : row.before + (row.action === 'in' ? row.quantity : -row.quantity))), 'The backup has invalid mobile inventory history.');
  }
}

function imageId(reference: unknown): string {
  assert(typeof reference === 'string' && /^backup:\/\/image\/[a-f0-9]{64}$/.test(reference), 'The backup has a non-portable image reference.');
  return reference.slice(-64);
}
function walkImages(value: unknown, visit: (reference: string) => void) {
  if (Array.isArray(value)) value.forEach((child) => walkImages(child, visit));
  else if (object(value)) for (const [key, child] of Object.entries(value)) {
    if (imageKeys.has(key) && typeof child === 'string') visit(child);
    else walkImages(child, visit);
  }
}
function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function fromBase64(value: string): Uint8Array { return Uint8Array.from(atob(value), (c) => c.charCodeAt(0)); }
function jpegSize(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) return false;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset++] !== 255) return false;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = bytes[offset] * 256 + bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return false;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = bytes[offset + 3] * 256 + bytes[offset + 4], width = bytes[offset + 5] * 256 + bytes[offset + 6];
      return width > 0 && height > 0 && width <= 8192 && height <= 8192 && width * height <= 32000000;
    }
    offset += length;
  }
  return false;
}

/** Match CraftBackupFiles.kt on mobile branch 209ec7298921b42aa89c72dd6f5eab0133317e81. */
export async function encodeSqlite(SQL: SqlJsStatic, document: SqliteDocument, portable = false): Promise<Uint8Array> {
  assert(Number.isSafeInteger(document.historyRevision) && document.historyRevision >= 0 && Number.isFinite(Date.parse(document.savedAt)), 'Invalid database revision metadata.');
  assert(Number.isSafeInteger(document.businessRevision) && document.businessRevision >= 0, 'Invalid business workspace revision.');
  const business = JSON.stringify(validateBusinessWorkspace(document.business));
  const dataset = document.dataset ? structuredClone(document.dataset) : null;
  if (dataset) assert(validatePhysicalBusinessDatasetV5Integrity(dataset).valid, 'The current catalog is invalid; the database was not changed.');
  const state = structuredClone(document.state), images = new Map(document.images);
  if (dataset) {
    if (object(state.inventory) && Array.isArray(state.inventory.balances)) {
      const products = new Set(dataset.products.map((product) => product.id));
      const stocks = new Map(dataset.productStocks.map((stock) => [stock.productId, stock.onHandQuantity]));
      state.inventory.balances = state.inventory.balances.map((row: any) => products.has(row.productId)
        ? { ...row, quantity: stocks.get(row.productId) ?? 0 } : row);
    }
    const photos: JsonObject = {};
    for (const product of dataset.products) {
      const photo: JsonObject = {};
      for (const [field, target] of [['imageDataUrl', 'sourceImageUri'], ['brochureImageDataUrl', 'sourceBrochureUri']] as const) {
        const dataUrl = product[field];
        if (!dataUrl) continue;
        assert(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(dataUrl), `Product ${product.id} has an unsupported photo.`);
        const bytes = fromBase64(dataUrl.slice(dataUrl.indexOf(',') + 1));
        const id = await sha256(bytes);
        images.set(id, bytes); photo[target] = `backup://image/${id}`;
        delete product[field];
      }
      if (Object.keys(photo).length) {
        photo.uri = photo.sourceBrochureUri ?? photo.sourceImageUri;
        photo.thumbnailUri = photo.sourceImageUri ?? photo.sourceBrochureUri;
        photos[product.id] = photo;
      }
    }
    state.snapshot = { ...(state.snapshot ?? {}), data: undefined, sourceUrl: state.sourceUrl,
      importedAt: state.snapshot?.importedAt ?? document.savedAt, exportedAt: document.savedAt,
      revision: document.workspaceRevision ?? 'web-sqlite', photos };
  } else state.snapshot = null;
  validateState(state);
  const usedImages = new Set<string>();
  walkImages(state, (reference) => usedImages.add(imageId(reference)));
  for (const id of usedImages) {
    const bytes = images.get(id);
    assert(bytes && bytes.length > 0 && bytes.length <= 360000 && await sha256(bytes) === id, 'A referenced backup image is missing or damaged.');
    if (portable) assert(jpegSize(bytes), 'A saved photo is not a valid mobile-compatible JPEG. Replace that photo before exporting.');
  }
  assert(usedImages.size <= 10000, 'The backup exceeds the mobile limit of 10,000 images.');
  const shape = dataset ? JSON.stringify(Object.fromEntries(Object.entries(dataset).map(([key, value]) => [key, Array.isArray(value) ? [] : value]))) : 'null';
  const text = JSON.stringify(state);
  let catalogSize = textEncoder.encode(text).length;
  assert(catalogSize <= MAX_STATE && shape.length <= 65536, 'The backup state exceeds the mobile app size limit.');
  const db = new SQL.Database();
  try {
    db.run(`PRAGMA application_id=${SQLITE_APPLICATION_ID}; PRAGMA user_version=1;
      CREATE TABLE craft_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE craft_state_chunks (position INTEGER PRIMARY KEY, content TEXT NOT NULL);
      CREATE TABLE craft_records (collection TEXT NOT NULL, position INTEGER NOT NULL, json TEXT NOT NULL, sha256 TEXT NOT NULL, PRIMARY KEY(collection, position));
      CREATE TABLE craft_images (sha256 TEXT PRIMARY KEY, mime_type TEXT NOT NULL, bytes BLOB NOT NULL);
      CREATE TABLE craft_web_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); BEGIN;`);
    const meta = db.prepare('INSERT INTO craft_meta VALUES (?,?)');
    const put = (key: string, value: string) => { meta.run([key, value]); };
    put('format', SQLITE_FORMAT); put('version', '1'); put('state_sha256', await sha256(text));
    put('application_version', 'my-lovely-craft-web-sqlite-1'); put('created_at_epoch_ms', String(Date.parse(document.savedAt)));
    put('dataset_shape', shape); put('dataset_shape_sha256', await sha256(shape));
    const chunks = db.prepare('INSERT INTO craft_state_chunks VALUES (?,?)');
    let position = 0;
    for (let i = 0; i < text.length;) {
      let end = Math.min(i + 24000, text.length);
      if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
      chunks.run([position++, text.slice(i, end)]); i = end;
    }
    assert(position <= 1500, 'The backup has too many state chunks.'); chunks.free();
    const records = db.prepare('INSERT INTO craft_records VALUES (?,?,?,?)');
    let recordsDigest = '', count = 0;
    if (dataset) for (const collection of [...COLLECTIONS].sort()) {
      for (let index = 0; index < dataset[collection].length; index++) {
        const json = JSON.stringify(dataset[collection][index]), hash = await sha256(json);
        catalogSize += textEncoder.encode(json).length;
        assert(++count <= 500000 && json.length <= 1024 * 1024 && catalogSize <= MAX_STATE, 'The catalog exceeds the mobile app backup size limit.');
        records.run([collection, index, json, hash]); recordsDigest += `${collection}:${index}:${hash}\n`;
      }
    }
    records.free(); put('records_sha256', await sha256(recordsDigest));
    const imageInsert = db.prepare('INSERT INTO craft_images VALUES (?,?,?)');
    let imageSize = 0;
    for (const id of usedImages) { const bytes = images.get(id)!; imageSize += bytes.length; imageInsert.run([id, 'image/jpeg', bytes]); }
    assert(imageSize <= 200 * 1024 * 1024, 'Backup images exceed the mobile app 200 MB limit.'); imageInsert.free();
    put('image_count', String(usedImages.size)); put('image_ids_sha256', await sha256([...usedImages].sort().join('\n'))); meta.free();
    const web = db.prepare('INSERT INTO craft_web_meta VALUES (?,?)');
    web.run(['workspace_revision', document.workspaceRevision ?? '']); web.run(['saved_at', document.savedAt]);
    web.run(['history_revision', String(document.historyRevision)]);
    web.run(['business_revision', String(document.businessRevision)]); web.run(['business_workspace', business]);
    web.run(['business_workspace_sha256', await sha256(business)]); web.free(); db.run('COMMIT');
    const bytes = db.export(); assert(bytes.length <= MAX_FILE, 'The SQLite backup exceeds the mobile app 256 MB limit.'); return bytes;
  } finally { db.close(); }
}

export async function decodeSqlite(SQL: SqlJsStatic, bytes: Uint8Array, portable = false): Promise<SqliteDocument> {
  assert(bytes.length >= 100 && bytes.length <= MAX_FILE && new TextDecoder().decode(bytes.subarray(0, 16)) === 'SQLite format 3\0', 'Choose a My Lovely Craft .sqlite backup (up to 256 MB).');
  const db = new SQL.Database(bytes);
  try {
    const scalar = (sql: string) => db.exec(sql)[0]?.values[0]?.[0];
    assert(scalar('PRAGMA application_id') === SQLITE_APPLICATION_ID && scalar('PRAGMA user_version') === 1 && scalar('PRAGMA quick_check(1)') === 'ok', 'The SQLite backup is damaged or belongs to another application.');
    for (const table of ['craft_meta', 'craft_state_chunks', 'craft_records', 'craft_images']) {
      const type = db.exec(`SELECT type FROM sqlite_master WHERE name='${table}'`)[0]?.values[0]?.[0];
      assert(type === 'table', 'The backup is missing a required SQLite table.');
    }
    const metadata = Object.fromEntries((db.exec('SELECT key,value FROM craft_meta LIMIT 21')[0]?.values ?? []).map(([key, value]) => [String(key), String(value)]));
    assert(metadata.format === SQLITE_FORMAT && metadata.version === '1', 'Unsupported SQLite backup version.');
    let text = '', next = 0, size = 0;
    const chunks = db.prepare('SELECT position,content FROM craft_state_chunks ORDER BY position LIMIT 1501');
    while (chunks.step()) {
      const [position, content] = chunks.get();
      assert(position === next++ && next <= 1500 && typeof content === 'string' && content.length <= 24000, 'Backup state chunks are incomplete or invalid.');
      text += content; size += textEncoder.encode(content).length; assert(size <= MAX_STATE, 'Backup state is too large.');
    }
    chunks.free(); assert(await sha256(text) === metadata.state_sha256, 'Backup state checksum is invalid.');
    const state = JSON.parse(text); assert(object(state), 'Invalid backup state.'); validateState(state);
    const shape = metadata.dataset_shape;
    assert(typeof shape === 'string' && shape.length <= 65536 && await sha256(shape) === metadata.dataset_shape_sha256, 'Backup catalog metadata checksum is invalid.');
    let dataset: PhysicalBusinessDatasetV5 | null = shape === 'null' ? null : JSON.parse(shape);
    if (dataset) assert(object(dataset) && dataset.schemaVersion === 5 && Object.keys(dataset).length === COLLECTIONS.length + 1 &&
      COLLECTIONS.every((key) => Array.isArray(dataset![key]) && dataset![key].length === 0), 'Unsupported backup catalog schema.');
    let digest = '', count = 0;
    const records = db.prepare('SELECT collection,position,json,sha256 FROM craft_records ORDER BY collection,position LIMIT 500001');
    while (records.step()) {
      const [collection, position, json, hash] = records.get();
      assert(dataset && typeof collection === 'string' && COLLECTIONS.includes(collection as any), 'Unknown backup catalog collection.');
      const rows = dataset[collection as typeof COLLECTIONS[number]] as unknown[];
      assert(position === rows.length && typeof json === 'string' && json.length <= 1024 * 1024 && ++count <= 500000, 'Backup catalog rows are incomplete or invalid.');
      size += textEncoder.encode(json).length; assert(size <= MAX_STATE && await sha256(json) === hash, 'Backup catalog checksum or size is invalid.');
      const row = JSON.parse(json); assert(object(row), 'Invalid backup catalog row.'); rows.push(row); digest += `${collection}:${position}:${hash}\n`;
    }
    records.free(); assert(await sha256(digest) === metadata.records_sha256, 'Backup catalog records are incomplete or damaged.');
    const images = new Map<string, Uint8Array>(); let imageSize = 0;
    const imageRows = db.prepare('SELECT sha256,mime_type,bytes FROM craft_images LIMIT 10001');
    while (imageRows.step()) {
      const [id, mime, value] = imageRows.get();
      assert(typeof id === 'string' && /^[a-f0-9]{64}$/.test(id) && mime === 'image/jpeg' && value instanceof Uint8Array && value.length > 0 && value.length <= 360000 && images.size < 10000 && await sha256(value) === id, 'Backup image checksum or type is invalid.');
      if (portable) assert(jpegSize(value), 'A backup image is not a mobile-compatible JPEG.');
      images.set(id, value); imageSize += value.length; assert(imageSize <= 200 * 1024 * 1024, 'Backup images are too large.');
    }
    imageRows.free(); assert(String(images.size) === metadata.image_count && await sha256([...images.keys()].sort().join('\n')) === metadata.image_ids_sha256, 'Backup image manifest is incomplete or damaged.');
    walkImages(state, (reference) => assert(images.has(imageId(reference)), 'Backup is missing a referenced image.'));
    if (dataset) {
      assert(object(state.snapshot), 'Backup catalog state is missing.');
      for (const product of dataset.products) {
        const photo = state.snapshot.photos?.[product.id];
        if (!photo) continue;
        for (const [source, field] of [['sourceImageUri', 'imageDataUrl'], ['sourceBrochureUri', 'brochureImageDataUrl']] as const) {
          if (photo[source]) product[field] = 'data:image/jpeg;base64,' + base64(images.get(imageId(photo[source]))!);
        }
        // Android's older photo maps may only contain display and thumbnail references.
        if (!photo.sourceImageUri && !photo.sourceBrochureUri) {
          const thumbnail = images.get(imageId(photo.thumbnailUri))!;
          if (thumbnail.length <= 18732) product.imageDataUrl = 'data:image/jpeg;base64,' + base64(thumbnail);
          product.brochureImageDataUrl = 'data:image/jpeg;base64,' + base64(images.get(imageId(photo.uri))!);
        }
      }
      assert(validatePhysicalBusinessDatasetV5Integrity(dataset).valid, 'The SQLite backup contains an invalid business catalog.');
    }
    const webRows = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='craft_web_meta'")[0]?.values.length;
    const web = webRows ? Object.fromEntries((db.exec("SELECT key,value FROM craft_web_meta WHERE key IN ('workspace_revision','saved_at','history_revision','business_revision','business_workspace','business_workspace_sha256')")[0]?.values ?? []).map(([k, v]) => [String(k), String(v)])) : {};
    const savedAt = web.saved_at ?? new Date(Number(metadata.created_at_epoch_ms)).toISOString();
    assert((web.business_workspace === undefined) === (web.business_workspace_sha256 === undefined) &&
      (web.business_workspace === undefined) === (web.business_revision === undefined), 'The business workspace metadata or checksum is missing.');
    if (web.business_workspace !== undefined) {
      assert(new TextEncoder().encode(web.business_workspace).length <= 16 * 1024 * 1024 && await sha256(web.business_workspace) === web.business_workspace_sha256, 'The business workspace checksum is invalid.');
    }
    const document: SqliteDocument = { dataset, state, images, workspaceRevision: web.workspace_revision || state.snapshot?.revision || null,
      savedAt, historyRevision: Number(web.history_revision ?? ((state.quotations?.length || state.customerReceipts?.length) ? 1 : 0)),
      businessRevision: Number(web.business_revision ?? 0),
      business: web.business_workspace === undefined ? emptyBusinessWorkspace() : validateBusinessWorkspace(JSON.parse(web.business_workspace)) };
    assert(Number.isFinite(Date.parse(savedAt)) && Number.isSafeInteger(document.historyRevision) && document.historyRevision >= 0, 'Invalid database revision metadata.');
    assert(Number.isSafeInteger(document.businessRevision) && document.businessRevision >= 0, 'Invalid business workspace revision.');
    await historyFromDocument(document);
    return document;
  } finally { db.close(); }
}

export async function historyFromDocument(document: SqliteDocument): Promise<PortableTransactionArchive> {
  const archive = { ...emptyTransactionArchive(), exportedAt: document.state.webTransactionExportedAt ?? document.savedAt,
    customerReceipts: document.state.customerReceipts ?? [], quotations: document.state.quotations ?? [], transactionEntries: document.state.transactionEntries ?? [], images: {} as Record<string, string> };
  const ids = new Set<string>(); walkImages([archive.customerReceipts, archive.quotations], (reference) => ids.add(imageId(reference)));
  for (const id of ids) { const bytes = document.images.get(id); assert(bytes, 'A transaction image is missing.'); archive.images[id] = base64(bytes); }
  return validatePortableTransactions(archive);
}
export async function setDocumentHistory(document: SqliteDocument, input: unknown): Promise<void> {
  const archive = await validatePortableTransactions(input);
  document.state.customerReceipts = archive.customerReceipts; document.state.quotations = archive.quotations; document.state.transactionEntries = archive.transactionEntries;
  document.state.webTransactionExportedAt = archive.exportedAt;
  for (const [id, encoded] of Object.entries(archive.images)) document.images.set(id, fromBase64(encoded));
}
