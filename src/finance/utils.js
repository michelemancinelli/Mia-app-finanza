/* =========================
   CONFIG + CONSTANTS
========================= */
export const YEAR_START = 2025;
export const YEAR_END = 2040;

export const months = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export const shortMonths = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export const INCOME_ITEM_NAME = "__TOTALE__";
export const INCOME_ITEM_LABEL = "Stipendio";

/* =========================
   HELPERS (pure)
========================= */
export function formatMoney(val) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(val) || 0);
}

export function sumArr(arr) {
  return (arr || []).reduce((a, b) => a + (Number(b) || 0), 0);
}

export function isoToday() {
  return new Date().toISOString().split("T")[0];
}

export function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function clampYear(y) {
  const ny = Number(y);
  if (!Number.isFinite(ny)) return YEAR_START;
  return Math.min(YEAR_END, Math.max(YEAR_START, ny));
}

export function zeroizeLike(list, isIncome = false) {
  return (list || []).map((it) => ({
    group: it.group,
    name: isIncome ? INCOME_ITEM_NAME : it.name,
    budget: Array(12).fill(0),
    baseActual: Array(12).fill(0),
  }));
}

/* =========================
   Data helpers (pure)
========================= */
export function groupByGroup(items) {
  const out = {};
  for (const it of items || []) {
    const g = it.group || "Senza categoria";
    if (!out[g]) out[g] = [];
    out[g].push(it);
  }
  return out;
}

export function calcGroupTotals(type, items, currentMonthView, getTotalActual) {
  let groupBudget = 0;
  let groupActual = 0;

  for (const it of items) {
    const budgetVal = currentMonthView === 12 ? sumArr(it.budget) : Number(it.budget?.[currentMonthView] || 0);
    groupBudget += budgetVal;

    if (currentMonthView === 12) {
      let tot = 0;
      for (let m = 0; m < 12; m++) tot += getTotalActual(type, it.group, it.name, m);
      groupActual += tot;
    } else {
      groupActual += getTotalActual(type, it.group, it.name, currentMonthView);
    }
  }

  return { groupBudget, groupActual };
}

export function normalizeIncomeData(arr) {
  const input = Array.isArray(arr) ? arr : [];
  const byGroup = new Map();

  for (const it of input) {
    if (!it?.group) continue;
    const group = String(it.group);
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(it);
  }

  const out = [];
  for (const [group, items] of byGroup.entries()) {
    const existing = items.find((x) => x.name === INCOME_ITEM_NAME) || items[0];
    out.push({
      group,
      name: INCOME_ITEM_NAME,
      budget: Array.isArray(existing?.budget) ? existing.budget : Array(12).fill(0),
      baseActual: Array.isArray(existing?.baseActual) ? existing.baseActual : Array(12).fill(0),
    });
  }

  return out;
}
