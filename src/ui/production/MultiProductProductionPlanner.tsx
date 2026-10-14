import { useEffect, useMemo, useState } from 'react';
import {
  moldService,
  plasterMoldOperationalPreviewService,
  plasterMoldYieldProfileService,
  productionRequirementService,
} from '../../application/session';
import type { Material } from '../../domain/materials';
import type { Product } from '../../domain/products';
import type { Mold } from '../../domain/molds';
import type { PlasterMoldYieldProfile } from '../../domain/plasterMoldYieldProfiles';
import type { MultiProductionEntry } from './multiProductionSummary';
import { summarizeMultiProduction } from './multiProductionSummary';
import { printMultiProductionSheet } from './multiProductionPrint';
import './multiProduction.css';

interface DraftLine {
  key: number;
  productId: string;
  quantity: string;
  moldId: string;
}

const number = (value: number) => value.toLocaleString('en-PH', { maximumFractionDigits: 4 });
const canonical = (value: string) => value.trim().toLocaleLowerCase();

export function MultiProductProductionPlanner({
  products,
  materials,
  initialProductId,
  initialQuantity,
}: {
  products: readonly Product[];
  materials: readonly Material[];
  initialProductId: string;
  initialQuantity: string;
}) {
  const [lines, setLines] = useState<DraftLine[]>([
    { key: 1, productId: initialProductId, quantity: initialQuantity === '0' ? '1' : initialQuantity || '1', moldId: '' },
  ]);
  const [nextKey, setNextKey] = useState(2);
  const [molds, setMolds] = useState<Mold[]>([]);
  const [profiles, setProfiles] = useState<PlasterMoldYieldProfile[]>([]);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [result, setResult] = useState<{ signature: string; entries: MultiProductionEntry[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const activeProducts = products.filter((product) => product.isActive);
  const profileByMold = useMemo(
    () => new Map(profiles.map((profile) => [canonical(profile.moldId), profile])),
    [profiles],
  );
  const configuredMolds = useMemo(
    () => molds.filter((mold) => mold.isActive && profileByMold.has(canonical(mold.id))),
    [molds, profileByMold],
  );
  const firstMold = (productId: string) =>
    configuredMolds.find((mold) => canonical(mold.productId) === canonical(productId))?.id ?? '';

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      moldService.listMolds({ active: true }),
      plasterMoldYieldProfileService.listProfiles({ active: true }),
    ]).then(([nextMolds, nextProfiles]) => {
      if (cancelled) return;
      setMolds(nextMolds);
      setProfiles(nextProfiles);
      setSourceLoading(false);
      setSourceError(null);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setSourceLoading(false);
      setSourceError(error instanceof Error ? error.message : 'Could not load Mold Formula sources.');
    });
    return () => { cancelled = true; };
  }, []);

  // Auto-select a configured active Mold only when sources first load.
  useEffect(() => {
    if (sourceLoading || sourceError) return;
    setLines((current) => current.map((line) => ({
      ...line,
      moldId: line.moldId || firstMold(line.productId),
    })));
    // Configured Mold list changes only on initial source load.
  }, [sourceLoading, sourceError, configuredMolds]);

  const signature = JSON.stringify(lines.map((line) => [
    line.key, line.productId, line.quantity, line.moldId,
  ]));
  const inputsValid = lines.length > 0 && lines.every((line) =>
    Boolean(line.productId) && line.quantity.trim() !== '' &&
    Number.isSafeInteger(Number(line.quantity)) && Number(line.quantity) > 0,
  );
  const unique = new Set(lines.map((line) => canonical(line.productId))).size === lines.length;

  useEffect(() => {
    setResult(null);
    if (sourceLoading || sourceError || !inputsValid || !unique) {
      setBusy(false);
      return;
    }
    let cancelled = false;
    setBusy(true);
    void Promise.all(lines.map(async (line): Promise<MultiProductionEntry> => {
      const product = products.find((candidate) => canonical(candidate.id) === canonical(line.productId))!;
      const selectedProfile = profileByMold.get(canonical(line.moldId)) ?? null;
      const [planResult, formulaResult] = await Promise.allSettled([
        productionRequirementService.plan(product.id, Number(line.quantity)),
        line.moldId
          ? plasterMoldOperationalPreviewService.preview(line.moldId, Number(line.quantity))
          : Promise.resolve(null),
      ]);
      return {
        product,
        quantity: Number(line.quantity),
        plan: planResult.status === 'fulfilled' ? planResult.value : null,
        formula: formulaResult.status === 'fulfilled' ? formulaResult.value : null,
        profile: selectedProfile,
        ...(planResult.status === 'rejected'
          ? { error: planResult.reason instanceof Error ? planResult.reason.message : 'Could not resolve requirements.' }
          : {}),
        ...(formulaResult.status === 'rejected'
          ? { formulaError: formulaResult.reason instanceof Error ? formulaResult.reason.message : 'Mold Formula estimate failed.' }
          : {}),
      };
    })).then((entries) => {
      if (!cancelled) { setResult({ signature, entries }); setBusy(false); }
    }).catch(() => {
      if (!cancelled) setBusy(false);
    });
    return () => { cancelled = true; };
  }, [signature, sourceLoading, sourceError, profileByMold, products]);

  const current = result?.signature === signature ? result.entries : null;
  const summary = useMemo(
    () => current ? summarizeMultiProduction(current, materials) : null,
    [current, materials],
  );
  const usedIds = new Set(lines.map((line) => canonical(line.productId)));
  const canAdd = activeProducts.some((product) => !usedIds.has(canonical(product.id)));

  function updateLine(key: number, changes: Partial<DraftLine>) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...changes } : line));
    setPrintError(null);
  }

  function addLine() {
    const product = activeProducts.find((candidate) => !usedIds.has(canonical(candidate.id)));
    if (!product) return;
    setLines((current) => [...current, {
      key: nextKey, productId: product.id, quantity: '1', moldId: firstMold(product.id),
    }]);
    setNextKey((value) => value + 1);
  }

  function handlePrint() {
    if (!current || !summary || busy || !inputsValid || !unique) return;
    try {
      printMultiProductionSheet(current, summary);
      setPrintError(null);
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : 'Could not print combined plan.');
    }
  }

  const materialTable = (rows: NonNullable<typeof summary>['directMaterials'], label: string) =>
    <div className="table-wrap multi-production-table-wrap" tabIndex={0} role="region" aria-label={label}>
      <table className="responsive-table materials-table multi-production-table">
        <thead><tr><th>Material</th><th>Total required</th><th>On hand</th><th>Still needed</th></tr></thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.materialId}>
              <td><strong>{row.name}</strong><small>{row.materialId}</small></td>
              <td>{number(row.required)} {row.unit}</td>
              <td>{row.available === null ? 'Unresolved' : `${number(row.available)} ${row.unit}`}</td>
              <td>{row.shortage === null ? 'Check stock' : `${number(row.shortage)} ${row.unit}`}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4}>No derivable material requirements.</td></tr>}
        </tbody>
      </table>
    </div>;

  return (
    <section className="multi-production-planner" aria-label="Multi-product production batch" aria-busy={busy || sourceLoading}>
      <div className="panel multi-production-setup">
        <div className="panel-heading multi-production-heading">
          <div className="multi-production-heading-copy">
            <p className="panel-kicker">MULTI-PRODUCT BATCH</p>
            <h2>Products to make</h2>
            <p>Choose each product, its finished-piece target, and an optional configured Mold Formula.</p>
            <span className="multi-production-count">{lines.length} {lines.length === 1 ? 'product' : 'products'} selected</span>
          </div>
          <button type="button" className="button button-secondary multi-production-add-button" onClick={addLine} disabled={!canAdd}>Add another product</button>
        </div>
        <div className="multi-production-lines">
          {lines.map((line, index) => {
            const eligibleMolds = configuredMolds.filter(
              (mold) => canonical(mold.productId) === canonical(line.productId),
            );
            return <div className="multi-production-line" key={line.key} aria-label={`Production item ${index + 1}`}>
              <span className="multi-production-line-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <label className="field"><span>Product</span>
                <select aria-label={`Production product ${index + 1}`} value={line.productId} onChange={(event) =>
                  updateLine(line.key, { productId: event.target.value, moldId: firstMold(event.target.value) })
                }>
                  {activeProducts.map((product) => <option key={product.id} value={product.id}
                    disabled={product.id !== line.productId && usedIds.has(canonical(product.id))}>
                    {product.name}
                  </option>)}
                </select>
              </label>
              <label className="field"><span>Finished pieces</span>
                <input aria-label={`Production quantity ${index + 1}`} type="number" min="1" step="1"
                  value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} />
              </label>
              <label className="field"><span>Mold Formula (theoretical)</span>
                <select aria-label={`Production Mold Formula ${index + 1}`} value={line.moldId}
                  disabled={sourceLoading} onChange={(event) => updateLine(line.key, { moldId: event.target.value })}>
                  <option value="">No Mold Formula</option>
                  {eligibleMolds.map((mold) => <option key={mold.id} value={mold.id}>{mold.name}</option>)}
                </select>
              </label>
              <button type="button" className="button button-secondary multi-production-remove" disabled={lines.length === 1}
                onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}>
                Remove
              </button>
            </div>;
          })}
        </div>
        {!inputsValid && <p className="feedback feedback-error" role="alert">Every product needs a positive whole-number quantity.</p>}
        {!unique && <p className="feedback feedback-error" role="alert">Each product may only appear once; change the quantity on its existing line.</p>}
        {sourceError && <p className="feedback feedback-error" role="alert">{sourceError}</p>}
      </div>
      {busy || sourceLoading ? <div className="panel multi-production-loading" role="status">Calculating combined material and Mold Formula requirements…</div> : summary && current ? <>
        <section className="panel multi-production-summary">
          <div className="panel-heading multi-production-heading">
            <div className="multi-production-heading-copy">
              <p className="panel-kicker">BATCH SUMMARY</p>
              <h2>{summary.products} Products · {number(summary.finishedPieces)} pieces</h2>
              <span className={`multi-production-status ${summary.ready ? 'is-ready' : 'is-warning'}`}>
                {summary.ready ? 'Ready to prepare' : 'Review requirements'}
              </span>
            </div>
            <button type="button" className="button button-primary multi-production-print-button" onClick={handlePrint}>Print / Save as PDF</button>
          </div>
          <p className="multi-production-description">Stock is checked once per material against the combined requirement, not repeatedly per product.</p>
          {printError && <p role="alert" className="feedback feedback-error">{printError}</p>}
          {summary.warnings.length > 0 && <div className="feedback feedback-error" role="status">
            <strong>Check unresolved requirements</strong>
            <ul>{summary.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          </div>}
        </section>
        <section className="panel multi-production-materials-panel" aria-label="Combined Product Yield materials">
          <p className="panel-kicker">AUTHORITATIVE PRODUCT / YIELD</p>
          <h2>Total direct materials to prepare</h2>
          <p>Includes each product’s recipe/Yield quantities and safety-waste rate. If any recipe is unresolved, these are known subtotals only.</p>
          {materialTable(summary.directMaterials, 'Combined direct material requirements')}
        </section>
        <section className="panel multi-production-mixture-panel" aria-label="Formula mixing groups">
          <p className="panel-kicker">THEORETICAL MOLD FORMULAS</p>
          <h2>Mixtures to prepare</h2>
          <p>Same material identities and mixing ratios share a group. Different formulas remain separate. Each mold’s complete-pour rounding is preserved.</p>
          {summary.mixtureGroups.map((group, index) => (
            <div className="multi-production-group" key={group.key} aria-label={`Mixture group ${index + 1}`}>
              <div className="multi-production-group-heading">
                <h3>Mixture group {index + 1}</h3>
                <strong>{number(group.totalMixtureGrams)} g total mixture · {number(group.requiredPours)} complete pours</strong>
              </div>
              <p className="multi-production-group-products">{group.products.map((entry) => `${entry.name} × ${entry.quantity} (${entry.pours} pours, ${entry.moldName})`).join(' · ')}</p>
              <div className="multi-production-mixture-lines">{group.materials.map((row) =>
                <span key={row.role}><strong>{row.role}</strong> {row.name}: {number(row.grams)} g</span>)}</div>
            </div>
          ))}
          {summary.mixtureGroups.length === 0 && <p className="multi-production-empty">No Mold Formula selected. Choose an active configured mold to calculate a theoretical mixture.</p>}
        </section>
        <section className="panel multi-production-materials-panel" aria-label="Combined theoretical material totals">
          <p className="panel-kicker">MOLD FORMULA STOCK PLANNING</p>
          <h2>Total formula materials to prepare</h2>
          <p><strong>{number(summary.formulaMixtureGrams)} g</strong> combined theoretical mixture across all groups. These totals are an alternative view and must not be added to the Product/Yield requirements above.</p>
          {materialTable(summary.formulaMaterials, 'Combined theoretical formula materials')}
        </section>
      </> : null}
    </section>
  );
}
