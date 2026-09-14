const modules = [
  ['Materials', 'Package costing, standard units, suppliers, and current stock.'],
  ['Calibration', 'Cup-to-weight calibration for plaster and other dry materials.'],
  ['Products', 'Paintable art, candle pots, candles, recipes, and pricing.'],
  ['Mold Yield', 'Learn producible quantity from real sample batches without mold volume.'],
  ['Vessels', 'Support purchased containers and multiple molded vessel/components per candle.'],
  ['Production', 'Estimate capacity from the most constrained material or component.'],
];

export default function App() {
  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">CRAFT BUSINESS MANAGER</p>
        <h1>Costing and production planning built around real craft batches.</h1>
        <p>
          React/Tauri foundation for plaster art, handmade candle pots, and candles.
          Excel persistence will sit behind a replaceable storage adapter.
        </p>
      </header>

      <section className="grid" aria-label="Planned modules">
        {modules.map(([title, description]) => (
          <article className="card" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <section className="status">
        <strong>Foundation status:</strong> domain contracts and costing primitives are ready for implementation.
      </section>
    </main>
  );
}
