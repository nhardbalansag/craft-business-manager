import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { productComponentService } from '../../application/session';
import type { Material } from '../../domain/materials';
import { validateProductCompositionGraph } from '../../domain/productCompositionGraph';
import {
  PRODUCT_COMPONENT_ROLES,
  type ProductComponent,
  type ProductComponentRole,
  type ProductComponentSourceType,
} from '../../domain/productComponents';
import type { Product } from '../../domain/products';
import {
  buildProductCompositionPreview,
  type ProductCompositionPreviewNode,
} from './productCompositionPreview';

type ProductComponentsViewProps = {
  products: readonly Product[];
  materials: readonly Material[];
  catalogLoading: boolean;
  initialProductId?: string;
};

type ComponentFormState = {
  id: string;
  sourceType: ProductComponentSourceType;
  sourceId: string;
  role: ProductComponentRole;
  quantityPerParent: string;
  notes: string;
};

const EMPTY_COMPONENT_FORM: ComponentFormState = {
  id: '',
  sourceType: 'material',
  sourceId: '',
  role: 'vessel',
  quantityPerParent: '1',
  notes: '',
};

function comparable(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please check the component and try again.';
}

function componentToForm(component: ProductComponent): ComponentFormState {
  return {
    id: component.id,
    sourceType: component.sourceType,
    sourceId: component.sourceId,
    role: component.role,
    quantityPerParent: String(component.quantityPerParent),
    notes: component.notes ?? '',
  };
}

function sourceLabel(
  component: Pick<ProductComponent, 'sourceType' | 'sourceId'>,
  products: readonly Product[],
  materials: readonly Material[],
): string {
  if (component.sourceType === 'material') {
    return materials.find((material) => comparable(material.id) === comparable(component.sourceId))?.name ?? component.sourceId;
  }

  return products.find((product) => comparable(product.id) === comparable(component.sourceId))?.name ?? component.sourceId;
}

function PreviewBranch({ node }: { node: ProductCompositionPreviewNode }) {
  return (
    <li className={`composition-tree-item ${node.issue ? 'composition-tree-issue' : ''}`}>
      <div className="composition-tree-line">
        <span className="composition-tree-connector" aria-hidden="true">↳</span>
        <span>
          <strong>{node.quantityPerParent} × {node.sourceName}</strong>
          <small>
            {node.sourceType === 'material' ? 'Material' : 'Product'} · {node.role} · {node.sourceId}
            {node.sourceIsActive === false ? ' · archived' : ''}
            {node.issue === 'missing-source' ? ' · missing source' : ''}
            {node.issue === 'cycle' ? ' · cycle detected' : ''}
          </small>
        </span>
      </div>
      {node.children.length > 0 && (
        <ul className="composition-tree-list">
          {node.children.map((child) => <PreviewBranch key={`${child.componentId}:${child.sourceType}:${child.sourceId}`} node={child} />)}
        </ul>
      )}
    </li>
  );
}

