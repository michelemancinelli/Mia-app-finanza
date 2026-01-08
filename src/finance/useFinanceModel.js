import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  YEAR_START,
  YEAR_END,
  INCOME_ITEM_NAME,
  clampYear,
  groupByGroup,
  isoToday,
  normalizeIncomeData,
  safeParse,
  sumArr,
  zeroizeLike,
  months,
} from "./utils";
import { loadYearData, saveYearData } from "./storage";

export function useFinanceModel() {
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

  return {
    // state
    currentYear,
    currentMonthView,
    expenseData,
    incomeData,
    transactions,
    collapsed,

    alertOpen,
    alertMsg,
    confirmOpen,
    manageOpen,
    manageType,
    manageEditIndex,
    manageCategory,
    manageName,
    transactionOpen,
    transForm,
    detailOpen,
    detailCtx,
    reportOpen,

    // refs
    confirmRef,
    manageNameRef,

    // setters (used by App JSX)
    setCurrentMonthView,
    setAlertOpen,
    setConfirmOpen,
    setManageOpen,
    setManageType,
    setManageEditIndex,
    setManageCategory,
    setManageName,
    setTransactionOpen,
    setTransForm,
    setDetailOpen,
    setReportOpen,

    // computed
    groupedExpenses,
    groupedIncome,
    monthLabel,
    footerTotals,
    yearNetActual,
    yearOptions,
    transGroups,
    transItems,
    detailList,
    report,

    // actions/handlers
    changeYear,
    askResetYearTotals,
    toggleGroup,
    isCollapsed,
    getTotalActual,
    getItemBudget,
    getItemActual,
    updateBudget,
    openAddCategoryModal,
    quickAddSubItem,
    switchManageType,
    getManageList,
    saveManagedItem,
    editManagedItem,
    askDeleteManagedItem,
    openTransactionModal,
    saveTransaction,
    openDetailModal,
    deleteTrans,
    editTrans,
    downloadBackup,
    restoreBackupFromFile,
  };
}
