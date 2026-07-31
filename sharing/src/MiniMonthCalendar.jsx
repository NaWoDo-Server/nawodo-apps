import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { INK, INK_SOFT, BORDER } from "./theme";
import { addMonths, monthGrid, monthLabelShort, fmtDate } from "./calendarUtils";

// Kleiner Monatsüberblick oben links. Klick auf einen Tag öffnet direkt den
// Buchungsdialog für diesen Tag (siehe onQuickBook) und springt im großen
// Kalender dorthin. Navigation hier steuert dieselbe calendarMonth wie das
// große Grid, beide bleiben also synchron.
export default function MiniMonthCalendar({ month, onMonthChange, selectedDate, onQuickBook }) {
  const today = fmtDate(new Date());
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => onMonthChange(addMonths(month, -1))} className="p-1 rounded-full hover:opacity-70" style={{ color: INK_SOFT }}>
          <ChevronLeft size={14} />
        </button>
        <div className="text-xs font-semibold">{monthLabelShort(month)}</div>
        <button onClick={() => onMonthChange(addMonths(month, 1))} className="p-1 rounded-full hover:opacity-70" style={{ color: INK_SOFT }}>
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {["M","D","M","D","F","S","S"].map((w, i) => (
          <div key={i} className="text-[9px] font-semibold" style={{ color: INK_SOFT }}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {monthGrid(month).map((cell, i) => {
          if (!cell) return <div key={i} />;
          const isToday = cell.date === today;
          const isSelected = cell.date === selectedDate;
          return (
            <button
              key={cell.date}
              onClick={() => onQuickBook(cell.date)}
              title="Klicken zum Buchen"
              className="aspect-square rounded text-[10px] flex items-center justify-center"
              style={{
                backgroundColor: isSelected ? INK : isToday ? BORDER : "transparent",
                color: isSelected ? "#fff" : INK,
                fontWeight: isToday || isSelected ? 700 : 400,
              }}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