export function ProductComponentsView({ products, materials, catalogLoading, initialProductId }: ProductComponentsViewProps) {
  const initialParentId = products.find((product) => product.id === initialProductId)?.id ?? products.find((product) => product.isActive)?.id ?? products[0]?.id ?? '';
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState(initialParentId);
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(true);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [form, setForm] = useState<ComponentFormState>(EMPTY_COMPONENT_FORM);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const reloadComponents = useCallback(async () => {
    setComponentsLoading(true);
    setSourceError(null);
    try {
      setComponents(await productComponentService.listComponents());
    } catch (error) {
      setSourceError(errorMessage(error));
    } finally {
      setComponentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadComponents();
  }, [reloadComponents]);

  useEffect(() => {
    const selectedStillExists = products.some((product) => comparable(product.id) === comparable(selectedParentId));
    if (selectedStillExists) return;
    setSelectedParentId(products.find((product) => product.isActive)?.id ?? products[0]?.id ?? '');
  }, [products, selectedParentId]);

  const selectedParent = useMemo(
    () => products.find((product) => comparable(product.id) === comparable(selectedParentId)) ?? null,
    [products, selectedParentId],
  );

  const parentComponents = useMemo(
    () => components.filter((component) => comparable(component.parentProductId) === comparable(selectedParentId)),
    [components, selectedParentId],
  );

  const usedSourceKeys = useMemo(() => {
    return new Set(
      parentComponents
        .filter((component) => comparable(component.id) !== comparable(editingComponentId ?? ''))
        .map((component) => `${component.sourceType}:${comparable(component.sourceId)}`),
    );
  }, [editingComponentId, parentComponents]);

  const materialCandidates = useMemo(
    () => materials
      .filter((material) => material.isActive && material.baseUnit === 'pc')
      .filter((material) => !usedSourceKeys.has(`material:${comparable(material.id)}`))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
    [materials, usedSourceKeys],
  );

  const productCandidates = useMemo(() => {
    if (!selectedParent) return [];

    const graphWithoutCurrentEdit = components.filter(
      (component) => comparable(component.id) !== comparable(editingComponentId ?? ''),
    );

    return products
      .filter((product) => product.isActive)
      .filter((product) => comparable(product.id) !== comparable(selectedParent.id))
      .filter((product) => !usedSourceKeys.has(`product:${comparable(product.id)}`))
      .filter((product) => {
        const provisional: ProductComponent = {
          id: editingComponentId ?? '__component-candidate__',
          parentProductId: selectedParent.id,
          sourceType: 'product',
          sourceId: product.id,
          role: form.role,
          quantityPerParent: 1,
        };

        try {
          validateProductCompositionGraph([...graphWithoutCurrentEdit, provisional]);
          return true;
        } catch {
          return false;
        }
      })
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  }, [components, editingComponentId, form.role, products, selectedParent, usedSourceKeys]);

  const preview = useMemo(
    () => selectedParent
      ? buildProductCompositionPreview(selectedParent.id, products, materials, components)
      : [],
    [components, materials, products, selectedParent],
  );

  const writable = Boolean(selectedParent?.isActive);
  const sourceCandidates = form.sourceType === 'material' ? materialCandidates : productCandidates;

  function resetForm(clearFeedback = true) {
    setEditingComponentId(null);
    setForm(EMPTY_COMPONENT_FORM);
    if (clearFeedback) setFeedback(null);
  }

  function changeParent(parentId: string) {
    setSelectedParentId(parentId);
    resetForm();
  }

  async function submitComponent(event: FormEvent) {
    event.preventDefault();
    setFeedback(null);

    if (!selectedParent) {
      setFeedback({ type: 'error', message: 'Select a parent Product before editing composition.' });
      return;
    }

    const candidate: ProductComponent = {
      id: form.id,
      parentProductId: selectedParent.id,
      sourceType: form.sourceType,
      sourceId: form.sourceId,
      role: form.role,
      quantityPerParent: Number(form.quantityPerParent),
      notes: form.notes,
    };

    try {
      if (editingComponentId) {
        await productComponentService.updateComponent(editingComponentId, {
          parentProductId: candidate.parentProductId,
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          role: candidate.role,
          quantityPerParent: candidate.quantityPerParent,
          notes: candidate.notes,
        });
        await reloadComponents();
        resetForm(false);
        setFeedback({ type: 'success', message: 'Component updated.' });
      } else {
        await productComponentService.createComponent(candidate);
        await reloadComponents();
        resetForm(false);
        setFeedback({ type: 'success', message: 'Component added.' });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    }
  }

  async function removeComponent(component: ProductComponent) {
    setFeedback(null);
    try {
      await productComponentService.removeComponent(component.id);
      await reloadComponents();
      if (comparable(editingComponentId ?? '') === comparable(component.id)) resetForm(false);
      setFeedback({ type: 'success', message: `${sourceLabel(component, products, materials)} removed from composition.` });
    } catch (error) {
      setFeedback({ type: 'error', message: errorMessage(error) });
    }
  }

  if (sourceError) return <div className="panel product-source-error" role="alert"><h2>Could not load components</h2><p>{sourceError}</p><button type="button" className="button button-primary" onClick={() => void reloadComponents()}>Retry loading</button></div>;

  if (catalogLoading && products.length === 0) {
    return <div className="panel empty-state"><p>Loading product composition workspace…</p></div>;
  }

  if (products.length === 0) {
    return (
      <div className="panel empty-state">
        <div className="empty-icon">◇</div>
        <h3>Create a Product first</h3>
        <p>Product composition needs a parent Product before Material or Product components can be added.</p>
      </div>
    );
  }

  return (
    <div className="components-workspace">
      <div className="panel composition-parent-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">PARENT PRODUCT</p>
            <h2>Composition editor</h2>
          </div>
          {selectedParent && (
            <span className={`status-pill ${selectedParent.isActive ? 'status-active' : ''}`}>
              {selectedParent.isActive ? 'Active' : 'Archived · read only'}
            </span>
          )}
        </div>
        <label className="field">
          <span>Product to compose</span>
          <select value={selectedParentId} onChange={(event) => changeParent(event.target.value)}>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · {product.id}{product.isActive ? '' : ' (archived)'}
              </option>
            ))}
          </select>
          <small>
            {selectedParent
              ? `${selectedParent.category} · ${parentComponents.length} immediate component${parentComponents.length === 1 ? '' : 's'}`
              : 'Choose a parent Product.'}
          </small>
        </label>
      </div>

      <div className="components-editor-layout">
        <form className="panel material-form component-editor-form" onSubmit={submitComponent}>
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">COMPONENT LINE</p>
              <h2>{editingComponentId ? 'Edit component' : 'Add component'}</h2>
            </div>
            {editingComponentId && <button type="button" className="text-button" onClick={() => resetForm()}>Cancel</button>}
          </div>

          {!writable && (
            <div className="feedback feedback-error">
              Archived parent Products are available for historical inspection but their composition cannot be changed.
            </div>
          )}

          <fieldset className="component-fieldset" disabled={!writable}>
            <div className="form-grid">
              <label className="field">
                <span>Component ID</span>
                <input
                  value={form.id}
                  disabled={Boolean(editingComponentId) || !writable}
                  onChange={(event) => setForm({ ...form, id: event.target.value })}
                  placeholder="COMP-PRODUCT-001"
                />
              </label>

              <label className="field">
                <span>Source type</span>
                <select
                  value={form.sourceType}
                  onChange={(event) => setForm({
                    ...form,
                    sourceType: event.target.value as ProductComponentSourceType,
                    sourceId: '',
                  })}
                >
                  <option value="material">Material</option>
                  <option value="product">Product</option>
                </select>
              </label>

              <label className="field field-wide">
                <span>{form.sourceType === 'material' ? 'Material source' : 'Product source'}</span>
                <select value={form.sourceId} onChange={(event) => setForm({ ...form, sourceId: event.target.value })}>
                  <option value="">Select {form.sourceType}</option>
                  {sourceCandidates.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name} · {source.id}{'baseUnit' in source ? ` · ${source.baseUnit}` : ''}
                    </option>
                  ))}
                </select>
                <small>
                  {form.sourceType === 'material'
                    ? 'Only active count-based (pc) Materials not already used by this parent are shown.'
                    : 'Only active non-self Product sources that keep the current composition graph acyclic are shown.'}
                </small>
              </label>

              <label className="field">
                <span>Role</span>
                <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as ProductComponentRole })}>
                  {PRODUCT_COMPONENT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </label>

              <label className="field">
                <span>Quantity per parent</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={form.quantityPerParent}
                  onChange={(event) => setForm({ ...form, quantityPerParent: event.target.value })}
                />
                <small>Positive whole-piece count.</small>
              </label>

              <label className="field field-wide">
                <span>Notes</span>
                <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Assembly or component notes…" />
              </label>
            </div>

            <button className="button button-primary button-full" type="submit">
              {editingComponentId ? 'Save component' : 'Add component'}
            </button>
          </fieldset>

          {feedback && <div role={feedback.type === 'error' ? 'alert' : 'status'} className={`feedback feedback-${feedback.type}`}>{feedback.message}</div>}
        </form>

        <div className="panel material-list component-summary-panel">
          <div className="panel-heading list-heading">
            <div>
              <p className="panel-kicker">CURRENT COMPOSITION</p>
              <h2>{selectedParent?.name ?? 'Selected Product'}</h2>
            </div>
            <div className="material-count"><strong>{parentComponents.length}</strong><span>lines</span></div>
          </div>

          {componentsLoading ? (
            <div className="empty-state"><p>Loading components…</p></div>
          ) : parentComponents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">＋</div>
              <h3>No component lines yet</h3>
              <p>Add a vessel, molded piece, insert, accessory, or another discrete assembly input.</p>
            </div>
          ) : (
            <div className="component-card-list">
              {parentComponents.map((component) => (
                <article className="component-card" key={component.id}>
                  <div>
                    <span className="component-type-pill">{component.sourceType === 'material' ? 'Material' : 'Product'}</span>
                    <strong>{component.quantityPerParent} × {sourceLabel(component, products, materials)}</strong>
                    <small>{component.role} · {component.sourceId} · {component.id}</small>
                    {component.notes && <p>{component.notes}</p>}
                  </div>
                  {writable && (
                    <div className="row-actions">
                      <button type="button" className="text-button" onClick={() => {
                        setEditingComponentId(component.id);
                        setForm(componentToForm(component));
                        setFeedback(null);
                      }}>Edit</button>
                      <button type="button" className="text-button danger" onClick={() => void removeComponent(component)}>Remove</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel composition-preview-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">NESTED COMPOSITION PREVIEW</p>
            <h2>Assembly tree</h2>
          </div>
          <span className="status-pill">Read only</span>
        </div>
        <p className="composition-preview-help">
          Product-backed components expand into their own saved component lines for inspection only. This preview does not calculate capacity, cost, or manufacture missing child stock.
        </p>
        {preview.length === 0 ? (
          <div className="empty-state compact-empty"><p>No nested composition to preview.</p></div>
        ) : (
          <div className="composition-tree-root">
            <div className="composition-root-label">
              <strong>{selectedParent?.name ?? selectedParentId}</strong>
              <small>{selectedParentId}</small>
            </div>
            <ul className="composition-tree-list">
              {preview.map((node) => <PreviewBranch key={`${node.componentId}:${node.sourceType}:${node.sourceId}`} node={node} />)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
