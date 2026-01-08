// src/App.jsx
import React, { useEffect, useState } from "react";
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

import { useFinanceModel } from "./finance/useFinanceModel";
import {
  months,
  shortMonths,
  INCOME_ITEM_LABEL,
  INCOME_ITEM_NAME,
  formatMoney,
  calcGroupTotals,
} from "./finance/utils";
import { Modal, BudgetInput, MonthBtn, KpiCompact, TotalsBarCompact } from "./finance/ui";

import { supabase } from "./lib/supabaseClient";
import Login from "./Login";

/* =========================
   Finance App (la tua UI)
========================= */
function FinanceApp() {
  const m = useFinanceModel();

  const {
    currentYear,
    currentMonthView,
    expenseData,
    incomeData,
    transactions,

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

    confirmRef,
    manageNameRef,

    setCurrentMonthView,
    setAlertOpen,
    setConfirmOpen,
    setManageOpen,
    setManageCategory,
    setManageName,
    setTransactionOpen,
    setTransForm,
    setDetailOpen,
    setReportOpen,

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
  } = m;

  const netIsPositive = footerTotals.netAct >= 0;

  return (
    <div className="min-h-screen bg-[#F6F7FB] text-slate-900">
      <style>{`
        hookup;
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
              <div className="text-[18px] sm:text-[22px] font-extrabold tracking-tight truncate">
                Piano Finanziario
              </div>

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
            {shortMonths.slice(0, 6).map((mLabel, idx) => (
              <MonthBtn
                key={mLabel}
                label={mLabel}
                active={currentMonthView === idx}
                onClick={() => setCurrentMonthView(idx)}
              />
            ))}
          </div>
          <div className="grid grid-cols-6 gap-2 mt-2">
            {shortMonths.slice(6, 12).map((mLabel, i) => {
              const idx = i + 6;
              return (
                <MonthBtn
                  key={mLabel}
                  label={mLabel}
                  active={currentMonthView === idx}
                  onClick={() => setCurrentMonthView(idx)}
                />
              );
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
              <div className="text-[12px] font-extrabold tracking-wider text-slate-500 uppercase">
                Uscite
              </div>
              <div className="text-[12px] text-slate-500 font-extrabold nowrap tabnums">
                <span className="mr-2">Uscite</span>
                <span className="text-slate-900">{formatMoney(footerTotals.expAct)}</span>
              </div>
            </div>

            {Object.keys(groupedExpenses).length === 0 ? (
              <div className="lux-card p-5 text-slate-600 text-sm font-semibold">
                <button
                  className="font-extrabold text-indigo-700 hover:underline"
                  onClick={() => openAddCategoryModal("expense")}
                >
                  Aggiungi Categoria
                </button>
              </div>
            ) : (
              Object.entries(groupedExpenses)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([group, items]) => {
                  const collapsedNow = isCollapsed("expense", group);
                  const { groupActual, groupBudget } = calcGroupTotals(
                    "expense",
                    items,
                    currentMonthView,
                    getTotalActual
                  );

                  return (
                    <div key={`exp-${group}`} className="lux-card overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleGroup("expense", group)}
                        className="w-full px-4 sm:px-5 py-4 flex items-center justify-between hover:bg-slate-50/60 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={[
                              "text-slate-400 transition-transform",
                              collapsedNow ? "" : "rotate-90",
                            ].join(" ")}
                          >
                            <ChevronRight className="w-5 h-5" />
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                          <div className="min-w-0 text-left">
                            <div className="font-extrabold text-[15px] sm:text-[16px] truncate">
                              {group}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 sm:gap-6">
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-extrabold text-slate-400">
                              Uscite
                            </div>
                            <div className="font-extrabold text-[14px] nowrap tabnums">
                              {formatMoney(groupActual)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] uppercase font-extrabold text-slate-400">
                              Budget
                            </div>
                            <div className="font-extrabold text-[14px] text-indigo-700 nowrap tabnums">
                              {formatMoney(groupBudget)}
                            </div>
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
                                const itemIndex = expenseData.findIndex(
                                  (x) => x.group === item.group && x.name === item.name
                                );
                                const actualVal = getItemActual("expense", item);
                                const budgetVal = getItemBudget(item);
                                const diffVal = budgetVal - actualVal;
                                const diffClass =
                                  Math.abs(diffVal) < 0.01
                                    ? "text-slate-400"
                                    : diffVal >= 0
                                    ? "text-emerald-600"
                                    : "text-rose-600";

                                const prevSuggestion =
                                  currentMonthView !== 12 &&
                                  currentMonthView > 0 &&
                                  Number(item.budget?.[currentMonthView - 1] || 0) > 0
                                    ? String(item.budget[currentMonthView - 1])
                                    : "";
                                const displayValue =
                                  currentMonthView !== 12 && budgetVal === 0 ? "" : String(budgetVal);

                                return (
                                  <div
                                    key={`${item.group}-${item.name}`}
                                    className="bg-[#FBFBFE] border border-slate-200/50 rounded-2xl voice-row"
                                  >
                                    <div className="row-grid">
                                      <div className="min-w-0">
                                        <div className="font-extrabold text-[13px] sm:text-[14px] truncate">
                                          {item.name}
                                        </div>
                                      </div>

                                      <div className="min-w-0">
                                        {currentMonthView === 12 ? (
                                          <div className="plain-num tabnums text-slate-700">
                                            {formatMoney(budgetVal)}
                                          </div>
                                        ) : (
                                          <BudgetInput
                                            value={displayValue}
                                            suggest={prevSuggestion}
                                            onChange={(v) => updateBudget("expense", itemIndex, v)}
                                          />
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          openDetailModal("expense", item.group, item.name, currentMonthView)
                                        }
                                        className="inline-flex items-center justify-end gap-1.5 hover:underline text-rose-700"
                                        title="Vedi movimenti"
                                      >
                                        <span className="plain-num tabnums">{formatMoney(actualVal)}</span>
                                        <Search className="w-4 h-4 opacity-80" />
                                      </button>

                                      <div className={["plain-num tabnums", diffClass].join(" ")}>
                                        {formatMoney(diffVal)}
                                      </div>
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
              <div className="text-[12px] font-extrabold tracking-wider text-slate-500 uppercase">
                Entrate
              </div>
              <div className="text-[12px] text-slate-500 font-extrabold nowrap tabnums">
                <span className="mr-2">Entrate</span>
                <span className="text-slate-900">{formatMoney(footerTotals.incAct)}</span>
              </div>
            </div>

            {Object.keys(groupedIncome).length === 0 ? (
              <div className="lux-card p-5 text-slate-600 text-sm font-semibold">
                <button
                  className="font-extrabold text-indigo-700 hover:underline"
                  onClick={() => openAddCategoryModal("income")}
                >
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
      <Modal open={reportOpen} onClose={() => setReportOpen(false)} z="z-[70]" padding="p-0 sm:p-4" overlayClass="bg-slate-900/80 backdrop-blur-sm">
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
                        {shortMonths.map((mLabel) => (
                          <th key={mLabel} className="px-4 py-3 text-right min-w-[90px]">
                            {mLabel}
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
   App wrapper (Login Gate)
========================= */
export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!session) return <Login />;

  return <FinanceApp />;
}
