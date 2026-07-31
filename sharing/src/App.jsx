import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Zap, Wrench, Shirt, Tent, Car, Bike, Hammer, Package, Camera, Music,
  Plug, Home, Trees, Sun, Umbrella, Flame, Users, Sofa, Truck, CalendarDays,
  Plus, Trash2, ChevronLeft, ChevronRight, X, AlertCircle, Loader2, Settings, Image as ImageIcon, Pencil, Check, List,
} from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";

const ICONS = {
  zap: Zap, wrench: Wrench, shirt: Shirt, tent: Tent, car: Car, bike: Bike, hammer: Hammer,
  package: Package, camera: Camera, music: Music, plug: Plug, home: Home, trees: Trees,
  sun: Sun, umbrella: Umbrella, flame: Flame, users: Users, sofa: Sofa, truck: Truck, calendar: CalendarDays,
};
const ICON_KEYS = Object.keys(ICONS);
const PAPER = "#F1F0EA";
const INK = "#2B2B26";
const INK_SOFT = "#6B6A61";
const FILTER_KEY = "hofteiler_active_categories";

// ---- Datum/Zeit-Hilfsfunktionen ----
function fmtDate(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
function addDays(dateStr, n) { const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + n); return fmtDate(d); }
function weekdayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const months = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  return `${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]}`;
}
function toMinutes(t) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function bookingEndDate(b) { return b.end_date || b.date; }
function bookingCoversDate(b, dateStr) { return dateStr >= b.date && dateStr <= bookingEndDate(b); }
function dateTimeMs(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}
function bookingRangeMs(b) {
  const start = dateTimeMs(b.date, b.all_day ? "00:00" : b.start_time);
  const end = dateTimeMs(bookingEndDate(b), b.all_day ? "23:59" : b.end_time);
  return [start, end];
}
function rangeOverlapsMs(aStart, aEnd, bStart, bEnd) { return aStart < bEnd && bStart < aEnd; }
function dayIndexInRange(b, dateStr) {
  const start = new Date(b.date + "T00:00:00");
  const cur = new Date(dateStr + "T00:00:00");
  const end = new Date(bookingEndDate(b) + "T00:00:00");
  const totalDays = Math.round((end - start) / 86400000) + 1;
  const idx = Math.round((cur - start) / 86400000) + 1;
  return { idx, totalDays };
}
function spanSegmentStyle(b, dateStr) {
  const isStart = dateStr === b.date;
  const isEnd = dateStr === bookingEndDate(b);
  if (isStart && isEnd) return { width: "100%", marginLeft: 0, borderRadius: 9999 };
  if (isStart) return { width: "50%", marginLeft: "50%", borderRadius: "9999px 0 0 9999px" };
  if (isEnd) return { width: "50%", marginLeft: 0, borderRadius: "0 9999px 9999px 0" };
  return { width: "100%", marginLeft: 0, borderRadius: 0 };
}

function startOfWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return fmtDate(d);
}
function addWeeks(dateStr, n) { const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + 7 * n); return fmtDate(d); }
function weekDays(weekStartStr) { const arr = []; for (let i = 0; i < 7; i++) arr.push(addDays(weekStartStr, i)); return arr; }
function weekRangeLabel(weekStartStr) {
  const start = new Date(weekStartStr + "T00:00:00");
  const end = new Date(weekStartStr + "T00:00:00"); end.setDate(end.getDate() + 6);
  const months = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
  if (start.getMonth() === end.getMonth()) return `${start.getDate()}.–${end.getDate()}. ${months[start.getMonth()]} ${start.getFullYear()}`;
  return `${start.getDate()}. ${months[start.getMonth()]} – ${end.getDate()}. ${months[end.getMonth()]} ${end.getFullYear()}`;
}
function firstOfMonth(dateStr) { return dateStr.slice(0, 8) + "01"; }
function addMonths(monthStr, n) { const d = new Date(monthStr + "T00:00:00"); d.setMonth(d.getMonth() + n); return firstOfMonth(fmtDate(d)); }
function monthLabel(monthStr) {
  const d = new Date(monthStr + "T00:00:00");
  const months = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}
