import { safeParse } from "./utils";

/* =========================
   Storage
========================= */
export function loadYearData(year) {
  const key = `fm_data_${year}`;
  const json = localStorage.getItem(key);

  if (json) {
    const data = safeParse(json, { expenseData: [], incomeData: [], transactions: [] });
    return {
      expenseData: Array.isArray(data.expenseData) ? data.expenseData : [],
      incomeData: Array.isArray(data.incomeData) ? data.incomeData : [],
      transactions: Array.isArray(data.transactions) ? data.transactions : [],
    };
  }

  const payload = { expenseData: [], incomeData: [], transactions: [] };
  localStorage.setItem(key, JSON.stringify(payload));
  return payload;
}

export function saveYearData(year, payload) {
  const key = `fm_data_${year}`;
  const safePayload = {
    expenseData: Array.isArray(payload.expenseData) ? payload.expenseData : [],
    incomeData: Array.isArray(payload.incomeData) ? payload.incomeData : [],
    transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
  };
  localStorage.setItem(key, JSON.stringify(safePayload));
}
