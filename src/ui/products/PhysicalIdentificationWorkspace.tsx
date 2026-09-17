import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { moldService, storageLocationService } from '../../application/session';
import type { Mold } from '../../domain/molds';
import type { Product } from '../../domain/products';
import {
  STORAGE_LOCATION_TYPES,
  type StorageLocation,
  type StorageLocationType,
} from '../../domain/storageLocations';
import { PhysicalLabelPrintDialog } from '../labels/PhysicalLabelPrintDialog';
import type { PhysicalLabelIdentity } from '../labels/physicalLabel';
import './physicalIdentification.css';

type WorkspaceMode = 'molds' | 'storage';
type StatusFilter = 'active' | 'archived' | 'all';

type MoldForm = {
  id: string;
  productId: string;
  name: string;
  storageLocationId: string;
  notes: string;
};

type LocationForm = {
  id: string;
  name: string;
  type: StorageLocationType;
  parentId: string;
  notes: string;
};

const EMPTY_MOLD: MoldForm = { id: '', productId: '', name: '', storageLocationId: '', notes: '' };
const EMPTY_LOCATION: LocationForm = { id: '', name: '', type: 'rack', parentId: '', notes: '' };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The physical identification record could not be saved.';
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function PhysicalIdentificationWorkspace({ products }: { products: readonly Product[] }) {
  const [mode, setMode] = useState<WorkspaceMode>('molds');
  const [molds, setMolds] = useState<Mold[]>([]);
  const [locations, setLocations] = useState<StorageLocation[]>([]);
  const [pathByLocationId, setPathByLocationId] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [moldForm, setMoldForm] = useState<MoldForm>(EMPTY_MOLD);
  const [locationForm, setLocationForm] = useState<LocationForm>(EMPTY_LOCATION);
  const [editingMoldId, setEditingMoldId] = useState<string | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [labelIdentity, setLabelIdentity] = useState<PhysicalLabelIdentity | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [nextMolds, nextLocations] = await Promise.all([
        moldService.listMolds(),
        storageLocationService.listLocations(),
      ]);
      const pathEntries = await Promise.all(
        nextLocations.map(async (location) => [location.id, await storageLocationService.formatPath(location.id)] as const),
      );
      setMolds(nextMolds);
      setLocations(nextLocations);
      setPathByLocationId(Object.fromEntries(pathEntries));
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const productById = useMemo(
    () => new Map(products.map((product) => [normalize(product.id), product])),
    [products],
  );

  const visibleMolds = useMemo(() => {
    const search = normalize(query);
    return molds.filter((mold) => {
      const product = productById.get(normalize(mold.productId));
      const path = mold.storageLocationId ? pathByLocationId[mold.storageLocationId] ?? '' : '';
      return (
        (status === 'all' || mold.isActive === (status === 'active')) &&
        (!search || [mold.id, mold.name, mold.productId, product?.name ?? '', path, mold.notes ?? ''].some((value) => normalize(value).includes(search)))
      );
    });
  }, [molds, pathByLocationId, productById, query, status]);

  const visibleLocations = useMemo(() => {
    const search = normalize(query);
    return locations.filter((location) =>
      (status === 'all' || location.isActive === (status === 'active')) &&
      (!search || [location.id, location.name, location.type, pathByLocationId[location.id] ?? '', location.notes ?? ''].some((value) => normalize(value).includes(search))),
    );
  }, [locations, pathByLocationId, query, status]);

  const parentOptions = useMemo(() => {
    const expectedType = locationForm.type === 'shelf' ? 'rack' : locationForm.type === 'bin' ? 'shelf' : null;
    if (!expectedType) return [];
    return locations.filter(
      (location) =>
        location.type === expectedType &&
        location.isActive &&
        normalize(location.id) !== normalize(editingLocationId ?? ''),
    );
  }, [editingLocationId, locationForm.type, locations]);

  const assignableLocations = useMemo(
    () => locations.filter((location) => location.isActive),
    [locations],
  );

  function resetMoldForm() {
    setEditingMoldId(null);
    setMoldForm(EMPTY_MOLD);
  }

  function resetLocationForm() {
    setEditingLocationId(null);
    setLocationForm(EMPTY_LOCATION);
  }

  async function submitMold(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (editingMoldId) {
        await moldService.updateMold(editingMoldId, {
          productId: moldForm.productId,
          name: moldForm.name,
          storageLocationId: moldForm.storageLocationId || undefined,
          notes: moldForm.notes,
        });
        setFeedback({ type: 'success', message: 'Mold updated.' });
      } else {
        await moldService.createMold({
          id: moldForm.id,
          productId: moldForm.productId,
          name: moldForm.name,
          storageLocationId: moldForm.storageLocationId || undefined,
          notes: moldForm.notes,
          isActive: true,
        });
        setFeedback({ type: 'success', message: 'Mold created.' });
      }
      resetMoldForm();
      await reload();
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function submitLocation(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (editingLocationId) {
        await storageLocationService.updateLocation(editingLocationId, {
          name: locationForm.name,
          type: locationForm.type,
          parentId: locationForm.type === 'rack' ? undefined : locationForm.parentId || undefined,
          notes: locationForm.notes,
        });
        setFeedback({ type: 'success', message: 'Storage location updated.' });
      } else {
        await storageLocationService.createLocation({
          id: locationForm.id,
          name: locationForm.name,
          type: locationForm.type,
          parentId: locationForm.type === 'rack' ? undefined : locationForm.parentId || undefined,
          notes: locationForm.notes,
          isActive: true,
        });
        setFeedback({ type: 'success', message: 'Storage location created.' });
      }
      resetLocationForm();
      await reload();
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleMold(mold: Mold) {
    setBusy(true);
    setFeedback(null);
    try {
      if (mold.isActive) await moldService.archiveMold(mold.id);
      else await moldService.updateMold(mold.id, { isActive: true });
      if (editingMoldId === mold.id) resetMoldForm();
      await reload();
      setFeedback({ type: 'success', message: `${mold.name} ${mold.isActive ? 'archived' : 'restored'}.` });
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function toggleLocation(location: StorageLocation) {
    setBusy(true);
    setFeedback(null);
    try {
      if (location.isActive) await storageLocationService.archiveLocation(location.id);
      else await storageLocationService.updateLocation(location.id, { isActive: true });
      if (editingLocationId === location.id) resetLocationForm();
      await reload();
      setFeedback({ type: 'success', message: `${location.name} ${location.isActive ? 'archived' : 'restored'}.` });
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function editMold(mold: Mold) {
    setMode('molds');
    setEditingMoldId(mold.id);
    setMoldForm({
      id: mold.id,
      productId: mold.productId,
      name: mold.name,
      storageLocationId: mold.storageLocationId ?? '',
      notes: mold.notes ?? '',
    });
    setFeedback(null);
  }

  function editLocation(location: StorageLocation) {
    setMode('storage');
    setEditingLocationId(location.id);
    setLocationForm({
      id: location.id,
      name: location.name,
      type: location.type,
      parentId: location.parentId ?? '',
      notes: location.notes ?? '',
    });
    setFeedback(null);
  }

  function printMold(mold: Mold) {
    const product = productById.get(normalize(mold.productId));
    const path = mold.storageLocationId ? pathByLocationId[mold.storageLocationId] : undefined;
    setLabelIdentity({
      kind: 'MOLD',
      id: mold.id,
      title: mold.name,
      eyebrow: 'Craft Business Manager · Mold',
      details: [
        `Product: ${product?.name ?? mold.productId} (${mold.productId})`,
        `Location: ${path ?? 'Unassigned'}`,
      ],
      isActive: mold.isActive,
    });
  }

  function printLocation(location: StorageLocation) {
    setLabelIdentity({
      kind: 'LOCATION',
      id: location.id,
      title: location.name,
      eyebrow: `Craft Business Manager · ${location.type}`,
      details: [pathByLocationId[location.id] ?? location.name],
      isActive: location.isActive,
    });
  }

  return (
    <section className="physical-id-workspace" aria-label="Physical identification and storage">
      <div className="physical-id-heading">
        <div>
          <p className="panel-kicker">PHYSICAL IDENTIFICATION</p>
          <h2>Molds &amp; storage</h2>
          <p>Keep stable IDs while organizing molds into Rack → Shelf → Bin locations.</p>
        </div>
        <div className="physical-id-mode" role="group" aria-label="Physical identification view">
          <button type="button" className={mode === 'molds' ? 'active' : ''} onClick={() => setMode('molds')}>Molds</button>
          <button type="button" className={mode === 'storage' ? 'active' : ''} onClick={() => setMode('storage')}>Storage</button>
        </div>
      </div>

      <div className="physical-id-toolbar">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${mode}`} aria-label={`Search ${mode}`} />
        <select value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} aria-label="Physical record status filter">
          <option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option>
        </select>
      </div>

      {feedback && <div className={`feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>{feedback.message}</div>}

      {mode === 'molds' ? (
        <div className="physical-id-layout">
          <form className="panel physical-id-form" onSubmit={submitMold}>
            <div className="panel-heading"><div><p className="panel-kicker">MOLD RECORD</p><h3>{editingMoldId ? 'Edit mold' : 'Add mold'}</h3></div>{editingMoldId && <button type="button" className="text-button" onClick={resetMoldForm}>Cancel edit</button>}</div>
            <label className="field"><span>Mold ID</span><input required value={moldForm.id} disabled={Boolean(editingMoldId)} onChange={(event) => setMoldForm((current) => ({ ...current, id: event.target.value }))} placeholder="MOLD-0012" /></label>
            <label className="field"><span>Mold name</span><input required value={moldForm.name} onChange={(event) => setMoldForm((current) => ({ ...current, name: event.target.value }))} placeholder="Dinosaur Mold #1" /></label>
            <label className="field"><span>Product</span><select required value={moldForm.productId} onChange={(event) => setMoldForm((current) => ({ ...current, productId: event.target.value }))}><option value="">Select product</option>{products.filter((product) => product.isActive || product.id === moldForm.productId).map((product) => <option key={product.id} value={product.id}>{product.name} · {product.id}</option>)}</select></label>
            <label className="field"><span>Storage location</span><select value={moldForm.storageLocationId} onChange={(event) => setMoldForm((current) => ({ ...current, storageLocationId: event.target.value }))}><option value="">Unassigned</option>{assignableLocations.map((location) => <option key={location.id} value={location.id}>{pathByLocationId[location.id] ?? location.name}</option>)}</select><small>Changing this moves the mold without changing its Mold ID.</small></label>
            <label className="field"><span>Notes</span><textarea value={moldForm.notes} onChange={(event) => setMoldForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button className="button button-primary" disabled={busy || loading}>{editingMoldId ? 'Save mold' : 'Add mold'}</button>
          </form>

          <div className="panel physical-id-list">
            <div className="panel-heading"><div><p className="panel-kicker">MOLD DIRECTORY</p><h3>{loading ? 'Loading…' : `${visibleMolds.length} molds`}</h3></div></div>
            {visibleMolds.length === 0 ? <div className="empty-state"><p>No molds match this view.</p></div> : visibleMolds.map((mold) => {
              const product = productById.get(normalize(mold.productId));
              const path = mold.storageLocationId ? pathByLocationId[mold.storageLocationId] : undefined;
              return <article className="physical-id-card" key={mold.id}>
                <div><span className={`status-pill ${mold.isActive ? 'status-active' : ''}`}>{mold.isActive ? 'Active' : 'Archived'}</span><h4>{mold.name}</h4><code>{mold.id}</code></div>
                <dl><div><dt>Product</dt><dd>{product?.name ?? mold.productId}</dd></div><div><dt>Storage</dt><dd>{path ?? 'Unassigned'}</dd></div></dl>
                <div className="physical-id-actions"><button type="button" className="button button-quiet" disabled={busy} onClick={() => editMold(mold)}>Edit / move</button><button type="button" className="text-button" onClick={() => printMold(mold)}>Print mold label</button><button type="button" className={`text-button ${mold.isActive ? 'danger' : ''}`} disabled={busy} onClick={() => void toggleMold(mold)}>{mold.isActive ? 'Archive' : 'Restore'}</button></div>
              </article>;
            })}
          </div>
        </div>
      ) : (
        <div className="physical-id-layout">
          <form className="panel physical-id-form" onSubmit={submitLocation}>
            <div className="panel-heading"><div><p className="panel-kicker">STORAGE RECORD</p><h3>{editingLocationId ? 'Edit location' : 'Add location'}</h3></div>{editingLocationId && <button type="button" className="text-button" onClick={resetLocationForm}>Cancel edit</button>}</div>
            <label className="field"><span>Location ID</span><input required value={locationForm.id} disabled={Boolean(editingLocationId)} onChange={(event) => setLocationForm((current) => ({ ...current, id: event.target.value }))} placeholder="LOC-BIN-0004" /></label>
            <label className="field"><span>Name</span><input required value={locationForm.name} onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))} placeholder="Bin 04" /></label>
            <label className="field"><span>Type</span><select value={locationForm.type} onChange={(event) => setLocationForm((current) => ({ ...current, type: event.target.value as StorageLocationType, parentId: '' }))}>{STORAGE_LOCATION_TYPES.map((type) => <option key={type} value={type}>{type[0].toUpperCase() + type.slice(1)}</option>)}</select></label>
            {locationForm.type !== 'rack' && <label className="field"><span>{locationForm.type === 'shelf' ? 'Rack' : 'Shelf'} parent</span><select required value={locationForm.parentId} onChange={(event) => setLocationForm((current) => ({ ...current, parentId: event.target.value }))}><option value="">Select parent</option>{parentOptions.map((location) => <option key={location.id} value={location.id}>{pathByLocationId[location.id] ?? location.name}</option>)}</select></label>}
            <label className="field"><span>Notes</span><textarea value={locationForm.notes} onChange={(event) => setLocationForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button className="button button-primary" disabled={busy || loading}>{editingLocationId ? 'Save location' : 'Add location'}</button>
          </form>

          <div className="panel physical-id-list">
            <div className="panel-heading"><div><p className="panel-kicker">STORAGE DIRECTORY</p><h3>{loading ? 'Loading…' : `${visibleLocations.length} locations`}</h3></div></div>
            {visibleLocations.length === 0 ? <div className="empty-state"><p>No storage locations match this view.</p></div> : visibleLocations.map((location) => <article className="physical-id-card" key={location.id}>
              <div><span className={`status-pill ${location.isActive ? 'status-active' : ''}`}>{location.isActive ? 'Active' : 'Archived'}</span><span className="physical-id-type">{location.type}</span><h4>{location.name}</h4><code>{location.id}</code></div>
              <p className="physical-id-path">{pathByLocationId[location.id] ?? location.name}</p>
              <div className="physical-id-actions"><button type="button" className="button button-quiet" disabled={busy} onClick={() => editLocation(location)}>Edit</button><button type="button" className="text-button" onClick={() => printLocation(location)}>Print storage label</button><button type="button" className={`text-button ${location.isActive ? 'danger' : ''}`} disabled={busy} onClick={() => void toggleLocation(location)}>{location.isActive ? 'Archive' : 'Restore'}</button></div>
            </article>)}
          </div>
        </div>
      )}

      {labelIdentity && <PhysicalLabelPrintDialog identity={labelIdentity} onClose={() => setLabelIdentity(null)} />}
    </section>
  );
}
