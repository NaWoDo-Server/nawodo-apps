import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { INK, INK_SOFT, BORDER, BORDER_SOFT } from "./theme";
import { fmtDate, addMonths, monthLabel, monthGrid, bookingEndDate, assignLanes } from "./calendarUtils";

const DOW = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const LANE_H = 20; // px pro Reiter-Zeile
const HEADER_H = 26; // px für die Tageszahl

export default function DesktopMonthGrid({
  month, onMonthChange, bookings, calendarResources, eventCategory, colorFor,
  selectedDate, onSelectDate, onOpenDialog,
}) {
  const today = fmtDate(new Date());
  const cells = monthGrid(month);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const weekLayouts = useMemo(() => weeks.map((week) => {
    const weekDates = week.map((c) => (c ? c.date : null));
    const validDates = weekDates.filter(Boolean);
    if (!validDates.length) return { termine: { placed: [], laneCount: 0 }, items: { placed: [], laneCount: 0 }, weekDates };
    const wStart = validDates[0], wEnd = validDates[validDates.length - 1];
    const covering = [];
    calendarResources.forEach((r) => {
      bookings.forEach((b) => {
        if (b.resource_id !== r.id) return;
        if (b.date > wEnd || bookingEndDate(b) < wStart) return;
        covering.push({ resource: r, booking: b });
      });
    });
    const isEvent = (it) => eventCategory && it.resource.category_id === eventCategory.id;
    const termine = assignLanes(covering.filter(isEvent), weekDates.map((d) => d || ""));
    const items = assignLanes(covering.filter((it) => !isEvent(it)), weekDates.map((d) => d || ""));
    return { termine, items, weekDates };
  }), [month, bookings, calendarResources, eventCategory]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onMonthChange(addMonths(month, -1))} className="p-2 rounded-full" style={{ backgroundColor: BORDER }}><ChevronLeft size={16} /></button>
        <div className="font-semibold text-base">{monthLabel(month)}</div>
        <button onClick={() => onMonthChange(addMonths(month, 1))} className="p-2 rounded-full" style={{ backgroundColor: BORDER }}><ChevronRight size={16} /></button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {DOW.map((w) => <div key={w} className="text-xs font-semibold text-center py-1" style={{ color: INK_SOFT }}>{w}</div>)}
      </div>

      <div className="border-t border-l rounded-lg overflow-hidden" style={{ borderColor: BORDER_SOFT }}>
        {weeks.map((week, wi) => {
          const layout = weekLayouts[wi];
          const totalLanes = layout.termine.laneCount + layout.items.laneCount;
          const rowHeight = HEADER_H + Math.max(totalLanes, 0) * LANE_H + 6;
          return (
            <div key={wi} className="relative grid grid-cols-7" style={{ minHeight: rowHeight }}>
              {week.map((cell, di) => {
                if (!cell) return <div key={di} className="border-r border-b" style={{ borderColor: BORDER_SOFT, backgroundColor: "#FAFAF6" }} />;
                const isToday = cell.date === today;
                const isSelected = cell.date === selectedDate;
                return (
                  <button
                    key={cell.date}
                    onClick={() => onSelectDate(cell.date)}
                    onDoubleClick={() => onOpenDialog(cell.date)}
                    className="border-r border-b text-left px-1.5 pt-1 relative"
                    style={{
                      borderColor: BORDER_SOFT,
                      backgroundColor: isSelected ? "#EDEAD8" : isToday ? "#F6F4EA" : "#fff",
                      boxShadow: isSelected ? `inset 0 0 0 1.5px ${INK}` : "none",
                    }}
                  >
                    <span className="text-xs font-semibold" style={{ color: isToday ? INK : INK_SOFT }}>{cell.day}</span>
                  </button>
                );
              })}

              {/* Durchgehende Reiter-Balken, über die Tagesspalten gelegt (Prozent-Positionierung statt Grid-Auto-Rows, damit die Höhe exakt zur Lane-Zahl passt) */}
              <div className="absolute inset-0 pointer-events-none">
                {layout.termine.placed.map((it, i) => (
                  <div
                    key={`t-${it.booking.id}-${i}`}
                    className="absolute text-white text-[10px] font-semibold px-1.5 truncate flex items-center rounded"
                    style={{
                      left: `calc(${(it.startCol / 7) * 100}% + 1px)`,
                      width: `calc(${((it.endCol - it.startCol + 1) / 7) * 100}% - 2px)`,
                      top: HEADER_H + it.lane * LANE_H,
                      height: LANE_H - 3,
                      backgroundColor: eventCategory.color,
                    }}
                  >
                    {it.booking.title || eventCategory.name}
                  </div>
                ))}
                {layout.items.placed.map((it, i) => (
                  <div
                    key={`b-${it.booking.id}-${i}`}
                    className="absolute text-white text-[10px] font-medium px-1.5 truncate flex items-center rounded"
                    style={{
                      left: `calc(${(it.startCol / 7) * 100}% + 1px)`,
                      width: `calc(${((it.endCol - it.startCol + 1) / 7) * 100}% - 2px)`,
                      top: HEADER_H + layout.termine.laneCount * LANE_H + it.lane * LANE_H,
                      height: LANE_H - 3,
                      backgroundColor: colorFor(it.resource),
                    }}
                  >
                    {it.resource.name} – {it.booking.name}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
