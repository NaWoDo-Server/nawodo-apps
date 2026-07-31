import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { ICONS } from "./icons";
import { INK, INK_SOFT, BORDER, BORDER_SOFT } from "./theme";
import { fmtDate, addWeeks, weekDays, weekRangeLabel, bookingEndDate, toMinutes, assignLanes } from "./calendarUtils";

const DOW_FULL = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const DAY_START = 6 * 60; // 06:00
const DAY_END = 24 * 60; // 24:00
const HOUR_PX = 44;
const BANNER_LANE_H = 20;

// Ordnet zeitlich überlappende Buchungen innerhalb eines Tages nebeneinander an
// (statt übereinander), damit man Konflikte/Parallelbuchungen sofort sieht.
function assignTimeLanes(items) {
  const sorted = [...items].sort((a, b) => toMinutes(a.booking.start_time) - toMinutes(b.booking.start_time));
  const lanes = [];
  const placed = [];
  for (const it of sorted) {
    const start = toMinutes(it.booking.start_time), end = toMinutes(it.booking.end_time);
    let laneIdx = lanes.findIndex((laneEnd) => laneEnd <= start);
    if (laneIdx === -1) { laneIdx = lanes.length; lanes.push(end); } else { lanes[laneIdx] = end; }
    placed.push({ ...it, lane: laneIdx, start, end });
  }
  const laneCount = Math.max(lanes.length, 1);
  return placed.map((p) => ({ ...p, laneCount }));
}

