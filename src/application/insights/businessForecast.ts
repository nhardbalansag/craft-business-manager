import { validateScenario, type ForecastScenario, type ForecastResult } from '../../domain/businessInsights';
import { addMoney, cents } from './businessReports';

export function forecastBusiness(scenario: ForecastScenario): ForecastResult {
  validateScenario(scenario);
  const price = cents(scenario.averageUnitPrice), variable = cents(scenario.unitVariableCost), fixed = cents(scenario.monthlyFixedExpenses);
  let cash = addMoney(addMoney(cents(scenario.openingCash), cents(scenario.fundingAmount)), -cents(scenario.upfrontInvestment));
  let minimum = cash, revenue = 0, result = 0, constrained = false;
  const [year, month] = scenario.startMonth.split('-').map(Number);
  const rows: ForecastResult['rows'] = [];
  for (let index = 0; index < 12; index++) {
    const demand = Math.floor(scenario.monthlyUnits * Math.pow(1 + scenario.monthlyGrowthPercent / 100, index));
    constrained ||= demand > scenario.monthlyCapacity;
    const units = Math.min(demand, scenario.monthlyCapacity);
    const sales = addMoney(0, units * price), cost = addMoney(0, units * variable);
    const operatingResult = addMoney(sales - cost, -fixed);
    cash = addMoney(cash, operatingResult); minimum = Math.min(minimum, cash);
    revenue = addMoney(revenue, sales); result = addMoney(result, operatingResult);
    rows.push({ month: new Date(Date.UTC(year, month - 1 + index, 1)).toISOString().slice(0, 7), units,
      revenue: sales / 100, variableCost: cost / 100, fixedCost: fixed / 100, operatingResult: operatingResult / 100, cash: cash / 100 });
  }
  return { rows, revenue: revenue / 100, operatingResult: result / 100, endingCash: cash / 100, minimumCash: minimum / 100,
    additionalFunding: Math.max(0, -minimum) / 100, breakEvenUnits: price > variable ? Math.ceil(fixed / (price - variable)) : null,
    capacityConstrained: constrained };
}
