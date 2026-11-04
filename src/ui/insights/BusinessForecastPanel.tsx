import { useState } from 'react';
import type { ForecastScenario } from '../../domain/businessInsights';
import { forecastBusiness } from '../../application/insights/businessForecast';
import { businessMoney, FORECAST_CAVEATS } from '../../application/insights/businessDocuments';

export function BusinessForecastPanel({ scenarios, onChange, disabled }: { scenarios: ForecastScenario[]; onChange: (s: ForecastScenario[]) => void; disabled: boolean }) {
  const [selected, setSelected] = useState(scenarios[1]?.id ?? scenarios[0].id);
  const scenario = scenarios.find(s => s.id === selected) ?? scenarios[0];
  const change = (s: ForecastScenario) => onChange(scenarios.map(row => row.id === s.id ? s : row));
  const results = scenarios.map(s => { try { return { scenario: s, forecast: forecastBusiness(s), error: '' }; } catch (e) { return { scenario: s, forecast: null, error: e instanceof Error ? e.message : 'Invalid inputs' }; } });
  const current = results.find(r => r.scenario.id === scenario.id)!;
  const fields: [keyof ForecastScenario, string, number, number, string][] = [
    ['monthlyUnits', 'Initial units per month', 0, 1000000, '1'], ['monthlyCapacity', 'Monthly capacity (units)', 0, 1000000, '1'],
    ['averageUnitPrice', 'Average selling price / unit (PHP)', 0, 1e9, '0.01'], ['unitVariableCost', 'Variable cost / unit (PHP)', 0, 1e9, '0.01'],
    ['monthlyFixedExpenses', 'Monthly fixed expenses (PHP)', 0, 1e9, '0.01'], ['monthlyGrowthPercent', 'Monthly demand growth (%)', -50, 100, '0.1'],
    ['openingCash', 'Forecast opening cash (PHP)', 0, 1e9, '0.01'], ['fundingAmount', 'Forecast funding received (PHP)', 0, 1e9, '0.01'], ['upfrontInvestment', 'Upfront investment (PHP)', 0, 1e9, '0.01'],
  ];
  return <section className="panel insights-panel" aria-labelledby="forecast-title"><h2 id="forecast-title">12-month scenario planner</h2><p className="insights-muted">Enter your own assumptions for each scenario. No growth rates or sales targets are invented. Capacity is your planning input.</p>
    <div className="insights-scenarios">{results.map(({ scenario: s, forecast: f }) => <button type="button" className={scenario.id === s.id ? 'insights-scenario selected' : 'insights-scenario'} aria-pressed={scenario.id === s.id} key={s.id} onClick={() => setSelected(s.id)}><strong>{s.name}</strong><span>{f ? businessMoney(f.revenue) : 'Check inputs'}</span><small>Projected annual sales</small></button>)}</div>
    <div className="insights-form-grid"><label className="field"><span>Scenario name</span><input value={scenario.name} maxLength={100} disabled={disabled} onChange={e => change({ ...scenario, name: e.target.value })} /></label><label className="field"><span>Forecast start month</span><input type="month" min="2000-01" max="2100-12" value={scenario.startMonth} disabled={disabled} onChange={e => change({ ...scenario, startMonth: e.target.value })} /></label>
      {fields.map(([key, label, min, max, step]) => <label className="field" key={key}><span>{label}</span><input type="number" value={scenario[key]} min={min} max={max} step={step} disabled={disabled} onChange={e => change({ ...scenario, [key]: Number(e.target.value) })} /></label>)}
    </div>
    {current.error && <p role="alert" className="feedback feedback-error">{current.error}</p>}
    {current.forecast && <><div className="insights-metrics insights-forecast-metrics">{[
      ['Projected operating result', businessMoney(current.forecast.operatingResult)], ['Projected ending cash', businessMoney(current.forecast.endingCash)],
      ['Additional funding needed', businessMoney(current.forecast.additionalFunding)], ['Break-even units / month', current.forecast.breakEvenUnits === null ? 'No positive unit contribution' : String(current.forecast.breakEvenUnits)],
    ].map(([label, value]) => <article key={label} className="insights-metric"><span>{label}</span><strong>{value}</strong></article>)}</div>
      {current.forecast.capacityConstrained && <p className="insights-callout">Demand exceeds entered capacity in one or more months. Projected sales are capped at {scenario.monthlyCapacity} units/month.</p>}
      {current.forecast.breakEvenUnits !== null && current.forecast.breakEvenUnits > scenario.monthlyCapacity && <p className="insights-callout">Break-even exceeds the entered monthly capacity. Review price, costs, or capacity.</p>}
      <div className="insights-table-wrap"><table><caption>Forecast figures · PHP · {scenario.name}</caption><thead><tr><th>Month</th><th>Units</th><th>Sales</th><th>Variable costs</th><th>Fixed costs</th><th>Operating result</th><th>Cash</th></tr></thead><tbody>{current.forecast.rows.map(r => <tr key={r.month}><td>{r.month}</td><td>{r.units}</td><td>{businessMoney(r.revenue)}</td><td>{businessMoney(r.variableCost)}</td><td>{businessMoney(r.fixedCost)}</td><td>{businessMoney(r.operatingResult)}</td><td>{businessMoney(r.cash)}</td></tr>)}</tbody></table></div></>}
    <p className="insights-callout">{FORECAST_CAVEATS}</p>
  </section>;
}
