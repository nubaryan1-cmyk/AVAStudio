/**
 * Unit economics (TASK 25.6). Сводит стоимость действий (AI, рендер, постинг = телефон+прокси,
 * хранение/CDN) и считает cost-per-action / cost-per-user, маржу по тарифу, убыточные сегменты.
 * Деньги — десятичные строки (как Money 9.1), но для расчётов используем number с округлением.
 */
export interface ActionCosts {
  ai: number;
  render: number;
  posting: number;
  storage: number;
}

export const ZERO_COSTS: ActionCosts = { ai: 0, render: 0, posting: 0, storage: 0 };

/** Суммарная стоимость набора действий пользователя за период (USD). */
export function totalCost(costs: ActionCosts): number {
  return round6(costs.ai + costs.render + costs.posting + costs.storage);
}

export interface UserEconomics {
  userId: string;
  costs: ActionCosts;
  /** Выручка с пользователя за период (цена тарифа). */
  revenue: number;
}

export interface MarginResult {
  userId: string;
  cost: number;
  revenue: number;
  margin: number;
  marginPct: number;
  /** Убыточный сегмент: стоимость обслуживания > выручки. */
  unprofitable: boolean;
}

export function userMargin(u: UserEconomics): MarginResult {
  const cost = totalCost(u.costs);
  const margin = round6(u.revenue - cost);
  const marginPct = u.revenue > 0 ? Math.round((margin / u.revenue) * 1000) / 10 : cost > 0 ? -100 : 0;
  return { userId: u.userId, cost, revenue: u.revenue, margin, marginPct, unprofitable: cost > u.revenue };
}

/** cost-per-action: общая стоимость / число действий. */
export function costPerAction(costs: ActionCosts, actions: number): number {
  return actions > 0 ? round6(totalCost(costs) / actions) : 0;
}

/** Убыточные пользователи (для алерта на сегмент). */
export function unprofitableUsers(users: readonly UserEconomics[]): MarginResult[] {
  return users.map(userMargin).filter((m) => m.unprofitable);
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