export default function DesktopWeekGrid({
  weekStart, onWeekChange, bookings, calendarResources, eventCategory, colorFor,
  selectedDate, onSelectDate, onOpenDialog,
}) {
  const today = fmtDate(new Date());
  const dates = weekDays(weekStart);

  const { banner, hourlyByDay } = useMemo(() => {
    const covering = [];
    calendarResources.forEach((r) => {
      bookings.forEach((b) => {
        if (b.resource_id !== r.id) return;
        if (b.date > dates[6] || bookingEndDate(b) < dates[0]) return;
        covering.push({ resource: r, booking: b });
      });
    });
    const isMultiOrAllDay = (it) => it.booking.all_day || bookingEndDate(it.booking) !== it.booking.date;
    const isEvent = (it) => eventCategory && it.resource.category_id === eventCategory.id;
    const bannerItems = covering.filter(isMultiOrAllDay);
    const termine = assignLanes(bannerItems.filter(isEvent), dates);
    const items = assignLanes(bannerItems.filter((it) => !isEvent(it)), dates);

    const hourlyByDay = dates.map((d) => {
      const dayItems = covering.filter((it) => !isMultiOrAllDay(it) && it.booking.date === d);
      return assignTimeLanes(dayItems);
    });
    return { banner: { termine, items }, hourlyByDay };
  }, [weekStart, bookings, calendarResources, eventCategory]);

  const bannerLanes = banner.termine.laneCount + banner.items.laneCount;
  const bannerHeight = Math.max(bannerLanes, 0) * BANNER_LANE_H + (bannerLanes ? 8 : 0);
  const gridHeight = ((DAY_END - DAY_START) / 60) * HOUR_PX;

  function timeFromOffsetY(offsetY) {
    const minutes = DAY_START + Math.round((offsetY / HOUR_PX) * 60 / 30) * 30;
    const clamped = Math.min(DAY_END - 30, Math.max(DAY_START, minutes));
    return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onWeekChange(addWeeks(weekStart, -1))} className="p-2 rounded-full" style={{ backgroundColor: BORDER }}><ChevronLeft size={16} /></button>
        <div className="font-semibold text-base">{weekRangeLabel(weekStart)}</div>
        <button onClick={() => onWeekChange(addWeeks(weekStart, 1))} className="p-2 rounded-full" style={{ backgroundColor: BORDER }}><ChevronRight size={16} /></button>
      </div>

      {/* Tagesköpfe */}
      <div className="grid" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div />
        {dates.map((d, i) => {
          const isToday = d === today;
          const isSelected = d === selectedDate;
          const dayNum = Number(d.slice(8, 10));
          return (
            <button
              key={d}
              onClick={() => onSelectDate(d)}
              className="text-center py-1.5 rounded-t-lg"
              style={{ backgroundColor: isSelected ? "#EDEAD8" : isToday ? "#F6F4EA" : "transparent" }}
            >
              <div className="text-[10px]" style={{ color: INK_SOFT }}>{DOW_FULL[i].slice(0, 2)}</div>
              <div className="text-sm font-semibold" style={{ color: isToday ? INK : INK }}>{dayNum}</div>
            </button>
          );
        })}
      </div>

      {/* Banner: ganztägige / mehrtägige Buchungen + Termine */}
      {bannerLanes > 0 && (
        <div className="relative border-t border-b mb-1" style={{ borderColor: BORDER_SOFT, height: bannerHeight }}>
          <div className="grid absolute inset-0" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
            <div />
            {dates.map((d) => <div key={d} className="border-r" style={{ borderColor: "#EFEDE2" }} />)}
          </div>
          {banner.termine.placed.map((it, i) => {
            const Icon = ICONS[eventCategory.icon] || Zap;
            const time = !it.booking.all_day ? `${it.booking.start_time}–${it.booking.end_time} ` : "";
            const main = it.booking.title || eventCategory.name;
            return (
              <div
                key={`t-${it.booking.id}-${i}`}
                title={`${time}${main}`}
                className="absolute text-white text-[10px] font-semibold px-1.5 flex items-center gap-1 rounded"
                style={{
                  left: `calc(48px + ${(it.startCol / 7) * 100}% + 1px)`,
                  width: `calc(${((it.endCol - it.startCol + 1) / 7) * 100}% - 2px)`,
                  top: 4 + it.lane * BANNER_LANE_H + 1,
                  height: BANNER_LANE_H - 4,
                  backgroundColor: eventCategory.color,
                  boxShadow: "0 0 0 1px #fff",
                }}
              >
                <Icon size={10} className="flex-shrink-0" /> <span className="truncate min-w-0">{time}{main}</span>
              </div>
            );
          })}
          {banner.items.placed.map((it, i) => {
            const Icon = ICONS[it.resource.icon] || Zap;
            const time = !it.booking.all_day ? `${it.booking.start_time}–${it.booking.end_time} ` : "";
            const main = `${it.resource.name} – ${it.booking.name}`;
            return (
              <div
                key={`b-${it.booking.id}-${i}`}
                title={`${time}${main}`}
                className="absolute text-white text-[10px] font-medium px-1.5 flex items-center gap-1 rounded"
                style={{
                  left: `calc(48px + ${(it.startCol / 7) * 100}% + 1px)`,
                  width: `calc(${((it.endCol - it.startCol + 1) / 7) * 100}% - 2px)`,
                  top: 4 + banner.termine.laneCount * BANNER_LANE_H + it.lane * BANNER_LANE_H + 1,
                  height: BANNER_LANE_H - 4,
                  backgroundColor: colorFor(it.resource),
                  boxShadow: "0 0 0 1px #fff",
                }}
              >
                <Icon size={10} className="flex-shrink-0" /> <span className="truncate min-w-0">{time}{main}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Stundenraster */}
      <div className="overflow-y-auto" style={{ maxHeight: 560 }}>
        <div className="grid relative" style={{ gridTemplateColumns: "48px repeat(7, 1fr)", height: gridHeight }}>
          {/* Zeitachse */}
          <div className="relative">
            {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }).map((_, i) => (
              <div key={i} className="absolute text-[10px] text-right pr-1.5 w-full" style={{ top: i * HOUR_PX - 6, color: INK_SOFT }}>
                {String((DAY_START / 60 + i) % 24).padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {dates.map((d, di) => {
            const isToday = d === today;
            return (
              <div
                key={d}
                className="relative border-l border-r"
                style={{ borderColor: "#EFEDE2", backgroundColor: isToday ? "#FCFBF5" : "transparent" }}
                onClick={() => onSelectDate(d)}
                onDoubleClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const start = timeFromOffsetY(e.clientY - rect.top);
                  onOpenDialog(d, start);
                }}
              >
                {Array.from({ length: (DAY_END - DAY_START) / 60 }).map((_, i) => (
                  <div key={i} className="absolute w-full border-t" style={{ top: i * HOUR_PX, borderColor: "#F1EFE4" }} />
                ))}
                {hourlyByDay[di].map((it, i) => {
                  const isEvent = eventCategory && it.resource.category_id === eventCategory.id;
                  const Icon = (isEvent ? ICONS[eventCategory.icon] : ICONS[it.resource.icon]) || Zap;
                  const top = ((it.start - DAY_START) / 60) * HOUR_PX;
                  const height = Math.max(((it.end - it.start) / 60) * HOUR_PX, 16);
                  const widthPct = 100 / it.laneCount;
                  return (
                    <div
                      key={`${it.booking.id}-${i}`}
                      title={`${it.booking.start_time}–${it.booking.end_time} ${isEvent ? (it.booking.title || eventCategory.name) : it.resource.name}`}
                      className="absolute text-white text-[10px] px-1 py-0.5 rounded overflow-hidden"
                      style={{
                        top, height,
                        left: `calc(${it.lane * widthPct}% + 1px)`,
                        width: `calc(${widthPct}% - 2px)`,
                        backgroundColor: isEvent ? eventCategory.color : colorFor(it.resource),
                        boxShadow: "0 0 0 1px #fff",
                      }}
                    >
                      <div className="font-semibold flex items-center gap-1 min-w-0"><Icon size={9} className="flex-shrink-0" /> <span className="truncate min-w-0">{isEvent ? (it.booking.title || eventCategory.name) : it.resource.name}</span></div>
                      <div className="truncate opacity-90">{it.booking.start_time}–{it.booking.end_time}{!isEvent ? ` · ${it.booking.name}` : ""}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
