import React from "react";
import { Check } from "lucide-react";
import { INK, INK_SOFT, BORDER_SOFT } from "./theme";

// Sidebar links unter dem Mini-Kalender: Reiter (Kategorien) an-/abwählbar.
// Ist keine Kategorie angewählt, zeigt der Kalender auch nichts an (Filter-Logik sitzt in App.jsx).
export default function CategorySidebar({ categories, activeCategoryIds, onToggle, onAll, onNone }) {
  const active = activeCategoryIds || [];
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Reiter</div>
        <div className="flex gap-2">
          <button onClick={onAll} className="text-[11px] underline" style={{ color: INK_SOFT }}>alle</button>
          <button onClick={onNone} className="text-[11px] underline" style={{ color: INK_SOFT }}>keine</button>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {categories.map((c) => {
          const isActive = active.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => onToggle(c.id)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left"
              style={{ backgroundColor: isActive ? `${c.color}1A` : "transparent" }}
            >
              <span
                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border"
                style={{ backgroundColor: isActive ? c.color : "transparent", borderColor: isActive ? c.color : BORDER_SOFT }}
              >
                {isActive && <Check size={11} color="#fff" />}
              </span>
              <span style={{ color: isActive ? INK : INK_SOFT }}>{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
