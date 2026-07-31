import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { ICONS } from "./icons";
import { INK, INK_SOFT, BORDER, BORDER_SOFT } from "./theme";
import { fmtDate, addMonths, monthLabel, monthGrid, assignLanesCapped } from "./calendarUtils";

const DOW = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const LANE_H = 20; // px pro Reiter-Zeile
const HEADER_H = 22; // px für die Tageszahl
const MAX_LANES = 4; // Gesamtzahl Zeilen pro Kachel (Höhe bleibt immer gleich)
const VISIBLE_LANES = MAX_LANES - 1; // die unterste Zeile ist für "+" reserviert, falls nötig
const CELL_H = HEADER_H + MAX_LANES * LANE_H + 8; // alle Kacheln exakt gleich hoch

export default function DesktopMonthGrid({
  month, onMonthChange, bookings, calendarResources, eventCategory, colorFor,
  selectedDate, onSelectDate, onOpenDialog,
}) {
  const today = fmtDate(new Date());
  const cells = monthGrid(month);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const weekLayouts = useMemo(() => weeks.map((week) => {
    const weekDates = week.map((c) => (c ? c.date : ""));
    const validDates = weekDates.filter(Boolean);
    if (!validDates.length) return { visible: [], overflowByDate: {} };
    const wStart = validDates[0], wEnd = validDates[validDates.length - 1];
    const covering = [];
    calendarResources.forEach((r) => {
      bookings.forEach((b) => {
        if (b.resource_id !== r.id) return;
        if (b.date > wEnd || (b.end_date || b.date) < wStart) return;
        const isEvent = !!(eventCategory && r.category_id === eventCategory.id);
        covering.push({ resource: r, booking: b, isEvent });
      });
    });
    // Termine zuerst einsortieren, damit sie bei der Lane-Vergabe Vorrang haben
    // (immer über den normalen Buchungen, wie gefordert).
    const combined = [...covering.filter((it) => it.isEvent), ...covering.filter((it) => !it.isEvent)];
    return assignLanesCapped(combined, weekDates, VISIBLE_LANES);
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
          return (
            <div key={wi} className="relative grid grid-cols-7" style={{ height: CELL_H }}>
              {week.map((cell, di) => {
                if (!cell) return <div key={di} className="border-r border-b" style={{ borderColor: BORDER_SOFT, backgroundColor: "#FAFAF6" }} />;
                const isToday = cell.date === today;
                const isSelected = cell.date === selectedDate;
                return (
                  <button
                    key={cell.date}
                    onClick={() => onSelectDate(cell.date)}
                    onDoubleClick={() => onOpenDialog(cell.date)}
                    className="border-r border-b text-left px-1.5 pt-1 relative overflow-hidden"
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
                {layout.visible.map((it, i) => {
                  const Icon = (it.isEvent ? ICONS[eventCategory?.icon] : ICONS[it.resource.icon]) || Zap;
                  const time = !it.booking.all_day ? `${it.booking.start_time}–${it.booking.end_time} ` : "";
                  const main = it.isEvent ? (it.booking.title || eventCategory?.name) : `${it.resource.name} – ${it.booking.name}`;
                  return (
                    <div
                      key={`${it.booking.id}-${i}`}
                      title={`${time}${main}`}
                      className="absolute text-white text-[10px] font-medium px-1 flex items-center gap-1 rounded"
                      style={{
                        left: `calc(${(it.startCol / 7) * 100}% + 1px)`,
                        width: `calc(${((it.endCol - it.startCol + 1) / 7) * 100}% - 2px)`,
                        top: HEADER_H + it.lane * LANE_H + 1,
                        height: LANE_H - 4,
                        backgroundColor: it.isEvent ? eventCategory.color : colorFor(it.resource),
                        fontWeight: it.isEvent ? 600 : 500,
                        boxShadow: "0 0 0 1px #fff",
                      }}
                    >
                      <Icon size={9} className="flex-shrink-0" />
                      <span className="truncate min-w-0">{time}{main}</span>
                    </div>
                  );
                })}
                {/* Reservierte unterste Zeile: erscheint nur bei Überlauf, damit sie nie
                    von einem Balken verdeckt wird (keine Buchung wird auf dieser Lane platziert) */}
                {week.map((cell, di) => {
                  if (!cell) return null;
                  const overflow = layout.overflowByDate[cell.date] || 0;
                  if (overflow <= 0) return null;
                  return (
                    <div
                      key={`overflow-${cell.date}`}
                      title={`${overflow} weitere Buchung${overflow > 1 ? "en" : ""}`}
                      className="absolute text-[10px] font-bold flex items-center justify-center rounded"
                      style={{
                        left: `calc(${(di / 7) * 100}% + 1px)`,
                        width: `calc(${(1 / 7) * 100}% - 2px)`,
                        top: HEADER_H + VISIBLE_LANES * LANE_H + 1,
                        height: LANE_H - 4,
                        backgroundColor: BORDER,
                        color: INK_SOFT,
                      }}
                    >
                      +
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
