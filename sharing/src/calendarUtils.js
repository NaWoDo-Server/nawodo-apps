// ---- Datum/Zeit-Hilfsfunktionen ----
export function fmtDate(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
export function addDays(dateStr, n) { const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + n); return fmtDate(d); }
export function weekdayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]}`;
}
export function toMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
export function bookingEndDate(b) { return b.end_date || b.date; }
export function bookingCoversDate(b, dateStr) { return dateStr >= b.date && dateStr <= bookingEndDate(b); }
export function dateTimeMs(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}
export function bookingRangeMs(b) {
  const start = dateTimeMs(b.date, b.all_day ? "00:00" : b.start_time);
  const end = dateTimeMs(bookingEndDate(b), b.all_day ? "23:59" : b.end_time);
  return [start, end];
}
export function rangeOverlapsMs(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && bStart < aEnd; }
export function dayIndexInRange(b, dateStr) {
  const start = new Date(b.date + "T00:00:00");
  const cur = new Date(dateStr + "T00:00:00");
  const end = new Date(bookingEndDate(b) + "T00:00:00");
  const totalDays = Math.round((end - start) / 86400000) + 1;
  const idx = Math.round((cur - start) / 86400000) + 1;
  return { idx, totalDays };
}
export function spanSegmentStyle(b, dateStr) {
  const isStart = dateStr === b.date;
  const isEnd = dateStr === bookingEndDate(b);
  if (isStart && isEnd) return { width: "100%", marginLeft: 0, borderRadius: 6 };
  if (isStart) return { width: "100%", marginLeft: 0, borderRadius: "6px 0 0 6px" };
  if (isEnd) return { width: "100%", marginLeft: 0, borderRadius: "0 6px 6px 0" };
  return { width: "100%", marginLeft: 0, borderRadius: 0 };
}

export function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return fmtDate(d);
}
export function addWeeks(dateStr, n) { const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + 7 * n); return fmtDate(d); }
export function weekDays(weekStartStr) { const arr = []; for (let i = 0; i < 7; i++) arr.push(addDays(weekStartStr, i)); return arr; }
export function weekRangeLabel(weekStartStr) {
  const start = new Date(weekStartStr + "T00:00:00");
  const end = new Date(weekStartStr + "T00:00:00"); end.setDate(end.getDate() + 6);
  const months = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}.–${end.getDate()}. ${months[start.getMonth()]} ${start.getFullYear()}`;
  return `${start.getDate()}. ${months[start.getMonth()]} – ${end.getDate()}. ${months[end.getMonth()]} ${end.getFullYear()}`;
}
export function rangeLabel(startStr, endStr) {
  const start = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  const months = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}.–${end.getDate()}. ${months[start.getMonth()]} ${start.getFullYear()}`;
  return `${start.getDate()}. ${months[start.getMonth()]} – ${end.getDate()}. ${months[end.getMonth()]} ${end.getFullYear()}`;
}
export function firstOfMonth(dateStr) { return dateStr.slice(0, 8) + "01"; }
export function addMonths(monthStr, n) { const d = new Date(monthStr + "T00:00:00"); d.setMonth(d.getMonth() + n); return firstOfMonth(fmtDate(d)); }
export function monthLabel(monthStr) {
  const d = new Date(monthStr + "T00:00:00");
  const months = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
export function monthLabelShort(monthStr) {
  const d = new Date(monthStr + "T00:00:00");
  const months = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
export function monthGrid(monthStr) {
  const first = new Date(monthStr + "T00:00:00");
  const year = first.getFullYear(), month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ date: dateStr, day: d });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ---- Farb-Hilfsfunktionen ----
export function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}
export function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
// Weist Buchungen, die sich innerhalb eines Satzes von Tagen (z.B. eine Kalenderwoche)
// überschneiden, nicht überlappende "Lanes" zu, damit mehrtägige Buchungen als EIN
// durchgehender Balken über mehrere Tagesspalten gerendert werden können.
export function assignLanes(items, dates) {
  const rangeStart = dates[0], rangeEnd = dates[dates.length - 1];
  const sorted = [...items].sort((a, b) => {
    const aStart = a.booking.date < rangeStart ? rangeStart : a.booking.date;
    const bStart = b.booking.date < rangeStart ? rangeStart : b.booking.date;
    return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
  });
  const lanes = []; // lanes[i] = letztes Enddatum in dieser Lane
  const placed = [];
  for (const it of sorted) {
    const start = it.booking.date < rangeStart ? rangeStart : it.booking.date;
    const end = bookingEndDate(it.booking) > rangeEnd ? rangeEnd : bookingEndDate(it.booking);
    let laneIdx = lanes.findIndex((laneEnd) => laneEnd < start);
    if (laneIdx === -1) { laneIdx = lanes.length; lanes.push(end); } else { lanes[laneIdx] = end; }
    const startCol = dates.indexOf(start);
    const endCol = dates.indexOf(end);
    placed.push({ ...it, lane: laneIdx, startCol, endCol });
  }
  return { placed, laneCount: lanes.length };
}

// Wie assignLanes, aber mit fester Obergrenze an sichtbaren Lanes. Alles was
// darüber hinausgeht, wird nicht gerendert; stattdessen wird pro Tag gezählt,
// wie viele "versteckte" Buchungen diesen Tag berühren (für ein "+N"-Badge).
export function assignLanesCapped(items, dates, maxLanes) {
  const { placed } = assignLanes(items, dates);
  const visible = placed.filter((p) => p.lane < maxLanes);
  const hidden = placed.filter((p) => p.lane >= maxLanes);
  const overflowByDate = {};
  hidden.forEach((p) => {
    for (let i = p.startCol; i <= p.endCol; i++) {
      const d = dates[i];
      if (!d) continue;
      overflowByDate[d] = (overflowByDate[d] || 0) + 1;
    }
  });
  return { visible, overflowByDate };
}

export function shadeForIndex(baseHex, index, total) {
  const { h, s, l } = hexToHsl(baseHex);
  if (total <= 1) return baseHex;
  const step = 22;
  const mid = (total - 1) / 2;
  const newL = Math.min(82, Math.max(18, l + (index - mid) * step));
  return hslToHex(h, Math.max(s, 45), newL);
}
