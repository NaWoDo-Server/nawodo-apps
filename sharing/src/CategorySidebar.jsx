import React, { useState } from "react";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { INK, INK_SOFT, BORDER_SOFT } from "./theme";

function CategoryRow({ c, isActive, onToggle, indent }) {
  return (
    <button
      onClick={() => onToggle(c.id)}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left"
      style={{ backgroundColor: isActive ? `${c.color}1A` : "transparent", marginLeft: indent ? 18 : 0 }}
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
}

// Sidebar links unter dem Mini-Kalender: Reiter (Kategorien) an-/abwählbar.
// Ist keine Kategorie angewählt, zeigt der Kalender auch nichts an (Filter-Logik sitzt in App.jsx).
//
// Optional: primaryCategoryIds/groupLabel/groupCategoryIds – wenn gesetzt, werden die
// primären Kategorien (z.B. Termine) oben einzeln gezeigt, alle übrigen Kategorien
// darunter in einem einklappbaren Reiter (z.B. "Sharing") gebündelt, um die Liste
// übersichtlicher zu halten (genutzt in der Termine-App).
export default function CategorySidebar({ categories, activeCategoryIds, onToggle, onAll, onNone, primaryCategoryIds, groupLabel, groupCategoryIds }) {
  const [groupOpen, setGroupOpen] = useState(false);
  const active = activeCategoryIds || [];

  const hasGrouping = !!primaryCategoryIds;
  const primary = hasGrouping ? categories.filter((c) => primaryCategoryIds.includes(c.id)) : categories;
  const grouped = hasGrouping ? categories.filter((c) => (groupCategoryIds || []).includes(c.id)) : [];
  const groupActiveCount = grouped.filter((c) => active.includes(c.id)).length;

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
        {primary.map((c) => (
          <CategoryRow key={c.id} c={c} isActive={active.includes(c.id)} onToggle={onToggle} />
        ))}

        {hasGrouping && grouped.length > 0 && (
          <>
            <button
              onClick={() => setGroupOpen((v) => !v)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left"
            >
              {groupOpen ? <ChevronDown size={14} color={INK_SOFT} /> : <ChevronRight size={14} color={INK_SOFT} />}
              <span style={{ color: INK_SOFT }}>{groupLabel}</span>
              {groupActiveCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: BORDER_SOFT, color: INK_SOFT }}>
                  {groupActiveCount}
                </span>
              )}
            </button>
            {groupOpen && grouped.map((c) => (
              <CategoryRow key={c.id} c={c} isActive={active.includes(c.id)} onToggle={onToggle} indent />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
