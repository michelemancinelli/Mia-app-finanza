import React, { useState } from "react";
import { formatMoney } from "./utils";

/* =========================
   Components (UI)
========================= */
export function Modal({
  open,
  onClose,
  children,
  z = "z-[60]",
  padding = "p-4",
  overlayClass = "bg-slate-900/60 backdrop-blur-sm",
}) {
  if (!open) return null;
  return (
    <div className={`fixed inset-0 ${z} flex items-center justify-center ${padding}`}>
      <div className={`absolute inset-0 ${overlayClass}`} onClick={onClose} />
      <div className="relative w-full h-full flex items-center justify-center">{children}</div>
    </div>
  );
}

export function BudgetInput({ value, suggest, onChange }) {
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

export function MonthBtn({ label, active, onClick }) {
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

export function KpiCompact({ title, value, valueClass }) {
  return (
    <div className="lux-card p-3 sm:p-5">
      <div className="kpi-title">{title}</div>
      <div className={["kpi-value tabnums mt-2", valueClass].join(" ")}>{value}</div>
    </div>
  );
}

/* ultime 3 righe: testo più piccolo + cifre più vicine */
export function TotalsBarCompact({ expAct, expBud, incAct, incBud, netAct, netBud, yearNetAct, isAnnual }) {
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
