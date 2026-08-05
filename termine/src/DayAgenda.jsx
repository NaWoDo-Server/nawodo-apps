import React from "react";
import { Trash2, Pencil, Plus, Zap } from "lucide-react";
import { ICONS } from "./icons";
import { INK, INK_SOFT, BORDER } from "./theme";
import { weekdayLabel, bookingEndDate, bookingCoversDate, toMinutes, dayIndexInRange } from "./calendarUtils";

// Tagesansicht, die unter dem Kalender erscheint (Desktop und Mobile teilen
// sich diese Komponente). Wird durch Einzelklick auf einen Tag angezeigt.
export default function DayAgenda({
  date, bookings, resources, calendarResources, eventCategory, colorFor, onDelete, onEdit,
  onBook, showBookButton, isManageable, canAccessWorkshop, canAccessSaubermachtag,
}) {
  const dayBookings = bookings
    .filter((b) => bookingCoversDate(b, date) && calendarResources.some((r) => r.id === b.resource_id))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold" style={{ color: INK_SOFT }}>{weekdayLabel(date)}</div>
        {showBookButton && (
          <button onClick={() => onBook(date)} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: INK }}>
            <Plus size={12} /> Buchen
          </button>
        )}
      </div>
      {dayBookings.length === 0 ? (
        <div className="text-xs py-3 px-3 rounded-lg" style={{ backgroundColor: "#E9E6D9", color: INK_SOFT }}>Frei</div>
      ) : (
        <div className="space-y-2">
          {dayBookings.map((b) => {
            const res = resources.find((r) => r.id === b.resource_id);
            const isEvent = eventCategory && res?.category_id === eventCategory.id;
            const Icon = (isEvent ? ICONS[eventCategory.icon] : ICONS[res?.icon]) || Zap;
            const label = b.title || res?.name;
            const isMultiDay = bookingEndDate(b) !== b.date;
            const { idx, totalDays } = isMultiDay ? dayIndexInRange(b, date) : { idx: 1, totalDays: 1 };
            return (
              <div key={b.id} className="rounded-lg pl-3.5 pr-2 py-3 flex items-center gap-3 relative" style={{ backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
                <div className="absolute left-0 top-0 bottom-0 w-2 rounded-l-lg" style={{ backgroundColor: colorFor(res) }} />
                <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ml-1.5" style={{ backgroundColor: colorFor(res) }}><Icon size={15} color="#fff" /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{label}</span>
                    {b.all_day ? (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: BORDER, color: INK }}>
                        Ganztägig{isMultiDay ? ` · bis ${weekdayLabel(bookingEndDate(b))}` : ""}
                      </span>
                    ) : (
                      <span className="text-sm" style={{ color: INK_SOFT }}>
                        {b.start_time}{isMultiDay ? ` (${b.date.slice(8)}.${b.date.slice(5, 7)}.)` : ""}–{b.end_time}{isMultiDay ? ` (${bookingEndDate(b).slice(8)}.${bookingEndDate(b).slice(5, 7)}.)` : ""}
                      </span>
                    )}
                    {isMultiDay && <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: colorFor(res), color: "#fff" }}>{idx}/{totalDays}</span>}
                    {b.online_note && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FBE4E4", color: "#C0271F", border: "1px solid #C0271F" }}>
                        {b.online_note}
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: INK_SOFT }}>{b.name}{b.note ? ` · ${b.note}` : ""}</div>
                  {isEvent && b.workshop_id && canAccessWorkshop && (
                    <a
                      href={`/grossgruppe/?open=${b.workshop_id}`}
                      className="inline-block mt-1.5 text-xs font-semibold px-2 py-1 rounded-full"
                      style={{ border: "1.5px solid #D8D5C7", color: INK }}
                    >
                      Zur Großgruppe →
                    </a>
                  )}
                  {isEvent && b.saubermachtag_id && canAccessSaubermachtag && (
                    <a
                      href={`/saubermachtag/?open=${b.saubermachtag_id}`}
                      className="inline-block mt-1.5 text-xs font-semibold px-2 py-1 rounded-full"
                      style={{ border: "1.5px solid #D8D5C7", color: INK }}
                    >
                      Zum Saubermachtag →
                    </a>
                  )}
                </div>
                {(!isManageable || isManageable(res)) && (
                  <>
                    <button onClick={() => onEdit(b)} className="p-2 flex-shrink-0" style={{ color: "#B8B4A2" }} title="Bearbeiten"><Pencil size={15} /></button>
                    <button onClick={() => onDelete(b)} className="p-2 flex-shrink-0" style={{ color: "#B8B4A2" }} title="Löschen"><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