function monthGrid(monthStr) {
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
function hexToHsl(hex) {
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
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}
function shadeForIndex(baseHex, index, total) {
  const { h, s, l } = hexToHsl(baseHex);
  if (total <= 1) return baseHex;
  const step = 22;
  const mid = (total - 1) / 2;
  const newL = Math.min(82, Math.max(18, l + (index - mid) * step));
  return hslToHex(h, Math.max(s, 45), newL);
}

async function uploadFile(file, pathPrefix) {
  const ext = file.name.split(".").pop();
  const path = `${pathPrefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export default function App() {
  if (configMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}>
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-3" size={28} style={{ color: "#A13D3D" }} />
          <p className="font-semibold mb-1">Noch nicht eingerichtet</p>
          <p className="text-sm" style={{ color: INK_SOFT }}>Trage deine Supabase-Adresse und den Anon-Key in <code>config.js</code> ein, dann lädt die App.</p>
        </div>
      </div>
    );
  }
  return <AuthGate />;
}

function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = wird geladen, null = kein Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleLogin() {
    setLoginError("");
    setLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoggingIn(false);
    if (error) setLoginError("E-Mail oder Passwort falsch.");
  }

  if (session === undefined) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={28} style={{ color: INK_SOFT }} /></div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}>
        <div className="max-w-sm w-full text-center">
          <img src="/sharing/logo-nawodo.png" alt="NaWoDo Sharing" className="h-14 object-contain mx-auto mb-4" />
          <p className="text-sm mb-4" style={{ color: INK_SOFT }}>Mit deinem Account anmelden.</p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-Mail"
            type="email"
            className="w-full rounded-lg px-3 py-2.5 mb-2.5 text-sm border"
            style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Passwort"
            type="password"
            className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border"
            style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}
          />
          {loginError && <p className="text-sm mb-3" style={{ color: "#A13D3D" }}>{loginError}</p>}
          <button onClick={handleLogin} disabled={loggingIn} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: INK, opacity: loggingIn ? 0.7 : 1 }}>
            {loggingIn && <Loader2 size={15} className="animate-spin" />} Anmelden
          </button>
          <p className="text-xs mt-4" style={{ color: INK_SOFT }}>Noch keinen Zugang? Meldet euch beim Admin, der legt euch einen Account an.</p>
        </div>
      </div>
    );
  }

  return <Hofteiler session={session} />;
}

function Hofteiler({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
  const isAdmin = user.user_metadata?.is_admin === true;

  const [categories, setCategories] = useState([]);
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeCategoryIds, setActiveCategoryIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(FILTER_KEY)) || null; } catch { return null; }
  });
  const [selectedResourceId, setSelectedResourceId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()));
  const [viewMode, setViewMode] = useState("month");
  const [calendarMonth, setCalendarMonth] = useState(firstOfMonth(fmtDate(new Date())));
  const [calendarWeekStart, setCalendarWeekStart] = useState(startOfWeek(fmtDate(new Date())));
  const [showForm, setShowForm] = useState(false);
  const [showTerminForm, setShowTerminForm] = useState(false);
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [showEditResourceForm, setShowEditResourceForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingResPhoto, setUploadingResPhoto] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [formRoomId, setFormRoomId] = useState(null);
  const [formBlockZoe, setFormBlockZoe] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formStart, setFormStart] = useState("08:00");
  const [formEnd, setFormEnd] = useState("10:00");
  const [formNote, setFormNote] = useState("");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formStartDate, setFormStartDate] = useState(fmtDate(new Date()));
  const [formEndDate, setFormEndDate] = useState(fmtDate(new Date()));

  const [newResName, setNewResName] = useState("");
  const [newResIcon, setNewResIcon] = useState("zap");
  const [newResCategoryId, setNewResCategoryId] = useState("");
  const [newResPhoto, setNewResPhoto] = useState(null);

  const [editResName, setEditResName] = useState("");
  const [editResIcon, setEditResIcon] = useState("zap");
  const [editResCategoryId, setEditResCategoryId] = useState("");
  const [editResPhoto, setEditResPhoto] = useState(null);

  const logoInputRef = useRef(null);
  const resPhotoInputRef = useRef(null);
  const editResPhotoInputRef = useRef(null);

  function colorFor(resource) {
    if (!resource) return "#888888";
    const cat = categories.find((c) => c.id === resource.category_id);
    if (!cat) return "#888888";
    const siblings = resources.filter((r) => r.category_id === resource.category_id);
    const idx = Math.max(0, siblings.findIndex((r) => r.id === resource.id));
    return shadeForIndex(cat.color, idx, siblings.length);
  }

  const eventCategory = categories.find((c) => c.event_mode);
  const eventResource = eventCategory ? resources.find((r) => r.category_id === eventCategory.id) : null;
  const pickableCategories = categories.filter((c) => !c.event_mode);
  const roomCategory = categories.find((c) => c.name === "Raumbuchung");
  const roomResources = roomCategory ? resources.filter((r) => r.category_id === roomCategory.id) : [];
  const zoeResource = resources.find((r) => r.name === "Zoe");
  const isWallboxResource = (r) => r?.name === "Wallbox 1" || r?.name === "Wallbox 2";

  const loadAll = useCallback(async (isFirst = false) => {
    try {
      const [cats, res, bks, settings] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order").then((r) => r.data || []),
        supabase.from("resources").select("*").order("created_at").then((r) => r.data || []),
        supabase.from("bookings").select("*").then((r) => r.data || []),
        supabase.from("settings").select("*").then((r) => r.data || []),
      ]);
      setCategories(cats);
      setResources(res);
      setBookings(bks);
      setLogoUrl(settings.find((s) => s.key === "logo_url")?.value || null);
      if (isFirst) {
        setActiveCategoryIds((prev) => prev || cats.map((c) => c.id));
        if (!newResCategoryId && cats.length) {
          const firstPickable = cats.find((c) => !c.event_mode);
          setNewResCategoryId(firstPickable?.id || cats[0].id);
        }
      }
    } catch (e) {
      if (isFirst) setLoadError(true);
    } finally {
      if (isFirst) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll(true);
    const interval = setInterval(() => loadAll(false), 15000);
    return () => clearInterval(interval);
  }, [loadAll]);

  useEffect(() => {
    const channel = supabase
      .channel("bookings-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => {
        supabase.from("bookings").select("*").then(({ data }) => data && setBookings(data));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (activeCategoryIds) localStorage.setItem(FILTER_KEY, JSON.stringify(activeCategoryIds));
  }, [activeCategoryIds]);

  function toggleCategory(id) {
    setActiveCategoryIds((prev) => {
      const set = new Set(prev || []);
      if (set.has(id)) set.delete(id); else set.add(id);
      return Array.from(set);
    });
  }

  // Items für die Reiter-Leiste: ohne die Termin-Kategorie (die hat keine wählbaren Items)
  const tabResources = resources.filter((r) => (activeCategoryIds || []).includes(r.category_id) && r.category_id !== eventCategory?.id);
  // Ressourcen für Kalender/Tagesübersicht: alle aktiven Bereiche, inkl. Termine; ohne Auswahl -> alles anzeigen
  const calendarResources = activeCategoryIds && activeCategoryIds.length ? resources.filter((r) => activeCategoryIds.includes(r.category_id)) : resources;

  useEffect(() => {
    if (tabResources.length && !tabResources.find((r) => r.id === selectedResourceId)) {
      setSelectedResourceId(tabResources[0].id);
    }
    if (!tabResources.length) setSelectedResourceId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryIds, resources]);

  async function refreshBookings() {
    const { data } = await supabase.from("bookings").select("*");
    setBookings(data || []);
    return data || [];
  }

  function checkConflictAndInsert({ resourceId, startDate, endDate, allDay, startTime, endTime, name, note, title }) {
    return (async () => {
      const latest = await refreshBookings();
      const newBooking = { date: startDate, end_date: endDate, all_day: allDay, start_time: allDay ? "00:00" : startTime, end_time: allDay ? "23:59" : endTime };
      const [newStart, newEnd] = bookingRangeMs(newBooking);
      const conflict = latest.find((b) => {
        if (b.resource_id !== resourceId) return false;
        const [bStart, bEnd] = bookingRangeMs(b);
        return rangeOverlapsMs(newStart, newEnd, bStart, bEnd);
      });
      if (conflict) {
        const range = conflict.date === bookingEndDate(conflict) ? conflict.date : `${conflict.date} – ${bookingEndDate(conflict)}`;
        throw new Error(conflict.all_day ? `Schon belegt von ${conflict.name} (ganztägig, ${range}).` : `Schon belegt von ${conflict.name} (${conflict.date} ${conflict.start_time} – ${bookingEndDate(conflict)} ${conflict.end_time}).`);
      }
      const { error } = await supabase.from("bookings").insert({
        resource_id: resourceId,
        date: startDate,
        end_date: endDate,
        all_day: allDay,
        start_time: allDay ? "00:00" : startTime,
        end_time: allDay ? "23:59" : endTime,
        name: name.trim(),
        note: note.trim() || null,
        title: title ? title.trim() : null,
      });
      if (error) throw error;
      await refreshBookings();
    })();
  }

  async function handleAddBooking() {
    setFormError("");
    if (formEndDate < formStartDate) return setFormError("Enddatum darf nicht vor dem Startdatum liegen.");
    if (!formAllDay && formEndDate === formStartDate && toMinutes(formEnd) <= toMinutes(formStart)) {
      return setFormError("Ende muss nach dem Start liegen.");
    }
    setSaving(true);
    try {
      await checkConflictAndInsert({ resourceId: selectedResourceId, startDate: formStartDate, endDate: formEndDate, allDay: formAllDay, startTime: formStart, endTime: formEnd, name: userName, note: formNote });
      if (formBlockZoe && zoeResource) {
        try {
          await checkConflictAndInsert({ resourceId: zoeResource.id, startDate: formStartDate, endDate: formEndDate, allDay: formAllDay, startTime: formStart, endTime: formEnd, name: userName, note: formNote });
        } catch (zoeErr) {
          setFormError(`Wallbox gebucht, aber Zoe konnte nicht mitgeblockt werden: ${zoeErr.message}`);
          setSaving(false);
          return;
        }
      }
      setShowForm(false);
      setFormNote("");
      setFormAllDay(false);
      setFormBlockZoe(false);
    } catch (e) {
      setFormError(e.message || "Speichern hat nicht geklappt. Nochmal versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddTermin() {
    setFormError("");
    if (!formTitle.trim()) return setFormError("Bitte einen Titel für den Termin eintragen.");
    if (formEndDate < formStartDate) return setFormError("Enddatum darf nicht vor dem Startdatum liegen.");
    if (!formAllDay && formEndDate === formStartDate && toMinutes(formEnd) <= toMinutes(formStart)) {
      return setFormError("Ende muss nach dem Start liegen.");
    }
    setSaving(true);
    try {
      await checkConflictAndInsert({ resourceId: eventResource.id, startDate: formStartDate, endDate: formEndDate, allDay: formAllDay, startTime: formStart, endTime: formEnd, name: userName, note: formNote, title: formTitle });
      if (formRoomId) {
        try {
          await checkConflictAndInsert({ resourceId: formRoomId, startDate: formStartDate, endDate: formEndDate, allDay: formAllDay, startTime: formStart, endTime: formEnd, name: userName, note: formNote, title: formTitle });
        } catch (roomErr) {
          setFormError(`Termin gespeichert, aber der Raum konnte nicht mitgebucht werden: ${roomErr.message}`);
          setSaving(false);
          return;
        }
      }
      setShowTerminForm(false);
      setFormTitle("");
      setFormNote("");
      setFormAllDay(false);
      setFormRoomId(null);
    } catch (e) {
      setFormError(e.message || "Speichern hat nicht geklappt. Nochmal versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(booking) {
    const label = booking.all_day
      ? `Ganztägig${bookingEndDate(booking) !== booking.date ? ` (${booking.date} – ${bookingEndDate(booking)})` : ` (${booking.date})`}`
      : `${booking.start_time}–${booking.end_time}`;
    if (!window.confirm(`Buchung von ${booking.name} wirklich löschen?\n${label}`)) return;
    try { await supabase.from("bookings").delete().eq("id", booking.id); await refreshBookings(); } catch {}
  }

  async function handleAddResource() {
    if (!newResName.trim() || !newResCategoryId) return;
    try {
      let photo_url = null;
      if (newResPhoto) { setUploadingResPhoto(true); photo_url = await uploadFile(newResPhoto, `resources/${Date.now()}`); }
      const { data, error } = await supabase.from("resources").insert({ name: newResName.trim(), icon: newResIcon, category_id: newResCategoryId, photo_url }).select().single();
      if (error) throw error;
      setResources((prev) => [...prev, data]);
      setSelectedResourceId(data.id);
      setShowResourceForm(false);
      setNewResName("");
      setNewResPhoto(null);
    } catch (e) {
      // Formular bleibt offen
    } finally {
      setUploadingResPhoto(false);
    }
  }

  function openEditResource(resource) {
    setEditResName(resource.name);
    setEditResIcon(resource.icon);
    setEditResCategoryId(resource.category_id);
    setEditResPhoto(null);
    setShowEditResourceForm(true);
  }

  async function handleEditResource(resourceId) {
    if (!editResName.trim()) return;
    setSavingEdit(true);
    try {
      const current = resources.find((r) => r.id === resourceId);
      let photo_url = current?.photo_url || null;
      if (editResPhoto) photo_url = await uploadFile(editResPhoto, `resources/${resourceId}-${Date.now()}`);
      const { error } = await supabase.from("resources").update({ name: editResName.trim(), icon: editResIcon, category_id: editResCategoryId, photo_url }).eq("id", resourceId);
      if (error) throw error;
      setResources((prev) => prev.map((r) => (r.id === resourceId ? { ...r, name: editResName.trim(), icon: editResIcon, category_id: editResCategoryId, photo_url } : r)));
      setShowEditResourceForm(false);
    } catch (e) {
      // Formular bleibt offen
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteResource(resourceId) {
    if (!window.confirm("Dieses Item inkl. aller Buchungen wirklich löschen?")) return;
    try {
      await supabase.from("resources").delete().eq("id", resourceId);
      const remaining = resources.filter((r) => r.id !== resourceId);
      setResources(remaining);
      setBookings((prev) => prev.filter((b) => b.resource_id !== resourceId));
      setShowEditResourceForm(false);
    } catch {}
  }

  async function handleLogoUpload(file) {
    setUploadingLogo(true);
    try {
      const url = await uploadFile(file, "branding/logo");
      await supabase.from("settings").upsert({ key: "logo_url", value: url });
      setLogoUrl(url);
    } catch {} finally { setUploadingLogo(false); }
  }

  function requireAdmin(action) {
    if (isAdmin) { action(); return; }
    alert("Das dürfen nur Admin-Accounts. Melde dich beim Admin, falls du das brauchst.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function handleChangePassword() {
    setPasswordError("");
    setPasswordSuccess(false);
    if (newPassword.length < 6) return setPasswordError("Mindestens 6 Zeichen.");
    if (newPassword !== newPasswordConfirm) return setPasswordError("Passwörter stimmen nicht überein.");
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess(true);
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (e) {
      setPasswordError(e.message || "Hat nicht geklappt. Nochmal versuchen.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={28} style={{ color: INK_SOFT }} /></div>;
  }
  if (loadError) {
    return <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}><p className="text-center">Verbindung zur Datenbank fehlgeschlagen. Prüfe config.js oder lade die Seite neu.</p></div>;
  }

  const activeResource = tabResources.find((r) => r.id === selectedResourceId) || tabResources[0];
  const activeColor = colorFor(activeResource);

  // FIX: Tagesübersicht zeigt IMMER alle Buchungen der sichtbaren Bereiche, unabhängig vom gewählten Item-Reiter
  const dayBookings = bookings
    .filter((b) => bookingCoversDate(b, selectedDate) && calendarResources.some((r) => r.id === b.resource_id))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));

  const previewDate = hoveredDate || selectedDate;
  const previewBookings = bookings
    .filter((b) => bookingCoversDate(b, previewDate) && calendarResources.some((r) => r.id === b.resource_id))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto sm:border-x" style={{ borderColor: "#E4E1D3" }}>
      <div className="px-5 pt-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8 object-contain" /> : (
            <img src="/sharing/logo-nawodo.png" alt="NaWoDo" className="h-8 object-contain" />
          )}
          <h1 className="font-bold text-lg">Ressourcen im Wohnprojekt</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href="/" className="p-2 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} style={{ color: INK_SOFT }} /></a>
          <button onClick={() => setShowSettings(true)} className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white flex-shrink-0" style={{ backgroundColor: INK }}>{userName.charAt(0).toUpperCase()}</button>
        </div>
      </div>

      <div className="px-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {categories.map((c) => {
          const Icon = ICONS[c.icon] || Package;
          const active = (activeCategoryIds || []).includes(c.id);
          return (
            <button key={c.id} onClick={() => toggleCategory(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ backgroundColor: active ? c.color : `${c.color}1A`, color: active ? "#fff" : c.color, border: `1.5px solid ${active ? c.color : `${c.color}55`}` }}>
              {active ? <Check size={12} /> : <Icon size={12} />} {c.name}
            </button>
          );
        })}
      </div>

      {pickableCategories
        .filter((c) => (activeCategoryIds || []).includes(c.id))
        .map((cat) => {
          const items = tabResources.filter((r) => r.category_id === cat.id);
          if (!items.length) return null;
          return (
            <div key={cat.id} className="px-5 mt-3">
              <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: cat.color }}>{cat.name}</div>
              <div className="flex gap-2 flex-wrap">
                {items.map((r) => {
                  const Icon = ICONS[r.icon] || Zap;
                  const active = r.id === activeResource?.id;
                  const col = colorFor(r);
                  return (
                    <button key={r.id} onClick={() => setSelectedResourceId(r.id)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: active ? col : `${col}1A`, color: active ? "#fff" : INK, border: `1.5px solid ${active ? col : `${col}55`}` }}>
                      <Icon size={14} />
                      <span>{r.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

      {eventCategory && (activeCategoryIds || []).includes(eventCategory.id) && eventResource && (
        <div className="px-5 mt-3">
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: eventCategory.color }}>{eventCategory.name}</div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setShowTerminForm(true); setFormError(""); setFormTitle(""); setFormAllDay(false); setFormStartDate(selectedDate); setFormEndDate(selectedDate); setFormRoomId(null); }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold" style={{ backgroundColor: eventCategory.color, color: "#fff" }}>
              <CalendarDays size={14} /> Termin eintragen
            </button>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="px-5 mt-3 flex gap-2 flex-wrap">
          <button onClick={() => requireAdmin(() => setShowResourceForm(true))} className="flex items-center gap-1 px-3 py-2 rounded-full text-sm" style={{ border: "1.5px dashed #B8B4A2", color: INK_SOFT }}><Plus size={14} /> Neu</button>
        </div>
      )}

      {isAdmin && activeResource && (
        <div className="px-5 flex justify-end mt-1.5 mb-1">
          <button onClick={() => requireAdmin(() => openEditResource(activeResource))} className="flex items-center gap-1 text-xs" style={{ color: INK_SOFT }}><Pencil size={12} /> {activeResource.name} bearbeiten</button>
        </div>
      )}

      {activeResource?.photo_url && (
        <div className="px-5 mb-3"><img src={activeResource.photo_url} alt={activeResource.name} className="w-full h-32 object-cover rounded-xl" /></div>
      )}

      <>
        <div className="px-5 mt-2 flex items-center justify-between">
          <div className="flex gap-1 p-1 rounded-full" style={{ backgroundColor: "#E4E1D3" }}>
            <button onClick={() => setViewMode("day")} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: viewMode === "day" ? "#fff" : "transparent", color: viewMode === "day" ? INK : INK_SOFT }}><List size={13} /> Tag</button>
            <button onClick={() => { setViewMode("week"); setCalendarWeekStart(startOfWeek(selectedDate)); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: viewMode === "week" ? "#fff" : "transparent", color: viewMode === "week" ? INK : INK_SOFT }}><CalendarDays size={13} /> Woche</button>
            <button onClick={() => { setViewMode("month"); setCalendarMonth(firstOfMonth(selectedDate)); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: viewMode === "month" ? "#fff" : "transparent", color: viewMode === "month" ? INK : INK_SOFT }}><CalendarDays size={13} /> Monat</button>
          </div>
        </div>

        {viewMode === "week" && (
          <div className="px-5 mt-3">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setCalendarWeekStart(addWeeks(calendarWeekStart, -1))} className="p-2 rounded-full" style={{ backgroundColor: "#E4E1D3" }}><ChevronLeft size={16} /></button>
              <div className="font-semibold text-sm">{weekRangeLabel(calendarWeekStart)}</div>
              <button onClick={() => setCalendarWeekStart(addWeeks(calendarWeekStart, 1))} className="p-2 rounded-full" style={{ backgroundColor: "#E4E1D3" }}><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {weekDays(calendarWeekStart).map((dateStr) => {
                const d = new Date(dateStr + "T00:00:00");
                const weekdayShort = ["So","Mo","Di","Mi","Do","Fr","Sa"][d.getDay()];
                const spanningItems = calendarResources
                  .map((r) => {
                    const b = bookings.find((bk) => bk.resource_id === r.id && bookingCoversDate(bk, dateStr) && (bk.all_day || bookingEndDate(bk) !== bk.date));
                    return b ? { item: r, booking: b } : null;
                  })
                  .filter(Boolean);
                const singleDayTimedItems = calendarResources.filter((r) => bookings.some((b) => b.resource_id === r.id && !b.all_day && bookingEndDate(b) === b.date && b.date === dateStr));
                const isToday = dateStr === fmtDate(new Date());
                const isSelected = dateStr === selectedDate;
                return (
                  <button
                    key={dateStr}
                    onClick={() => { if (dateStr === selectedDate || hoveredDate === dateStr) { setSelectedDate(dateStr); setViewMode("day"); } else { setSelectedDate(dateStr); } }}
                    onMouseEnter={() => setHoveredDate(dateStr)}
                    onMouseLeave={() => setHoveredDate(null)}
                    className="rounded-lg py-3 flex flex-col items-center gap-1.5 relative"
                    style={{ backgroundColor: isToday ? "#E4E1D3" : "#fff", color: INK, border: isSelected ? `1.5px solid ${INK}` : "1.5px solid transparent" }}
                  >
                    <span className="text-xs" style={{ color: INK_SOFT }}>{weekdayShort}</span>
                    <span className="text-base font-semibold">{d.getDate()}</span>
                    <div className="w-full px-1 flex flex-col gap-1">
                      {spanningItems.slice(0, 2).map(({ item, booking }) => {
                        const shape = spanSegmentStyle(booking, dateStr);
                        return (
                          <span
                            key={item.id}
                            className="block h-2"
                            style={
                              booking.all_day
                                ? { backgroundColor: colorFor(item), ...shape }
                                : { backgroundImage: `repeating-linear-gradient(45deg, ${colorFor(item)}, ${colorFor(item)} 3px, transparent 3px, transparent 6px)`, border: `1px solid ${colorFor(item)}`, ...shape }
                            }
                          />
                        );
                      })}
                    </div>
                    <div className="flex gap-1 flex-wrap justify-center px-0.5" style={{ minHeight: 10 }}>
                      {singleDayTimedItems.slice(0, 5).map((it) => (
                        <span key={it.id} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorFor(it) }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}


        {viewMode === "month" && (
          <div className="px-5 mt-3">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))} className="p-2 rounded-full" style={{ backgroundColor: "#E4E1D3" }}><ChevronLeft size={16} /></button>
              <div className="font-semibold text-sm">{monthLabel(calendarMonth)}</div>
              <button onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))} className="p-2 rounded-full" style={{ backgroundColor: "#E4E1D3" }}><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {["Mo","Di","Mi","Do","Fr","Sa","So"].map((w) => <div key={w} className="text-xs font-semibold" style={{ color: INK_SOFT }}>{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGrid(calendarMonth).map((cell, i) => {
                if (!cell) return <div key={i} />;
                const spanningItems = calendarResources
                  .map((r) => {
                    const b = bookings.find((bk) => bk.resource_id === r.id && bookingCoversDate(bk, cell.date) && (bk.all_day || bookingEndDate(bk) !== bk.date));
                    return b ? { item: r, booking: b } : null;
                  })
                  .filter(Boolean);
                const singleDayTimedItems = calendarResources.filter((r) => bookings.some((b) => b.resource_id === r.id && !b.all_day && bookingEndDate(b) === b.date && b.date === cell.date));
                const isToday = cell.date === fmtDate(new Date());
                const isSelected = cell.date === selectedDate;
                return (
                  <button
                    key={cell.date}
                    onClick={() => { if (cell.date === selectedDate || hoveredDate === cell.date) { setSelectedDate(cell.date); setViewMode("day"); } else { setSelectedDate(cell.date); } }}
                    onMouseEnter={() => setHoveredDate(cell.date)}
                    onMouseLeave={() => setHoveredDate(null)}
                    className="aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative gap-0.5"
                    style={{ backgroundColor: isToday ? "#E4E1D3" : "#fff", color: INK, border: isSelected ? `1.5px solid ${INK}` : "1.5px solid transparent" }}
                  >
                    {cell.day}
                    <div className="w-full px-1 flex flex-col gap-0.5">
                      {spanningItems.slice(0, 2).map(({ item, booking }) => {
                        const shape = spanSegmentStyle(booking, cell.date);
                        return (
                          <span
                            key={item.id}
                            className="block h-1.5"
                            style={
                              booking.all_day
                                ? { backgroundColor: colorFor(item), ...shape }
                                : { backgroundImage: `repeating-linear-gradient(45deg, ${colorFor(item)}, ${colorFor(item)} 2px, transparent 2px, transparent 4px)`, border: `1px solid ${colorFor(item)}`, ...shape }
                            }
                          />
                        );
                      })}
                    </div>
                    <div className="flex gap-0.5 flex-wrap justify-center px-0.5" style={{ minHeight: 9, maxWidth: "90%" }}>
                      {singleDayTimedItems.slice(0, 4).map((it) => (
                        <span key={it.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorFor(it) }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(viewMode === "week" || viewMode === "month") && (
          <div className="px-5 mt-4">
            <div className="text-sm font-semibold mb-2" style={{ color: INK_SOFT }}>{weekdayLabel(hoveredDate || selectedDate)}{hoveredDate && hoveredDate !== selectedDate ? " (Vorschau)" : ""}</div>
            {previewBookings.length === 0 ? (
              <div className="text-xs py-3 px-3 rounded-lg" style={{ backgroundColor: "#E9E6D9", color: INK_SOFT }}>Frei</div>
            ) : (
              <div className="space-y-2">
                {previewBookings.map((b) => {
                  const res = resources.find((r) => r.id === b.resource_id);
                  const Icon = ICONS[res?.icon] || Zap;
                  const label = b.title || res?.name;
                  const isMultiDay = bookingEndDate(b) !== b.date;
                  const { idx, totalDays } = isMultiDay ? dayIndexInRange(b, previewDate) : { idx: 1, totalDays: 1 };
                  return (
                    <div key={b.id} className="flex items-center gap-2.5 text-sm px-3.5 py-3 rounded-lg" style={{ backgroundColor: "#fff" }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: colorFor(res) }}>
                        <Icon size={13} color="#fff" />
                      </span>
                      <span className="font-semibold flex-shrink-0">{label}</span>
                      <span style={{ color: INK_SOFT }}>
                        {b.all_day ? `Ganztägig${isMultiDay ? ` bis ${bookingEndDate(b)}` : ""}` : `${b.start_time}–${b.end_time}`} · {b.name}{b.note ? ` · ${b.note}` : ""}
                      </span>
                      {isMultiDay && (
                        <span className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: colorFor(res), color: "#fff" }}>{idx}/{totalDays}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {viewMode === "day" && (
          <>
            <div className="px-5 mt-3 flex items-center justify-between">
              <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-2 rounded-full" style={{ backgroundColor: "#E4E1D3" }}><ChevronLeft size={18} /></button>
              <div className="text-center">
                <div className="font-semibold text-sm">{weekdayLabel(selectedDate)}</div>
                {selectedDate !== fmtDate(new Date()) && <button onClick={() => setSelectedDate(fmtDate(new Date()))} className="text-xs underline" style={{ color: INK_SOFT }}>Zu heute</button>}
              </div>
              <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 rounded-full" style={{ backgroundColor: "#E4E1D3" }}><ChevronRight size={18} /></button>
            </div>

            <div className="px-5 mt-5 space-y-2">
              {dayBookings.length === 0 && <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}><p className="text-sm" style={{ color: INK_SOFT }}>Noch frei den ganzen Tag.</p></div>}
              {dayBookings.map((b) => {
                const res = resources.find((r) => r.id === b.resource_id);
                const Icon = ICONS[res?.icon] || Zap;
                const label = b.title || res?.name;
                const isMultiDay = bookingEndDate(b) !== b.date;
                const { idx, totalDays } = isMultiDay ? dayIndexInRange(b, selectedDate) : { idx: 1, totalDays: 1 };
                return (
                  <div key={b.id} className="rounded-lg pl-3.5 pr-2 py-3.5 flex items-center gap-3 relative" style={{ backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
                    <div className="absolute left-0 top-0 bottom-0 w-2 rounded-l-lg" style={{ backgroundColor: colorFor(res) }} />
                    <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ml-1.5" style={{ backgroundColor: colorFor(res) }}><Icon size={15} color="#fff" /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{label}</span>
                        {b.all_day ? (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "#E4E1D3", color: INK }}>
                            Ganztägig{isMultiDay ? ` · bis ${weekdayLabel(bookingEndDate(b))}` : ""}
                          </span>
                        ) : (
                          <span className="text-sm" style={{ color: INK_SOFT }}>
                            {b.start_time}{isMultiDay ? ` (${b.date.slice(8)}.${b.date.slice(5,7)}.)` : ""}–{b.end_time}{isMultiDay ? ` (${bookingEndDate(b).slice(8)}.${bookingEndDate(b).slice(5,7)}.)` : ""}
                          </span>
                        )}
                        {isMultiDay && <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: colorFor(res), color: "#fff" }}>{idx}/{totalDays}</span>}
                      </div>
                      <div className="text-xs mt-0.5 truncate" style={{ color: INK_SOFT }}>{b.name}{b.note ? ` · ${b.note}` : ""}</div>
                    </div>
                    <button onClick={() => handleDelete(b)} className="p-2 flex-shrink-0" style={{ color: "#B8B4A2" }}><Trash2 size={15} /></button>
                  </div>
                );
              })}
            </div>
            {!activeResource && <p className="px-5 mt-3 text-xs" style={{ color: INK_SOFT }}>Wähle oben einen Bereich aus, um selbst zu buchen.</p>}
          </>
        )}

        {activeResource && (
          <div className="fixed inset-0 pointer-events-none flex justify-center z-40">
            <div className="w-full sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl relative">
              <button onClick={() => { setShowForm(true); setFormError(""); setFormAllDay(false); setFormStartDate(selectedDate); setFormEndDate(selectedDate); setFormBlockZoe(false); }} className="pointer-events-auto absolute bottom-6 right-5 rounded-full px-5 py-3.5 flex items-center gap-2 font-semibold text-sm shadow-lg" style={{ backgroundColor: activeColor, color: "#fff" }}><Plus size={16} /> Buchen</button>
            </div>
          </div>
        )}
      </>
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowForm(false)}>
          <div className="w-full max-w-md rounded-t-2xl p-5 pb-8" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">{activeResource?.name} buchen</h2><button onClick={() => setShowForm(false)}><X size={20} /></button></div>
            <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
              <span className="text-xs" style={{ color: INK_SOFT }}>Gebucht als</span>
              <span className="text-sm font-semibold">{userName}</span>
            </div>

            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
              <input type="checkbox" checked={formAllDay} onChange={(e) => setFormAllDay(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">Ganztägig</span>
            </label>

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Start</label>
                <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-1.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
                {!formAllDay && <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />}
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Ende</label>
                <input type="date" min={formStartDate} value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-1.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
                {!formAllDay && <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />}
              </div>
            </div>
            {isWallboxResource(activeResource) && zoeResource && (
              <label className="flex items-center gap-2 mb-3 cursor-pointer select-none px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
                <input type="checkbox" checked={formBlockZoe} onChange={(e) => setFormBlockZoe(e.target.checked)} className="w-4 h-4" />
                <span className="text-sm font-medium">Zoe (E-Auto) gleichzeitig blocken</span>
              </label>
            )}
            <label className="text-xs font-medium block mb-1">Notiz (optional)</label>
            <input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="z.B. Ladung dringend" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            {formError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}</div>}
            <button onClick={handleAddBooking} disabled={saving} className="w-full rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2" style={{ backgroundColor: activeColor, color: "#fff", opacity: saving ? 0.7 : 1 }}>{saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Speichern…" : "Blocken"}</button>
          </div>
        </div>
      )}


      {showTerminForm && eventResource && (
        <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowTerminForm(false)}>
          <div className="w-full max-w-md rounded-t-2xl p-5 pb-8" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Termin eintragen</h2><button onClick={() => setShowTerminForm(false)}><X size={20} /></button></div>
            <label className="text-xs font-medium block mb-1">Titel des Termins</label>
            <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="z.B. Hoffest, Versammlung" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
              <span className="text-xs" style={{ color: INK_SOFT }}>Eingetragen von</span>
              <span className="text-sm font-semibold">{userName}</span>
            </div>

            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
              <input type="checkbox" checked={formAllDay} onChange={(e) => setFormAllDay(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">Ganztägig</span>
            </label>

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Start</label>
                <input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-1.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
                {!formAllDay && <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />}
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Ende</label>
                <input type="date" min={formStartDate} value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-1.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
                {!formAllDay && <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />}
              </div>
            </div>

            {roomResources.length > 0 && (
              <>
                <label className="text-xs font-medium block mb-1">Raum dazu buchen (optional)</label>
                <div className="flex gap-2 mb-3 flex-wrap">
                  <button onClick={() => setFormRoomId(null)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: !formRoomId ? INK : "transparent", color: !formRoomId ? "#fff" : INK_SOFT, border: `1.5px solid ${!formRoomId ? INK : "#D8D5C7"}` }}>Kein Raum</button>
                  {roomResources.map((r) => (
                    <button key={r.id} onClick={() => setFormRoomId(r.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: formRoomId === r.id ? colorFor(r) : "transparent", color: formRoomId === r.id ? "#fff" : INK, border: `1.5px solid ${formRoomId === r.id ? colorFor(r) : "#D8D5C7"}` }}>{r.name}</button>
                  ))}
                </div>
              </>
            )}
            <label className="text-xs font-medium block mb-1">Notiz (optional)</label>
            <input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="weitere Infos" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            {formError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}</div>}
            <button onClick={handleAddTermin} disabled={saving} className="w-full rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2" style={{ backgroundColor: eventCategory?.color, color: "#fff", opacity: saving ? 0.7 : 1 }}>{saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Speichern…" : "Termin eintragen"}</button>
          </div>
        </div>
      )}

      {showResourceForm && (
        <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowResourceForm(false)}>
          <div className="w-full max-w-md rounded-t-2xl p-5 pb-8" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Neues Item</h2><button onClick={() => setShowResourceForm(false)}><X size={20} /></button></div>
            <label className="text-xs font-medium block mb-1">Bereich</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {pickableCategories.map((c) => (
                <button key={c.id} onClick={() => setNewResCategoryId(c.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: newResCategoryId === c.id ? c.color : "transparent", color: newResCategoryId === c.id ? "#fff" : INK, border: `1.5px solid ${newResCategoryId === c.id ? c.color : "#D8D5C7"}` }}>{c.name}</button>
              ))}
            </div>
            <label className="text-xs font-medium block mb-1">Name</label>
            <input value={newResName} onChange={(e) => setNewResName(e.target.value)} placeholder="z.B. Lastenrad" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            <label className="text-xs font-medium block mb-1">Symbol</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {ICON_KEYS.map((k) => { const Icon = ICONS[k]; return (
                <button key={k} onClick={() => setNewResIcon(k)} className="p-2.5 rounded-lg border" style={{ borderColor: newResIcon === k ? INK : "#D8D5C7", backgroundColor: newResIcon === k ? "#E4E1D3" : "#fff" }}><Icon size={16} /></button>
              ); })}
            </div>
            <label className="text-xs font-medium block mb-1">Foto (optional)</label>
            <button onClick={() => resPhotoInputRef.current?.click()} className="w-full rounded-lg py-2.5 mb-4 text-sm border flex items-center justify-center gap-2" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}><ImageIcon size={15} /> {newResPhoto ? newResPhoto.name : "Bild auswählen"}</button>
            <input ref={resPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setNewResPhoto(e.target.files?.[0] || null)} />
            <button onClick={handleAddResource} disabled={uploadingResPhoto} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: INK, opacity: uploadingResPhoto ? 0.7 : 1 }}>{uploadingResPhoto && <Loader2 size={15} className="animate-spin" />} {uploadingResPhoto ? "Lädt hoch…" : "Hinzufügen"}</button>
          </div>
        </div>
      )}

      {showEditResourceForm && activeResource && (
        <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowEditResourceForm(false)}>
          <div className="w-full max-w-md rounded-t-2xl p-5 pb-8" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Item bearbeiten</h2><button onClick={() => setShowEditResourceForm(false)}><X size={20} /></button></div>
            <label className="text-xs font-medium block mb-1">Bereich</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {pickableCategories.map((c) => (
                <button key={c.id} onClick={() => setEditResCategoryId(c.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: editResCategoryId === c.id ? c.color : "transparent", color: editResCategoryId === c.id ? "#fff" : INK, border: `1.5px solid ${editResCategoryId === c.id ? c.color : "#D8D5C7"}` }}>{c.name}</button>
              ))}
            </div>
            <label className="text-xs font-medium block mb-1">Name</label>
            <input value={editResName} onChange={(e) => setEditResName(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            <label className="text-xs font-medium block mb-1">Symbol</label>
            <div className="flex gap-2 mb-3 flex-wrap">
              {ICON_KEYS.map((k) => { const Icon = ICONS[k]; return (
                <button key={k} onClick={() => setEditResIcon(k)} className="p-2.5 rounded-lg border" style={{ borderColor: editResIcon === k ? INK : "#D8D5C7", backgroundColor: editResIcon === k ? "#E4E1D3" : "#fff" }}><Icon size={16} /></button>
              ); })}
            </div>
            <label className="text-xs font-medium block mb-1">Foto</label>
            {activeResource.photo_url && !editResPhoto && <img src={activeResource.photo_url} className="w-full h-24 object-cover rounded-lg mb-2" />}
            <button onClick={() => editResPhotoInputRef.current?.click()} className="w-full rounded-lg py-2.5 mb-4 text-sm border flex items-center justify-center gap-2" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}><ImageIcon size={15} /> {editResPhoto ? editResPhoto.name : activeResource.photo_url ? "Foto ersetzen" : "Foto hinzufügen"}</button>
            <input ref={editResPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setEditResPhoto(e.target.files?.[0] || null)} />
            <button onClick={() => handleEditResource(activeResource.id)} disabled={savingEdit} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2 mb-2" style={{ backgroundColor: INK, opacity: savingEdit ? 0.7 : 1 }}>{savingEdit && <Loader2 size={15} className="animate-spin" />} {savingEdit ? "Speichern…" : "Speichern"}</button>
            <button onClick={() => handleDeleteResource(activeResource.id)} className="w-full rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2" style={{ color: "#A13D3D", border: "1.5px solid #E0B8B8" }}><Trash2 size={15} /> Item löschen</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-md rounded-t-2xl p-5 pb-8" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Einstellungen</h2><button onClick={() => setShowSettings(false)}><X size={20} /></button></div>
            <div className="mb-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
              <div className="text-sm font-semibold">{userName}{isAdmin ? " · Admin" : ""}</div>
              <div className="text-xs" style={{ color: INK_SOFT }}>{user.email}</div>
            </div>

            <label className="text-xs font-medium block mb-1">Passwort ändern</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Neues Passwort"
              className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border"
              style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}
            />
            <input
              type="password"
              value={newPasswordConfirm}
              onChange={(e) => setNewPasswordConfirm(e.target.value)}
              placeholder="Neues Passwort wiederholen"
              className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border"
              style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}
            />
            {passwordError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{passwordError}</p>}
            {passwordSuccess && <p className="text-xs mb-2" style={{ color: "#2E7D4F" }}>Passwort geändert!</p>}
            <button onClick={handleChangePassword} disabled={savingPassword} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: INK, opacity: savingPassword ? 0.7 : 1 }}>
              {savingPassword && <Loader2 size={15} className="animate-spin" />} {savingPassword ? "Speichern…" : "Passwort speichern"}
            </button>

            <label className="text-xs font-medium block mb-1">Logo</label>
            {logoUrl && <img src={logoUrl} className="w-16 h-16 rounded-lg object-cover mb-2" />}
            <button onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="w-full rounded-lg py-2.5 mb-3 text-sm border flex items-center justify-center gap-2" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}>{uploadingLogo ? <Loader2 size={15} className="animate-spin" /> : <ImageIcon size={15} />} {uploadingLogo ? "Lädt hoch…" : "Logo hochladen"}</button>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
            <button onClick={handleLogout} className="w-full rounded-lg py-2.5 text-sm border" style={{ borderColor: "#E0B8B8", color: "#A13D3D" }}>Abmelden</button>
          </div>
        </div>
      )}
    </div>
  );
}
