import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  MinusCircle,
  PlusCircle,
  PieChart,
  Search,
  Pencil,
  Trash2,
  X,
  Info,
  RefreshCw,
  Upload,
  Download,
} from "lucide-react";

/* =========================
   CONFIG
========================= */
const YEAR_START = 2025;
const YEAR_END = 2040;

const months = [
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
const shortMonths = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const INCOME_ITEM_NAME = "__TOTALE__";
const INCOME_ITEM_LABEL = "Stipendio";

/* =========================
   HELPERS
========================= */
function formatMoney(val) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(val) || 0);
}
function sumArr(arr) {
  return (arr || []).reduce((a, b) => a + (Number(b) || 0), 0);
}
function isoToday() {
  return new Date().toISOString().split("T")[0];
}
function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
function clampYear(y) {
  const ny = Number(y);
  if (!Number.isFinite(ny)) return YEAR_START;
  return Math.min(YEAR_END, Math.max(YEAR_START, ny));
}

function zeroizeLike(list, isIncome = false) {
  return (list || []).map((it) => ({
    group: it.group,
    name: isIncome ? INCOME_ITEM_NAME : it.name,
    budget: Array(12).fill(0),
    baseActual: Array(12).fill(0),
  }));
}

/* =========================
   App
========================= */
export default function App() {
  const [currentYear, setCurrentYear] = useState(YEAR_START);
  const [currentMonthView, setCurrentMonthView] = useState(new Date().getMonth()); // 0..11 (12 = annual)

  const [expenseData, setExpenseData] = useState([]);
  const [incomeData, setIncomeData] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [collapsed, setCollapsed] = useState({}); // `${type}|${group}` -> bool

  // Modals
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMsg, setAlertMsg] = useState("Messaggio");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmRef = useRef({ onConfirm: null });

  const [manageOpen, setManageOpen] = useState(false);
  const [manageType, setManageType] = useState("expense"); // expense | income
  const [manageEditIndex, setManageEditIndex] = useState(-1);
  const [manageCategory, setManageCategory] = useState("");
  const [manageName, setManageName] = useState(""); // only expense
  const manageNameRef = useRef(null);

  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transForm, setTransForm] = useState({
    id: "",
    type: "expense",
    date: isoToday(),
    group: "",
    name: "",
    amount: "",
    note: "",
  });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailCtx, setDetailCtx] = useState(null); // {type, group, name, monthIndex}

  const [reportOpen, setReportOpen] = useState(false);

  const didInit = useRef(false);

  const anyModalOpen = alertOpen || confirmOpen || manageOpen || transactionOpen || detailOpen || reportOpen;
  useEffect(() => {
    if (anyModalOpen) document.body.classList.add("modal-active");
    else document.body.classList.remove("modal-active");
  }, [anyModalOpen]);

  // init
  useEffect(() => {
    const storedYear = localStorage.getItem("fm_current_year");
    const finalYear = clampYear(storedYear ?? YEAR_START);
    setCurrentYear(finalYear);

    const loaded = loadYearData(finalYear);
    setExpenseData(Array.isArray(loaded.expenseData) ? loaded.expenseData : []);
    setIncomeData(normalizeIncomeData(Array.isArray(loaded.incomeData) ? loaded.incomeData : []));
    setTransactions(Array.isArray(loaded.transactions) ? loaded.transactions : []);

    didInit.current = true;
  }, []);

  // save
  useEffect(() => {
    if (!didInit.current) return;
    saveYearData(currentYear, { expenseData, incomeData, transactions });
  }, [currentYear, expenseData, incomeData, transactions]);

  function showAlert(msg) {
    setAlertMsg(msg || "Messaggio");
    setAlertOpen(true);
  }
  function showConfirm(onConfirm) {
    confirmRef.current.onConfirm = onConfirm;
    setConfirmOpen(true);
  }

  function changeYear(newYear) {
    const ny = clampYear(newYear);

    saveYearData(currentYear, { expenseData, incomeData, transactions });

    localStorage.setItem("fm_current_year", String(ny));
    const loaded = loadYearData(ny);

    const loadedExpense = Array.isArray(loaded.expenseData) ? loaded.expenseData : [];
    const loadedIncome = Array.isArray(loaded.incomeData) ? loaded.incomeData : [];
    const loadedTx = Array.isArray(loaded.transactions) ? loaded.transactions : [];

    const nextExpense =
      loadedExpense.length > 0 ? loadedExpense : expenseData.length > 0 ? zeroizeLike(expenseData, false) : [];
    const nextIncomeRaw =
      loadedIncome.length > 0 ? loadedIncome : incomeData.length > 0 ? zeroizeLike(incomeData, true) : [];
    const nextIncome = normalizeIncomeData(nextIncomeRaw);

    setCurrentYear(ny);
    setExpenseData(nextExpense);
    setIncomeData(nextIncome);
    setTransactions(loadedTx.length > 0 ? loadedTx : loadedExpense.length > 0 || loadedIncome.length > 0 ? loadedTx : []);
    setCollapsed({});
  }

  function askResetYearTotals() {
    showConfirm(() => {
      setExpenseData((prev) => prev.map((it) => ({ ...it, budget: Array(12).fill(0), baseActual: Array(12).fill(0) })));
      setIncomeData((prev) =>
        normalizeIncomeData(prev.map((it) => ({ ...it, budget: Array(12).fill(0), baseActual: Array(12).fill(0) })))
      );
      setTransactions([]);
      showAlert("Reset completato. Celle azzerate.");
    });
  }

  function toggleGroup(type, group) {
    const key = `${type}|${group}`;
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function isCollapsed(type, group) {
    return !!collapsed[`${type}|${group}`];
  }

  function getTotalActual(type, group, name, monthIndex) {
    const list = type === "expense" ? expenseData : incomeData;
    const item = list.find((i) => i.group === group && i.name === name);
    if (!item) return 0;

    let val = Number(item.baseActual?.[monthIndex] || 0);
    const related = transactions.filter((t) => {
      const d = new Date(t.date);
      return t.type === type && t.group === group && t.name === name && d.getMonth() === monthIndex;
    });
    for (const t of related) val += Number(t.amount || 0);
    return val;
  }

  function getItemBudget(item) {
    if (currentMonthView === 12) return sumArr(item.budget);
    return Number(item.budget?.[currentMonthView] || 0);
  }
  function getItemActual(type, item) {
    if (currentMonthView === 12) {
      let tot = 0;
      for (let m = 0; m < 12; m++) tot += getTotalActual(type, item.group, item.name, m);
      return tot;
    }
    return getTotalActual(type, item.group, item.name, currentMonthView);
  }

  function updateBudget(type, itemIndex, value) {
    if (currentMonthView === 12) return;
    const v = Number(value) || 0;

    if (type === "expense") {
      setExpenseData((prev) => {
        const next = [...prev];
        const item = { ...next[itemIndex] };
        const b = [...(item.budget || Array(12).fill(0))];
        b[currentMonthView] = v;
        item.budget = b;
        next[itemIndex] = item;
        return next;
      });
    } else {
      setIncomeData((prev) => {
        const next = [...prev];
        const item = { ...next[itemIndex] };
        const b = [...(item.budget || Array(12).fill(0))];
        b[currentMonthView] = v;
        item.budget = b;
        next[itemIndex] = item;
        return normalizeIncomeData(next);
      });
    }
  }

  function openAddCategoryModal(type = "expense") {
    setManageOpen(true);
    setManageType(type);
    setManageEditIndex(-1);
    setManageCategory("");
    setManageName("");
    setTimeout(() => manageNameRef.current?.focus?.(), 50);
  }
  function quickAddSubItem(group) {
    setManageOpen(true);
    setManageType("expense");
    setManageEditIndex(-1);
    setManageCategory(group);
    setManageName("");
    setTimeout(() => manageNameRef.current?.focus?.(), 60);
  }
  function switchManageType(type) {
    setManageType(type);
    setManageEditIndex(-1);
    setManageCategory("");
    setManageName("");
  }
  function getManageList() {
    return manageType === "expense" ? expenseData : incomeData;
  }

  function saveManagedItem() {
    const group = manageCategory.trim();
    if (!group) return showAlert("Inserisci la categoria");

    const name = manageType === "income" ? INCOME_ITEM_NAME : manageName.trim();
    if (manageType === "expense" && !name) return showAlert("Inserisci anche la sottocategoria");

    const list = getManageList();
    const exists = list.find((it, i) => {
      if (i === manageEditIndex) return false;
      if (manageType === "income") return it.group.toLowerCase() === group.toLowerCase();
      return it.group.toLowerCase() === group.toLowerCase() && it.name.toLowerCase() === name.toLowerCase();
    });
    if (exists) return showAlert("Esiste già.");

    const applyUpdate = (setter) => {
      setter((prev) => {
        const next = [...prev];

        if (manageEditIndex > -1) {
          const old = next[manageEditIndex];
          const oldGroup = old.group;
          const oldName = old.name;

          next[manageEditIndex] = { ...old, group, name };

          setTransactions((txPrev) =>
            txPrev.map((t) => {
              if (t.type !== manageType) return t;
              if (manageType === "income") {
                return t.group === oldGroup ? { ...t, group, name: INCOME_ITEM_NAME } : t;
              }
              return t.group === oldGroup && t.name === oldName ? { ...t, group, name } : t;
            })
          );
        } else {
          next.push({
            group,
            name,
            budget: Array(12).fill(0),
            baseActual: Array(12).fill(0),
          });
        }

        return manageType === "income" ? normalizeIncomeData(next) : next;
      });
    };

    if (manageType === "expense") applyUpdate(setExpenseData);
    else applyUpdate(setIncomeData);

    setManageEditIndex(-1);
    setManageName("");
    if (manageType === "expense") setTimeout(() => manageNameRef.current?.focus?.(), 60);
  }

  function editManagedItem(index) {
    const list = getManageList();
    const item = list[index];
    if (!item) return;
    setManageCategory(item.group);
    setManageName(manageType === "income" ? "" : item.name);
    setManageEditIndex(index);
    if (manageType === "expense") setTimeout(() => manageNameRef.current?.focus?.(), 60);
  }

  function askDeleteManagedItem(index) {
    showConfirm(() => {
      if (manageType === "expense") {
        setExpenseData((prev) => prev.filter((_, i) => i !== index));
      } else {
        const item = incomeData[index];
        setIncomeData((prev) => normalizeIncomeData(prev.filter((_, i) => i !== index)));
        if (item?.group) {
          setTransactions((prev) => prev.filter((t) => !(t.type === "income" && t.group === item.group)));
        }
      }
    });
  }

  function openTransactionModal(type, preGroup, preName) {
    const list = type === "income" ? incomeData : expenseData;
    const groups = [...new Set(list.map((i) => i.group))];
    const group = preGroup || groups[0] || "";

    if (type === "income") {
      setTransForm({
        id: "",
        type,
        date: isoToday(),
        group,
        name: INCOME_ITEM_NAME,
        amount: "",
        note: "",
      });
      setTransactionOpen(true);
      return;
    }

    const items = list.filter((i) => i.group === group);
    const name = preName || items[0]?.name || "";

    setTransForm({
      id: "",
      type,
      date: isoToday(),
      group,
      name,
      amount: "",
      note: "",
    });
    setTransactionOpen(true);
  }

  function saveTransaction() {
    const amount = Number(transForm.amount);
    if (!amount || Number.isNaN(amount)) return showAlert("Inserisci importo");
    if (!transForm.date) return showAlert("Data mancante");
    if (!transForm.group) return showAlert("Categoria mancante");

    const finalName = transForm.type === "income" ? INCOME_ITEM_NAME : transForm.name;
    if (transForm.type === "expense" && !finalName) return showAlert("Sottocategoria mancante");

    const payload = {
      id: transForm.id ? Number(transForm.id) : Date.now(),
      type: transForm.type,
      group: transForm.group,
      name: finalName,
      date: transForm.date,
      amount,
      note: transForm.note || "",
    };

    setTransactions((prev) => {
      const existsIdx = prev.findIndex((t) => t.id === payload.id);
      if (existsIdx >= 0) {
        const next = [...prev];
        next[existsIdx] = payload;
        return next;
      }
      return [...prev, payload];
    });

    setTransactionOpen(false);
  }

  function openDetailModal(type, group, name, monthIndex) {
    setDetailCtx({ type, group, name, monthIndex });
    setDetailOpen(true);
  }
  function deleteTrans(id) {
    showConfirm(() => setTransactions((prev) => prev.filter((t) => t.id !== id)));
  }
  function editTrans(id) {
    const t = transactions.find((x) => x.id === id);
    if (!t) return;
    setTransForm({
      id: String(t.id),
      type: t.type,
      date: t.date,
      group: t.group,
      name: t.type === "income" ? INCOME_ITEM_NAME : t.name,
      amount: String(t.amount),
      note: t.note || "",
    });
    setTransactionOpen(true);
  }

  const groupedExpenses = useMemo(() => groupByGroup(expenseData), [expenseData]);
  const groupedIncome = useMemo(() => groupByGroup(incomeData), [incomeData]);

  const monthLabel = currentMonthView === 12 ? "Totale anno" : months[currentMonthView];

  const footerTotals = useMemo(() => {
    const calcTotals = (type, list) => {
      let bud = 0;
      let act = 0;

      list.forEach((item) => {
        bud += currentMonthView === 12 ? sumArr(item.budget) : Number(item.budget?.[currentMonthView] || 0);

        if (currentMonthView === 12) {
          let t = 0;
          for (let m = 0; m < 12; m++) t += getTotalActual(type, item.group, item.name, m);
          act += t;
        } else {
          act += getTotalActual(type, item.group, item.name, currentMonthView);
        }
      });

      return { bud, act };
    };

    const exp = calcTotals("expense", expenseData);
    const inc = calcTotals("income", incomeData);

    return {
      expBud: exp.bud,
      expAct: exp.act,
      incBud: inc.bud,
      incAct: inc.act,
      netBud: inc.bud - exp.bud,
      netAct: inc.act - exp.act,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseData, incomeData, transactions, currentMonthView]);

  const yearNetActual = useMemo(() => {
    let yearExp = 0;
    let yearInc = 0;
    for (const it of expenseData) for (let m = 0; m < 12; m++) yearExp += getTotalActual("expense", it.group, it.name, m);
    for (const it of incomeData) for (let m = 0; m < 12; m++) yearInc += getTotalActual("income", it.group, it.name, m);
    return yearInc - yearExp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseData, incomeData, transactions]);

  const yearOptions = useMemo(() => {
    const arr = [];
    for (let y = YEAR_START; y <= YEAR_END; y++) arr.push(y);
    return arr;
  }, []);

  const transList = transForm.type === "income" ? incomeData : expenseData;
  const transGroups = useMemo(() => [...new Set(transList.map((i) => i.group))], [transList]);
  const transItems = useMemo(() => transList.filter((i) => i.group === transForm.group), [transList, transForm.group]);

  useEffect(() => {
    if (!transactionOpen) return;
    if (!transForm.group) return;

    if (transForm.type === "income") {
      if (transForm.name !== INCOME_ITEM_NAME) setTransForm((p) => ({ ...p, name: INCOME_ITEM_NAME }));
      return;
    }

    const exists = transItems.some((i) => i.name === transForm.name);
    if (!exists) setTransForm((p) => ({ ...p, name: transItems[0]?.name || "" }));
  }, [transForm.group, transItems, transForm.name, transactionOpen, transForm.type]);

  const detailList = useMemo(() => {
    if (!detailCtx) return { baseVal: 0, rows: [] };
    const { type, group, name, monthIndex } = detailCtx;

    const list = type === "income" ? incomeData : expenseData;
    const item = list.find((i) => i.group === group && i.name === name);
    if (!item) return { baseVal: 0, rows: [] };

    const baseVal = monthIndex === 12 ? sumArr(item.baseActual) : Number(item.baseActual?.[monthIndex] || 0);

    const related = transactions
      .filter((t) => {
        const d = new Date(t.date);
        const m = d.getMonth();
        const matchMonth = monthIndex === 12 || m === monthIndex;
        return t.type === type && t.group === group && t.name === name && matchMonth;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return { baseVal, rows: related };
  }, [detailCtx, expenseData, incomeData, transactions]);

  // Report (ripristinato come prima: 2 sezioni)
  const report = useMemo(() => {
    // mese corrente: se sei su "Totale anno" usa il mese reale
    const curMonth = currentMonthView === 12 ? new Date().getMonth() : currentMonthView;

    const groups = [...new Set(expenseData.map((i) => i.group))].sort((a, b) => a.localeCompare(b));

    // 1) Riepilogo per Categoria
    const categorySummary = groups.map((group) => {
      const items = expenseData.filter((i) => i.group === group);

      const monthTotal = items.reduce((acc, it) => acc + getTotalActual("expense", it.group, it.name, curMonth), 0);

      let yearTotal = 0;
      for (const it of items) {
        for (let m = 0; m < 12; m++) yearTotal += getTotalActual("expense", it.group, it.name, m);
      }

      const avg = yearTotal / 12;

      return { group, monthTotal, yearTotal, avg };
    });

    // 2) Matrice Annuale Completa (voci)
    const rows = expenseData
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "") || (a.group || "").localeCompare(b.group || ""))
      .map((it) => {
        const monthVals = Array.from({ length: 12 }, (_, m) => getTotalActual("expense", it.group, it.name, m));
        const total = monthVals.reduce((a, b) => a + b, 0);
        return { group: it.group, name: it.name, monthVals, total };
      });

    return { curMonth, categorySummary, rows };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseData, transactions, currentMonthView]);

  const netIsPositive = footerTotals.netAct >= 0;

  function downloadBackup() {
    const data = {
      year: currentYear,
      expenseData,
      incomeData,
      transactions,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup_piano_finanziario_${currentYear}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showAlert("Backup scaricato.");
  }

  function restoreBackupFromFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = safeParse(String(reader.result || ""), null);
      if (!parsed) return showAlert("File non valido.");
      if (!parsed || !Array.isArray(parsed.expenseData) || !Array.isArray(parsed.incomeData) || !Array.isArray(parsed.transactions)) {
        return showAlert("Backup non compatibile.");
      }

      setExpenseData(parsed.expenseData);
      setIncomeData(normalizeIncomeData(parsed.incomeData));
      setTransactions(parsed.transactions);

      saveYearData(currentYear, {
        expenseData: parsed.expenseData,
        incomeData: parsed.incomeData,
        transactions: parsed.transactions,
      });

      showAlert("Backup ripristinato.");
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-slate-900">
      <style>{`
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
        body.modal-active { overflow-y: hidden; }
        * { -webkit-tap-highlight-color: transparent; }

        .lux-select {
          border: 1px solid rgba(148,163,184,0.35);
          background: #fff;
          border-radius: 12px;
          padding: 8px 32px 8px 12px;
          font-weight: 900;
          font-size: 13px;
          line-height: 1.1;
          color: #0f172a;
          outline: none;
          appearance: none;
          max-width: 120px;
        }
        @media (min-width: 640px){
          .lux-select { font-size: 14px; max-width: 160px; padding: 10px 36px 10px 14px; }
        }

        .lux-card {
          background: #fff;
          border: 1px solid rgba(148,163,184,0.25);
          border-radius: 18px;
          box-shadow: 0 6px 30px rgba(15,23,42,0.06);
        }

        .budget-input {
          width: 100%;
          padding: 7px 10px;
          border: 1px solid rgba(148,163,184,0.35);
          border-radius: 12px;
          text-align: right;
          font-variant-numeric: tabular-nums;
          background: #fff;
          font-weight: 900;
          font-size: 12px;
          outline: none;
          white-space: nowrap;
        }
        @media (min-width: 640px) {
          .budget-input { font-size: 13px; padding: 8px 11px; }
        }
        .budget-input:focus { box-shadow: 0 0 0 4px rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.4); background: #f5f7ff; }
        .budget-input::placeholder { color: #94a3b8; opacity: 0.9; font-style: italic; font-weight: 800; }

        .nowrap { white-space: nowrap; }
        .tabnums { font-variant-numeric: tabular-nums; }

        .row-grid {
          display: grid;
          grid-template-columns: 1fr 86px 92px 86px;
          gap: 8px;
          align-items: center;
        }
        @media (min-width: 640px) {
          .row-grid { grid-template-columns: 1fr 120px 140px 120px; gap: 10px; }
        }

        .colhdr {
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 900;
          color: #94a3b8;
          text-align: center;
        }

        .voice-row { padding: 8px 10px; }
        @media (min-width: 640px) { .voice-row { padding: 8px 12px; } }

        .plain-num {
          text-align: right;
          font-weight: 900;
          font-size: 12px;
          line-height: 1;
          white-space: nowrap;
        }
        @media (min-width: 640px) { .plain-num { font-size: 13px; } }

        /* KPI: scritte più piccole su iPhone */
        .kpi-title {
          font-weight: 900;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #64748b;
          font-size: 11px;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (max-width: 520px) { .kpi-title { font-size: 9px; } }

        .kpi-value {
          font-weight: 1000;
          letter-spacing: -0.02em;
          font-size: 34px;
          line-height: 1;
          white-space: nowrap;
        }
        @media (max-width: 520px) { .kpi-value { font-size: 24px; } }
        @media (max-width: 420px) { .kpi-value { font-size: 22px; } }
        @media (max-width: 360px) { .kpi-value { font-size: 20px; } }

        /* Report: sticky prima colonna + scroll solo mesi */
        .report-scroll { overflow: auto; }
        .report-sticky-left { position: sticky; left: 0; z-index: 5; background: white; }
        .report-sticky-left-head { position: sticky; left: 0; z-index: 15; background: #f8fafc; }
        .report-sticky-top { position: sticky; top: 0; z-index: 10; background: #f8fafc; }
        .report-sticky-top-white { position: sticky; top: 0; z-index: 10; background: white; }
      `}</style>

      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2">
              <div className="text-[18px] sm:text-[22px] font-extrabold tracking-tight truncate">Piano Finanziario</div>

              <div className="relative shrink-0">
                <select className="lux-select" value={currentYear} onChange={(e) => changeYear(e.target.value)}>
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[13px] px-3 py-2.5 rounded-xl border border-slate-200 nowrap shrink-0"
            >
              <PieChart className="w-5 h-5 text-slate-500" />
              Report
            </button>
          </div>

          {/* (rimane solo su desktop) */}
          <div className="hidden sm:block text-[12px] text-slate-500 mt-1 font-semibold">
            {monthLabel} • Anno {currentYear}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => openTransactionModal("income")}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[13px] sm:text-[14px] px-4 sm:px-5 py-3 rounded-xl shadow-sm nowrap"
            >
              <PlusCircle className="w-5 h-5" />
              Entrata
            </button>

            <button
              type="button"
              onClick={() => openTransactionModal("expense")}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[13px] sm:text-[14px] px-4 sm:px-5 py-3 rounded-xl shadow-sm nowrap"
            >
              <MinusCircle className="w-5 h-5" />
              Uscita
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-1">
          <KpiCompact title="ENTRATE" value={formatMoney(footerTotals.incAct)} valueClass="text-emerald-600" />
          <KpiCompact title="USCITE" value={formatMoney(footerTotals.expAct)} valueClass="text-rose-600" />
          <KpiCompact
            title="RIMANENZA"
            value={formatMoney(footerTotals.netAct)}
            valueClass={netIsPositive ? "text-emerald-600" : "text-rose-600"}
          />
        </div>

        <div className="lux-card mt-3 p-3 sm:p-4">
          <div className="grid grid-cols-6 gap-2">
            {shortMonths.slice(0, 6).map((m, idx) => (
              <MonthBtn key={m} label={m} active={currentMonthView === idx} onClick={() => setCurrentMonthView(idx)} />
            ))}
          </div>
          <div className="grid grid-cols-6 gap-2 mt-2">
            {shortMonths.slice(6, 12).map((m, i) => {
              const idx = i + 6;
              return <MonthBtn key={m} label={m} active={currentMonthView === idx} onClick={() => setCurrentMonthView(idx)} />;
            })}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setCurrentMonthView(12)}
              className={[
                "w-full px-3 py-2.5 rounded-xl font-extrabold text-[13px] border nowrap tabnums",
                currentMonthView === 12
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              Totale anno
            </button>

            <button
              type="button"
              onClick={() => openAddCategoryModal("expense")}
              className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[13px] px-3 py-2.5 rounded-xl shadow-sm nowrap"
            >
              <Plus className="w-5 h-5" />
              Aggiungi categoria
            </button>
          </div>
        </div>

        <section className="mt-6 space-y-5">
          {/* USCITE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-extrabold tracking-wider text-slate-500 uppercase">Uscite</div>
              <div className="text-[12px] text-slate-500 font-extrabold nowrap tabnums">
                <span className="mr-2">Uscite</span>
                <span className="text-slate-900">{formatMoney(footerTotals.expAct)}</span>
              </div>
            </div>

            {Object.keys(groupedExpenses).length === 0 ? (
              <div className="lux-card p-5 text-slate-600 text-sm font-semibold">
                <button className="font-extrabold text-indigo-700 hover:underline" onClick={() => openAddCategoryModal("expense")}>
                  Aggiungi Categoria
                </button>
              </div>
            ) : (
              Object.entries(groupedExpenses)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([group, items]) => {
                  const collapsedNow = isCollapsed("expense", group);
                  const { groupActual, groupBudget } = calcGroupTotals("expense", items, currentMonthView, getTotalActual);

                  return (
                    <div key={`exp-${group}`} className="lux-card overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleGroup("expense", group)}
                        className="w-full px-4 sm:px-5 py-4 flex items-center justify-between hover:bg-slate-50/60 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={["text-slate-400 transition-transform", collapsedNow ? "" : "rotate-90"].join(" ")}>
                            <ChevronRight className="w-5 h-5" />
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                          <div className="min-w-0 text-left">
                            <div className="font-extrabold text-[15px] sm:text-[16px] truncate">{group}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 sm:gap-6">
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-extrabold text-slate-400">Uscite</div>
                            <div className="font-extrabold text-[14px] nowrap tabnums">{formatMoney(groupActual)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-extrabold text-slate-400">Budget</div>
                            <div className="font-extrabold text-[14px] text-indigo-700 nowrap tabnums">{formatMoney(groupBudget)}</div>
                          </div>
                        </div>
                      </button>

                      {!collapsedNow && (
                        <div className="px-4 sm:px-5 pb-3">
                          <div className="row-grid px-1 pt-1 pb-2">
                            <div />
                            <div className="colhdr">BUDGET</div>
                            <div className="colhdr">USCITE</div>
                            <div className="colhdr">DIFF.</div>
                          </div>

                          <div className="space-y-1">
                            {items
                              .slice()
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((item) => {
                                const itemIndex = expenseData.findIndex((x) => x.group === item.group && x.name === item.name);
                                const actualVal = getItemActual("expense", item);
                                const budgetVal = getItemBudget(item);
                                const diffVal = budgetVal - actualVal;
                                const diffClass =
                                  Math.abs(diffVal) < 0.01 ? "text-slate-400" : diffVal >= 0 ? "text-emerald-600" : "text-rose-600";

                                const prevSuggestion =
                                  currentMonthView !== 12 && currentMonthView > 0 && Number(item.budget?.[currentMonthView - 1] || 0) > 0
                                    ? String(item.budget[currentMonthView - 1])
                                    : "";
                                const displayValue = currentMonthView !== 12 && budgetVal === 0 ? "" : String(budgetVal);

                                return (
                                  <div key={`${item.group}-${item.name}`} className="bg-[#FBFBFE] border border-slate-200/50 rounded-2xl voice-row">
                                    <div className="row-grid">
                                      <div className="min-w-0">
                                        <div className="font-extrabold text-[13px] sm:text-[14px] truncate">{item.name}</div>
                                      </div>

                                      <div className="min-w-0">
                                        {currentMonthView === 12 ? (
                                          <div className="plain-num tabnums text-slate-700">{formatMoney(budgetVal)}</div>
                                        ) : (
                                          <BudgetInput value={displayValue} suggest={prevSuggestion} onChange={(v) => updateBudget("expense", itemIndex, v)} />
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => openDetailModal("expense", item.group, item.name, currentMonthView)}
                                        className="inline-flex items-center justify-end gap-1.5 hover:underline text-rose-700"
                                        title="Vedi movimenti"
                                      >
                                        <span className="plain-num tabnums">{formatMoney(actualVal)}</span>
                                        <Search className="w-4 h-4 opacity-80" />
                                      </button>

                                      <div className={["plain-num tabnums", diffClass].join(" ")}>{formatMoney(diffVal)}</div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>

                          <button
                            type="button"
                            onClick={() => quickAddSubItem(group)}
                            className="mt-2 inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-extrabold text-[13px] nowrap"
                          >
                            <Plus className="w-5 h-5" />
                            Aggiungi sottocategoria
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>

          {/* ENTRATE */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-extrabold tracking-wider text-slate-500 uppercase">Entrate</div>
              <div className="text-[12px] text-slate-500 font-extrabold nowrap tabnums">
                <span className="mr-2">Entrate</span>
                <span className="text-slate-900">{formatMoney(footerTotals.incAct)}</span>
              </div>
            </div>

            {Object.keys(groupedIncome).length === 0 ? (
              <div className="lux-card p-5 text-slate-600 text-sm font-semibold">
                <button className="font-extrabold text-indigo-700 hover:underline" onClick={() => openAddCategoryModal("income")}>
                  Aggiungi Categoria
                </button>
              </div>
            ) : (
              Object.entries(groupedIncome)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([group, items]) => {
                  const collapsedNow = isCollapsed("income", group);
                  const item = items[0];
                  const itemIndex = incomeData.findIndex((x) => x.group === group);
                  const actualVal = getItemActual("income", item);
                  const budgetVal = getItemBudget(item);
                  const diffVal = actualVal - budgetVal;
                  const diffClass =
                    Math.abs(diffVal) < 0.01 ? "text-slate-400" : diffVal >= 0 ? "text-emerald-600" : "text-rose-600";

                  const prevSuggestion =
                    currentMonthView !== 12 && currentMonthView > 0 && Number(item.budget?.[currentMonthView - 1] || 0) > 0
                      ? String(item.budget[currentMonthView - 1])
                      : "";
                  const displayValue = currentMonthView !== 12 && budgetVal === 0 ? "" : String(budgetVal);

                  return (
                    <div key={`inc-${group}`} className="lux-card overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleGroup("income", group)}
                        className="w-full px-4 sm:px-5 py-4 flex items-center justify-between hover:bg-slate-50/60 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={["text-slate-400 transition-transform", collapsedNow ? "" : "rotate-90"].join(" ")}>
                            <ChevronRight className="w-5 h-5" />
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                          <div className="min-w-0 text-left">
                            <div className="font-extrabold text-[15px] sm:text-[16px] truncate">{group}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] uppercase font-extrabold text-slate-400">Entrate</div>
                          <div className="font-extrabold text-[14px] nowrap tabnums">{formatMoney(actualVal)}</div>
                        </div>
                      </button>

                      {!collapsedNow && (
                        <div className="px-4 sm:px-5 pb-3">
                          <div className="row-grid px-1 pt-1 pb-2">
                            <div />
                            <div className="colhdr">BUDGET</div>
                            <div className="colhdr">MOV.</div>
                            <div className="colhdr">DIFF.</div>
                          </div>

                          <div className="bg-[#FBFBFE] border border-slate-200/50 rounded-2xl voice-row">
                            <div className="row-grid">
                              <div className="min-w-0">
                                <div className="font-extrabold text-[13px] sm:text-[14px] truncate">{INCOME_ITEM_LABEL}</div>
                              </div>

                              <div className="min-w-0">
                                {currentMonthView === 12 ? (
                                  <div className="plain-num tabnums text-slate-700">{formatMoney(budgetVal)}</div>
                                ) : (
                                  <BudgetInput value={displayValue} suggest={prevSuggestion} onChange={(v) => updateBudget("income", itemIndex, v)} />
                                )}
                              </div>

                              <button
                                type="button"
                                onClick={() => openDetailModal("income", item.group, item.name, currentMonthView)}
                                className="inline-flex items-center justify-end gap-1.5 hover:underline text-emerald-700"
                                title="Vedi movimenti"
                              >
                                <span className="plain-num tabnums">{formatMoney(actualVal)}</span>
                                <Search className="w-4 h-4 opacity-80" />
                              </button>

                              <div className={["plain-num tabnums", diffClass].join(" ")}>{formatMoney(diffVal)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>

          <TotalsBarCompact
            expAct={footerTotals.expAct}
            expBud={footerTotals.expBud}
            incAct={footerTotals.incAct}
            incBud={footerTotals.incBud}
            netAct={footerTotals.netAct}
            netBud={footerTotals.netBud}
            yearNetAct={yearNetActual}
            isAnnual={currentMonthView === 12}
          />

          <div className="mt-3">
            <div className="lux-card p-3">
              <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={downloadBackup}
                  className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-extrabold text-[13px]"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  Backup
                </button>

                <label className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-extrabold text-[13px] cursor-pointer">
                  <Upload className="w-4 h-4 text-slate-600" />
                  Ripristina
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) restoreBackupFromFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={askResetYearTotals}
                  className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 font-extrabold text-[13px] text-rose-600"
                >
                  <RefreshCw className="w-4 h-4 text-rose-600" />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* REPORT */}
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        z="z-[70]"
        padding="p-0 sm:p-4"
        overlayClass="bg-slate-900/80 backdrop-blur-sm"
      >
        <div className="bg-white w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-6xl mx-auto rounded-none sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="bg-slate-900 px-5 py-4 flex justify-between items-center text-white shrink-0">
            <div>
              <div className="font-extrabold text-[18px] flex items-center gap-2">
                <PieChart className="w-6 h-6" /> Analisi
              </div>
              <div className="text-[12px] text-white/70 font-semibold">Anno {currentYear}</div>
            </div>
            <button onClick={() => setReportOpen(false)} className="p-2 rounded-xl hover:bg-white/10">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-grow overflow-auto bg-[#F6F7FB]">
            <div className="p-4 sm:p-6 space-y-6">
              {/* 1. Riepilogo per Categoria */}
              <div className="lux-card p-4 sm:p-6">
                <div className="text-[16px] font-extrabold mb-3">1. Riepilogo per Categoria</div>
                <div className="report-scroll rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-[12px] sm:text-[13px]">
                    <thead className="report-sticky-top bg-slate-50 text-[10px] uppercase text-slate-500 font-extrabold">
                      <tr>
                        <th className="report-sticky-left-head px-4 py-3 text-left min-w-[200px]">Categoria</th>
                        <th className="px-4 py-3 text-right min-w-[150px]">Mese corrente</th>
                        <th className="px-4 py-3 text-right min-w-[150px]">Totale anno</th>
                        <th className="px-4 py-3 text-right min-w-[150px]">Media mensile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.categorySummary.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-slate-400 italic">
                            Nessun dato.
                          </td>
                        </tr>
                      ) : (
                        report.categorySummary.map((r) => (
                          <tr key={r.group} className="hover:bg-slate-50">
                            <td className="report-sticky-left px-4 py-4 font-extrabold text-slate-900 min-w-[200px]">{r.group}</td>
                            <td className="px-4 py-4 text-right font-extrabold tabnums text-slate-900">{formatMoney(r.monthTotal)}</td>
                            <td className="px-4 py-4 text-right font-extrabold tabnums text-indigo-700">{formatMoney(r.yearTotal)}</td>
                            <td className="px-4 py-4 text-right font-semibold tabnums text-slate-500">{formatMoney(r.avg)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Matrice Annuale Completa */}
              <div className="lux-card p-4 sm:p-6">
                <div className="text-[16px] font-extrabold mb-3">2. Matrice Annuale Completa</div>

                <div className="report-scroll rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-[12px] sm:text-[13px]">
                    <thead className="report-sticky-top bg-slate-50 text-[10px] uppercase text-slate-500 font-extrabold">
                      <tr>
                        <th className="report-sticky-left-head px-4 py-3 text-left min-w-[220px]">Voce</th>
                        {shortMonths.map((m) => (
                          <th key={m} className="px-4 py-3 text-right min-w-[90px]">
                            {m}
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right min-w-[110px]">Tot</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {report.rows.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="px-4 py-10 text-center text-slate-400 italic">
                            Nessun dato.
                          </td>
                        </tr>
                      ) : (
                        report.rows.map((r) => (
                          <tr key={`${r.group}__${r.name}`} className="hover:bg-slate-50">
                            <td className="report-sticky-left px-4 py-3 min-w-[220px]">
                              <div className="font-extrabold text-slate-900">{(r.name || "").toUpperCase()}</div>
                              <div className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wide">{r.group}</div>
                            </td>

                            {r.monthVals.map((v, idx) => (
                              <td key={idx} className="px-4 py-3 text-right font-extrabold tabnums text-slate-900">
                                {v ? new Intl.NumberFormat("it-IT").format(v) : "-"}
                              </td>
                            ))}

                            <td className="px-4 py-3 text-right font-extrabold tabnums text-indigo-700">{formatMoney(r.total)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      </Modal>

      {/* ADD CATEGORY */}
      <Modal open={manageOpen} onClose={() => setManageOpen(false)} z="z-[80]" padding="p-3 sm:p-4">
        <div className="bg-white w-full max-w-2xl mx-auto rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/50">
          <div className="px-4 sm:px-5 py-4 flex items-center justify-between border-b border-slate-200/60">
            <div>
              <div className="text-[16px] sm:text-[18px] font-extrabold">Aggiungi Categoria</div>
              <div className="text-[12px] text-slate-500 font-semibold mt-0.5">
                Uscite: categoria + sottocategoria • Entrate: solo categoria
              </div>
            </div>
            <button onClick={() => setManageOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 sm:px-5 py-3 border-b border-slate-200/60 bg-slate-50">
            <div className="inline-flex bg-white border border-slate-200 rounded-xl p-1">
              <button
                onClick={() => switchManageType("expense")}
                className={[
                  "px-3 py-2 rounded-lg text-[13px] font-extrabold transition",
                  manageType === "expense" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100",
                ].join(" ")}
              >
                Uscite
              </button>
              <button
                onClick={() => switchManageType("income")}
                className={[
                  "px-3 py-2 rounded-lg text-[13px] font-extrabold transition",
                  manageType === "income" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100",
                ].join(" ")}
              >
                Entrate
              </button>
            </div>

            {manageType === "expense" ? (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Categoria</label>
                  <input
                    value={manageCategory}
                    onChange={(e) => setManageCategory(e.target.value)}
                    placeholder="Es. Casa"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[14px] font-semibold outline-none focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Sottocategoria</label>
                  <input
                    ref={manageNameRef}
                    value={manageName}
                    onChange={(e) => setManageName(e.target.value)}
                    placeholder="Es. Affitto/Mutuo"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[14px] font-semibold outline-none focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Categoria</label>
                <input
                  value={manageCategory}
                  onChange={(e) => setManageCategory(e.target.value)}
                  placeholder="Es. Stipendio"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-[14px] font-semibold outline-none focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            )}

            <button
              onClick={saveManagedItem}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[14px] px-4 py-3 rounded-xl"
            >
              <Plus className="w-5 h-5" />
              {manageEditIndex > -1 ? "Salva" : manageType === "income" ? "Aggiungi Categoria Entrate" : "Aggiungi Categoria / Sottocategoria"}
            </button>
          </div>

          <div className="flex-grow overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-slate-200/60">
                <tr className="text-[11px] uppercase text-slate-500 font-extrabold">
                  <th className="text-left px-4 sm:px-5 py-3">Categoria</th>
                  <th className="text-left px-4 sm:px-5 py-3">{manageType === "income" ? "" : "Sottocategoria"}</th>
                  <th className="text-center px-4 sm:px-5 py-3">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {getManageList().length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 sm:px-5 py-10 text-center text-slate-400 italic">
                      Nessun elemento.
                    </td>
                  </tr>
                ) : (
                  getManageList()
                    .map((item, idx) => ({ ...item, originalIdx: idx }))
                    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
                    .map((item) => (
                      <tr key={`${item.group}-${item.name}-${item.originalIdx}`} className="hover:bg-slate-50">
                        <td className="px-4 sm:px-5 py-3 font-extrabold text-slate-900">{item.group}</td>
                        <td className="px-4 sm:px-5 py-3 font-semibold text-slate-600">{manageType === "income" ? "" : item.name}</td>
                        <td className="px-4 sm:px-5 py-3 text-center">
                          <button onClick={() => editManagedItem(item.originalIdx)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600" title="Modifica">
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button onClick={() => askDeleteManagedItem(item.originalIdx)} className="p-2 rounded-xl hover:bg-slate-100 text-rose-600" title="Elimina">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* CONFIRM */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} z="z-[90]" padding="p-4" overlayClass="bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm mx-auto rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50">
          <div className="p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 mb-4 text-rose-600">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-[16px] font-extrabold text-slate-900 mb-2">Confermi l’azione?</div>
            <div className="text-[13px] text-slate-500 font-semibold mb-6">Questa azione non si può annullare.</div>
            <div className="flex justify-center gap-3">
              <button onClick={() => setConfirmOpen(false)} className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[13px] font-extrabold">
                Annulla
              </button>
              <button
                onClick={() => {
                  const cb = confirmRef.current.onConfirm;
                  setConfirmOpen(false);
                  confirmRef.current.onConfirm = null;
                  if (typeof cb === "function") cb();
                }}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[13px] font-extrabold"
              >
                Conferma
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ALERT */}
      <Modal open={alertOpen} onClose={() => setAlertOpen(false)} z="z-[95]" padding="p-4" overlayClass="bg-slate-900/40">
        <div className="bg-white w-full max-w-sm mx-auto rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50">
          <div className="p-6 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 mb-4 text-indigo-600">
              <Info className="w-6 h-6" />
            </div>
            <div className="text-[16px] font-extrabold text-slate-900 mb-2">Avviso</div>
            <div className="text-[13px] text-slate-500 font-semibold mb-6">{alertMsg}</div>
            <button onClick={() => setAlertOpen(false)} className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-extrabold">
              OK
            </button>
          </div>
        </div>
      </Modal>

      {/* TRANSACTION */}
      <Modal open={transactionOpen} onClose={() => setTransactionOpen(false)} z="z-[85]" padding="p-4" overlayClass="bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white w-full max-w-md mx-auto rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50">
          <div className="px-5 py-4 border-b border-slate-200/60 flex items-center justify-between">
            <div>
              <div className="text-[16px] font-extrabold">{transForm.id ? "Modifica Movimento" : "Nuovo Movimento"}</div>
              <div className="text-[12px] text-slate-500 font-semibold">{transForm.type === "income" ? "Entrata" : "Uscita"}</div>
            </div>
            <button onClick={() => setTransactionOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Tipo</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-extrabold"
                  value={transForm.type}
                  onChange={(e) =>
                    setTransForm((p) => ({
                      ...p,
                      type: e.target.value,
                      name: e.target.value === "income" ? INCOME_ITEM_NAME : p.name,
                    }))
                  }
                >
                  <option value="expense">Uscita</option>
                  <option value="income">Entrata</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Data</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-extrabold"
                  value={transForm.date}
                  onChange={(e) => setTransForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Categoria</label>
              <select
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-extrabold"
                value={transForm.group}
                onChange={(e) => setTransForm((p) => ({ ...p, group: e.target.value }))}
              >
                {transGroups.length === 0 ? (
                  <option value="">Nessuna categoria</option>
                ) : (
                  transGroups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))
                )}
              </select>
            </div>

            {transForm.type === "expense" && (
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Sottocategoria</label>
                <select
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-extrabold"
                  value={transForm.name}
                  onChange={(e) => setTransForm((p) => ({ ...p, name: e.target.value }))}
                >
                  {transItems.length === 0 ? (
                    <option value="">Nessuna voce</option>
                  ) : (
                    transItems.map((i) => (
                      <option key={i.name} value={i.name}>
                        {i.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Importo (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-extrabold tabnums"
                  value={transForm.amount}
                  onChange={(e) => setTransForm((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-500 uppercase mb-1">Note</label>
                <input
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 font-semibold"
                  value={transForm.note}
                  onChange={(e) => setTransForm((p) => ({ ...p, note: e.target.value }))}
                  placeholder="Opzionale"
                />
              </div>
            </div>

            <button onClick={saveTransaction} className="w-full mt-2 inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[14px] px-4 py-3 rounded-xl">
              Salva
            </button>
          </div>
        </div>
      </Modal>

      {/* DETAIL */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} z="z-[75]" padding="p-4" overlayClass="bg-slate-900/60 backdrop-blur-sm">
        {detailCtx ? (
          <div className="bg-white w-full max-w-lg mx-auto rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-200/60 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-[16px] font-extrabold truncate">{detailCtx.type === "income" ? detailCtx.group : detailCtx.name}</div>
                <div className="text-[12px] text-slate-500 font-semibold">{detailCtx.monthIndex === 12 ? "Totale anno" : months[detailCtx.monthIndex]}</div>
              </div>
              <button onClick={() => setDetailOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-grow">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {detailList.baseVal !== 0 && (
                    <tr className="bg-slate-50">
                      <td className="px-5 py-3 text-slate-500 font-semibold italic">Base iniziale</td>
                      <td className="px-5 py-3 text-right font-extrabold tabnums">{formatMoney(detailList.baseVal)}</td>
                      <td className="px-5 py-3" />
                    </tr>
                  )}

                  {detailList.rows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-5 py-10 text-center text-slate-400 italic">
                        Nessun movimento.
                      </td>
                    </tr>
                  ) : (
                    detailList.rows.map((t) => {
                      const d = new Date(t.date);
                      const dayStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="px-5 py-3">
                            <div className="text-[12px] text-slate-400 font-extrabold">{dayStr}</div>
                            <div className="text-slate-800 font-semibold">{t.note || "Movimento"}</div>
                          </td>
                          <td className="px-5 py-3 text-right font-extrabold tabnums">{formatMoney(t.amount)}</td>
                          <td className="px-5 py-3 text-right">
                            <button onClick={() => editTrans(t.id)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600" title="Modifica">
                              <Pencil className="w-5 h-5" />
                            </button>
                            <button onClick={() => deleteTrans(t.id)} className="p-2 rounded-xl hover:bg-slate-100 text-rose-600" title="Elimina">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200/60 bg-white">
              <button
                onClick={() => openTransactionModal(detailCtx.type, detailCtx.group, detailCtx.type === "income" ? INCOME_ITEM_NAME : detailCtx.name)}
                className="w-full inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[14px] px-4 py-3 rounded-xl"
              >
                <Plus className="w-5 h-5" />
                Aggiungi movimento
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* =========================
   Components
========================= */
function Modal({ open, onClose, children, z = "z-[60]", padding = "p-4", overlayClass = "bg-slate-900/60 backdrop-blur-sm" }) {
  if (!open) return null;
  return (
    <div className={`fixed inset-0 ${z} flex items-center justify-center ${padding}`}>
      <div className={`absolute inset-0 ${overlayClass}`} onClick={onClose} />
      <div className="relative w-full h-full flex items-center justify-center">{children}</div>
    </div>
  );
}

function BudgetInput({ value, suggest, onChange }) {
  const [placeholder, setPlaceholder] = useState("");
  return (
    <input
      type="number"
      step="0.01"
      value={value}
      placeholder={placeholder}
      onFocus={() => {
        if (!value && suggest) setPlaceholder(String(suggest));
      }}
      onBlur={() => setPlaceholder("")}
      onChange={(e) => onChange(e.target.value)}
      className="budget-input tabnums"
    />
  );
}

function MonthBtn({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-2 py-2 rounded-xl font-extrabold text-[12px] border transition tabnums nowrap",
        active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
      ].join(" ")}
      title={label}
    >
      {label}
    </button>
  );
}

function KpiCompact({ title, value, valueClass }) {
  return (
    <div className="lux-card p-3 sm:p-5">
      <div className="kpi-title">{title}</div>
      <div className={["kpi-value tabnums mt-2", valueClass].join(" ")}>{value}</div>
    </div>
  );
}

/* ultime 3 righe: testo più piccolo + cifre più vicine */
function TotalsBarCompact({ expAct, expBud, incAct, incBud, netAct, netBud, yearNetAct, isAnnual }) {
  const rightNet = isAnnual ? netAct : yearNetAct;
  const netColor = rightNet >= 0 ? "text-emerald-400" : "text-rose-300";

  const Grid = ({ children }) => (
    <div className="grid grid-cols-[1fr_92px_92px_92px] sm:grid-cols-[1fr_180px_180px_130px] gap-1.5 sm:gap-2 items-center">
      {children}
    </div>
  );

  return (
    <div className="lux-card overflow-hidden mt-2">
      <div className="divide-y divide-slate-200">
        <div className="bg-white px-4 sm:px-6 py-3">
          <Grid>
            <div className="font-extrabold text-[10px] sm:text-[12px] text-rose-700 uppercase tracking-wide nowrap">TOT. USCITE</div>
            <div className="text-right font-extrabold text-[12px] sm:text-[16px] text-rose-700 tabnums nowrap">{formatMoney(expAct)}</div>
            <div className="text-right font-extrabold text-[12px] sm:text-[16px] text-rose-700 tabnums nowrap">{formatMoney(expBud)}</div>
            <div className="text-right font-extrabold text-[12px] sm:text-[16px] text-slate-400 tabnums nowrap">-</div>
          </Grid>
        </div>

        <div className="bg-white px-4 sm:px-6 py-3">
          <Grid>
            <div className="font-extrabold text-[10px] sm:text-[12px] text-emerald-700 uppercase tracking-wide nowrap">TOT. ENTRATE</div>
            <div className="text-right font-extrabold text-[12px] sm:text-[16px] text-emerald-700 tabnums nowrap">{formatMoney(incAct)}</div>
            <div className="text-right font-extrabold text-[12px] sm:text-[16px] text-emerald-700 tabnums nowrap">{formatMoney(incBud)}</div>
            <div className="text-right font-extrabold text-[12px] sm:text-[16px] text-slate-400 tabnums nowrap">-</div>
          </Grid>
        </div>

        <div className="bg-slate-900 px-4 sm:px-6 py-3">
          <Grid>
            <div className="font-extrabold text-[10px] sm:text-[13px] text-white uppercase tracking-wide nowrap">RIMANENZA</div>
            <div className="text-right font-extrabold text-[12px] sm:text-[16px] text-white/70 tabnums nowrap">{formatMoney(netAct)}</div>
            <div className="text-right font-extrabold text-[12px] sm:text-[16px] text-white tabnums nowrap">{formatMoney(netBud)}</div>
            <div className={["text-right font-extrabold text-[13px] sm:text-[18px] tabnums nowrap", netColor].join(" ")}>
              {formatMoney(rightNet)}
            </div>
          </Grid>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Data helpers
========================= */
function groupByGroup(items) {
  const out = {};
  for (const it of items || []) {
    const g = it.group || "Senza categoria";
    if (!out[g]) out[g] = [];
    out[g].push(it);
  }
  return out;
}

function calcGroupTotals(type, items, currentMonthView, getTotalActual) {
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

function normalizeIncomeData(arr) {
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

/* =========================
   Storage
========================= */
function loadYearData(year) {
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

function saveYearData(year, payload) {
  const key = `fm_data_${year}`;
  const safePayload = {
    expenseData: Array.isArray(payload.expenseData) ? payload.expenseData : [],
    incomeData: Array.isArray(payload.incomeData) ? payload.incomeData : [],
    transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
  };
  localStorage.setItem(key, JSON.stringify(safePayload));
}