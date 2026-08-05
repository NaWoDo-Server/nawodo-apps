import React, { useState, useEffect, useMemo } from "react";
import {
  Home, Plus, X, AlertCircle, Loader2, Calendar, Users, Trash2, Pencil,
  ChevronDown, ChevronRight, Check, Archive, Download, Search, Camera, ClipboardList,
} from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";

const APP_KEY = "saubermachtag";

const PAPER = "#F1F0EA";
const INK = "#2B2B26";
const INK_SOFT = "#6B6A61";
const BORDER_SOFT = "#D8D5C7";
const BLUE = "#2E86AB";
const PURPLE = "#6C63A6";
const GREEN = "#2E7D4F";
const PINK = "#F356AF"; // App-/Icon-Farbe des Saubermachtags

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const SLOT_OPTIONS = [
  { slot: 1, label: "1. Putztag (Jan)" },
  { slot: 2, label: "2. Putztag (Apr)" },
  { slot: 3, label: "3. Putztag (Jun)" },
  { slot: 4, label: "4. Putztag (Sep)" },
];

const DIET_OPTIONS = [
  { key: "fleisch", label: "Fleisch" },
  { key: "veggi", label: "Vegetarisch" },
  { key: "vegan", label: "Vegan" },
];

const INSPECTION_TASK = {
  bereich: "Inspektion",
  title: "Inspektionsgang (Rundgang + Doku in der Inspektionsliste)",
  sort_order: 9999,
};

function fmtDateLong(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d}. ${MONTH_NAMES[m - 1]} ${y}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function uploadInspectionPhoto(inspectionId, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `inspektion/${inspectionId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, filename: file.name };
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// =====================================================================
export default function App() {
  if (configMissing) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}>
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-3" size={28} style={{ color: "#A13D3D" }} />
          <p className="font-semibold mb-1">Noch nicht eingerichtet</p>
          <p className="text-sm" style={{ color: INK_SOFT }}>Trage die Supabase-Adresse und den Anon-Key in <code>config.js</code> ein.</p>
        </div>
      </div>
    );
  }
  return <AuthGate />;
}

function AuthGate() {
  const [session, setSession] = useState(undefined);
  const [access, setAccess] = useState(undefined);
  const [appEnabled, setAppEnabled] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) window.location.href = "/";
  }, [session]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("member_permissions")
      .select("allowed")
      .eq("user_id", session.user.id)
      .eq("app_key", APP_KEY)
      .maybeSingle()
      .then(({ data }) => setAccess(!data || data.allowed !== false))
      .catch(() => setAccess(true));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", `app_enabled_${APP_KEY}`)
      .maybeSingle()
      .then(({ data }) => setAppEnabled(!data || data.value !== false))
      .catch(() => setAppEnabled(true));
  }, [session]);

  if (session === undefined || (session && (access === undefined || appEnabled === undefined))) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: PAPER }}>
        <Loader2 className="animate-spin" size={24} style={{ color: INK_SOFT }} />
      </div>
    );
  }
  if (!session) return null;

  if (appEnabled === false && session.user.user_metadata?.is_superadmin !== true) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}>
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-3" size={28} style={{ color: "#A13D3D" }} />
          <p className="font-semibold mb-1">Vorübergehend deaktiviert</p>
          <p className="text-sm mb-4" style={{ color: INK_SOFT }}>Diese App ist derzeit ausgeschaltet.</p>
          <a href="/" className="text-sm font-semibold" style={{ color: INK }}>Zurück zur Startseite</a>
        </div>
      </div>
    );
  }

  if (access === false) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}>
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-3" size={28} style={{ color: "#A13D3D" }} />
          <p className="font-semibold mb-1">Kein Zugriff</p>
          <p className="text-sm mb-4" style={{ color: INK_SOFT }}>Für diese App wurde dir noch kein Zugriff freigeschaltet.</p>
          <a href="/" className="text-sm font-semibold" style={{ color: INK }}>Zurück zur Startseite</a>
        </div>
      </div>
    );
  }

  return <SaubermachtagApp session={session} />;
}

function SaubermachtagApp({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
  const initial = userName.charAt(0).toUpperCase();

  const isAdmin = user.user_metadata?.is_admin === true;
  const isSuperAdmin = user.user_metadata?.is_superadmin === true;
  const [myModApps, setMyModApps] = useState([]);
  const canManage = isAdmin || isSuperAdmin || myModApps.includes(APP_KEY);

  const [ownMember, setOwnMember] = useState(null);
  const [ownMemberId, setOwnMemberId] = useState(null);
  const [ownFotoUrl, setOwnFotoUrl] = useState(null);
  useEffect(() => {
    supabase.from("members").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setOwnMember(data || null);
      setOwnMemberId(data?.id || null);
      setOwnFotoUrl(data?.foto_url || null);
    });
  }, [user.id]);

  const [tab, setTab] = useState("tage");
  const [loading, setLoading] = useState(true);

  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [signups, setSignups] = useState([]);
  const [food, setFood] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [inspection, setInspection] = useState([]);
  const [inspPhotos, setInspPhotos] = useState([]);
  const [termineEventResourceId, setTermineEventResourceId] = useState(null);
  const [termineSyncWarning, setTermineSyncWarning] = useState("");

  const [showArchive, setShowArchive] = useState(false);
  const [expandedArchiveId, setExpandedArchiveId] = useState(null);

  // --- Termin-Formular ---
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formDate, setFormDate] = useState(todayStr());
  const [formStart, setFormStart] = useState("10:00");
  const [formEnd, setFormEnd] = useState("14:00");
  const [formSlot, setFormSlot] = useState(1);
  const [formCookName, setFormCookName] = useState("");
  const [formCookDish, setFormCookDish] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // --- Inspektions-Formular ---
  const [showInspForm, setShowInspForm] = useState(false);
  const [editingInsp, setEditingInsp] = useState(null);
  const [inspBereich, setInspBereich] = useState("");
  const [inspBeschreibung, setInspBeschreibung] = useState("");
  const [inspStand, setInspStand] = useState("");
  const [inspError, setInspError] = useState("");
  const [inspSaving, setInspSaving] = useState(false);
  const [inspSearch, setInspSearch] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // --- Konto ---
  const [showAccount, setShowAccount] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key !== "Escape") return;
      setShowForm(false);
      setShowInspForm(false);
      setShowAccount(false);
      setLightboxUrl(null);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [ev, tk, sg, fd, tpl, insp, iph, mods, cats, res] = await Promise.all([
      supabase.from("smt_events").select("*").order("event_date", { ascending: true }),
      supabase.from("smt_tasks").select("*").order("sort_order", { ascending: true }),
      supabase.from("smt_task_signups").select("*"),
      supabase.from("smt_food").select("*"),
      supabase.from("smt_task_templates").select("*").order("sort_order", { ascending: true }),
      supabase.from("smt_inspection").select("*").order("sort_order", { ascending: true }),
      supabase.from("smt_inspection_photos").select("*").order("sort_order", { ascending: true }),
      supabase.from("app_moderators").select("app_key").eq("user_id", user.id),
      supabase.from("categories").select("*"),
      supabase.from("resources").select("*"),
    ]);
    setEvents(ev.data || []);
    setTasks(tk.data || []);
    setSignups(sg.data || []);
    setFood(fd.data || []);
    setTemplates(tpl.data || []);
    setInspection(insp.data || []);
    setInspPhotos(iph.data || []);
    setMyModApps((mods.data || []).map((r) => r.app_key));
    const eventCat = (cats.data || []).find((c) => c.event_mode);
    const eventRes = eventCat ? (res.data || []).find((r) => r.category_id === eventCat.id) : null;
    setTermineEventResourceId(eventRes?.id || null);
    setLoading(false);
  }

  const { upcomingEvents, archivedEvents } = useMemo(() => {
    const today = todayStr();
    const upcoming = (events || []).filter((e) => e.event_date >= today).sort((a, b) => a.event_date.localeCompare(b.event_date));
    const past = (events || []).filter((e) => e.event_date < today).sort((a, b) => b.event_date.localeCompare(a.event_date));
    return { upcomingEvents: upcoming, archivedEvents: past };
  }, [events]);

  // Deep-Link vom Termine-Kalender aus (/saubermachtag/?open=<id>): passenden Termin oeffnen.
  const [openId, setOpenId] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("open"); } catch (e) { return null; }
  });
  useEffect(() => {
    if (!openId || !events.length) return;
    setTab("tage");
    if (archivedEvents.some((e) => e.id === openId)) {
      setShowArchive(true);
      setExpandedArchiveId(openId);
    }
  }, [openId, events.length]);

  const tasksFor = (eventId) => tasks.filter((t) => t.event_id === eventId);
  const signupsFor = (taskId) => signups.filter((s) => s.task_id === taskId);
  const foodFor = (eventId) => food.filter((f) => f.event_id === eventId);
  const myFood = (eventId) => food.find((f) => f.event_id === eventId && f.user_id === user.id);
  const photosFor = (inspId) => inspPhotos.filter((p) => p.inspection_id === inspId);

  function canManageEvent(e) {
    return !!e && (canManage || e.creator_user_id === user.id);
  }

  function resetForm() {
    setFormDate(todayStr());
    setFormStart("10:00");
    setFormEnd("14:00");
    setFormSlot(1);
    setFormCookName(ownMember?.vorname || userName);
    setFormCookDish("");
    setFormNotes("");
    setFormError("");
  }

  function openNewForm() {
    resetForm();
    setEditingEvent(null);
    setShowForm(true);
  }

  function openEditForm(e) {
    setEditingEvent(e);
    setFormDate(e.event_date);
    setFormStart(e.start_time || "10:00");
    setFormEnd(e.end_time || "14:00");
    setFormSlot(e.slot || 1);
    setFormCookName(e.cook_name || "");
    setFormCookDish(e.cook_dish || "");
    setFormNotes(e.notes || "");
    setFormError("");
    setShowForm(true);
  }

  // Legt nur den sichtbaren Termin im Termine-Kalender an (keine Raumbuchung/GMR).
  async function syncTermineBooking(eventId, { date, startTime, endTime, creatorName }) {
    if (!termineEventResourceId) {
      const warning = "Konnte nicht im Termine-Kalender eingetragen werden: Termin-Ressource nicht gefunden.";
      setTermineSyncWarning(warning);
      return warning;
    }
    const payload = {
      resource_id: termineEventResourceId,
      date,
      end_date: date,
      all_day: false,
      start_time: startTime || null,
      end_time: endTime || null,
      name: creatorName || "Saubermachtag",
      title: "Saubermachtag",
      note: null,
      user_id: user.id,
      saubermachtag_id: eventId,
    };
    try {
      const { data: existing, error: selErr } = await supabase.from("bookings").select("id").eq("saubermachtag_id", eventId).eq("resource_id", termineEventResourceId).maybeSingle();
      if (selErr) throw selErr;
      if (existing) {
        const { error } = await supabase.from("bookings").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bookings").insert(payload);
        if (error) throw error;
      }
      setTermineSyncWarning("");
      return "";
    } catch (e) {
      const warning = `Termine-Kalender: ${e.message || "unbekannter Fehler"}`;
      setTermineSyncWarning(warning);
      return warning;
    }
  }

  async function handleSaveEvent() {
    setFormError("");
    if (!formDate) return setFormError("Bitte ein Datum eintragen.");
    if (!formStart || !formEnd) return setFormError("Bitte Start- und Endzeit eintragen.");
    setSaving(true);
    try {
      const payload = {
        event_date: formDate,
        start_time: formStart,
        end_time: formEnd,
        slot: formSlot,
        cook_name: formCookName.trim() || null,
        cook_dish: formCookDish.trim() || null,
        notes: formNotes.trim() || null,
      };

      let eventId = editingEvent?.id;
      const creatorName = editingEvent?.creator_name || userName;
      if (editingEvent) {
        const { error } = await supabase.from("smt_events").update(payload).eq("id", editingEvent.id);
        if (error) throw error;
      } else {
        payload.creator_user_id = user.id;
        payload.creator_name = userName;
        const { data, error } = await supabase.from("smt_events").insert(payload).select().single();
        if (error) throw error;
        eventId = data.id;

        // Aufgaben aus den passenden Vorlagen instanziieren.
        const slotKey = `slot${formSlot}`;
        const matching = templates.filter((t) => t.active && t[slotKey] === true);
        const toInsert = matching.map((t) => ({
          event_id: eventId,
          template_id: t.id,
          bereich: t.bereich,
          title: t.title,
          sort_order: t.sort_order,
          done: false,
        }));
        toInsert.push({
          event_id: eventId,
          bereich: INSPECTION_TASK.bereich,
          title: INSPECTION_TASK.title,
          sort_order: INSPECTION_TASK.sort_order,
          done: false,
        });
        if (toInsert.length) {
          const { error: tErr } = await supabase.from("smt_tasks").insert(toInsert);
          if (tErr) throw tErr;
        }
      }

      const syncWarning = await syncTermineBooking(eventId, { date: formDate, startTime: formStart, endTime: formEnd, creatorName });

      setShowForm(false);
      setEditingEvent(null);
      await loadAll();
      if (syncWarning) alert(syncWarning);
    } catch (e) {
      setFormError(e.message || "Speichern hat nicht geklappt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(e) {
    if (!window.confirm(`Saubermachtag vom ${fmtDateLong(e.event_date)} wirklich löschen? Aufgaben, Anmeldungen und Essensabfrage gehen dabei verloren.`)) return;
    try {
      await supabase.from("smt_events").delete().eq("id", e.id);
      await loadAll();
    } catch (err) {
      alert(err.message || "Konnte nicht gelöscht werden.");
    }
  }

  async function handleSetFood(eventId, diet) {
    try {
      const existing = myFood(eventId);
      if (existing && existing.diet === diet) {
        await supabase.from("smt_food").delete().eq("event_id", eventId).eq("user_id", user.id);
      } else if (existing) {
        await supabase.from("smt_food").update({ diet }).eq("event_id", eventId).eq("user_id", user.id);
      } else {
        await supabase.from("smt_food").insert({ event_id: eventId, user_id: user.id, user_name: userName, diet });
      }
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht gespeichert werden.");
    }
  }

  async function handleToggleSignup(task) {
    try {
      const mine = signupsFor(task.id).find((s) => s.user_id === user.id);
      if (mine) {
        await supabase.from("smt_task_signups").delete().eq("task_id", task.id).eq("user_id", user.id);
      } else {
        await supabase.from("smt_task_signups").insert({ task_id: task.id, user_id: user.id, user_name: userName });
      }
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht gespeichert werden.");
    }
  }

  async function handleToggleDone(task) {
    try {
      const payload = task.done
        ? { done: false, done_by: null, done_by_name: null, done_at: null }
        : { done: true, done_by: user.id, done_by_name: userName, done_at: new Date().toISOString() };
      const { error } = await supabase.from("smt_tasks").update(payload).eq("id", task.id);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht gespeichert werden.");
    }
  }

  async function handleAddTask(eventId, bereich, title) {
    if (!bereich.trim() || !title.trim()) return;
    try {
      const { error } = await supabase.from("smt_tasks").insert({
        event_id: eventId, bereich: bereich.trim(), title: title.trim(), sort_order: 500, done: false,
      });
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht hinzugefügt werden.");
    }
  }

  async function handleDeleteTask(task) {
    if (!window.confirm(`Aufgabe „${task.title}" wirklich löschen?`)) return;
    try {
      await supabase.from("smt_tasks").delete().eq("id", task.id);
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht gelöscht werden.");
    }
  }

  function downloadExcel(ev) {
    const evTasks = tasksFor(ev.id).slice().sort((a, b) => (a.sort_order - b.sort_order) || a.title.localeCompare(b.title));
    const rows = evTasks.map((t) => {
      const helpers = signupsFor(t.id).map((s) => s.user_name).filter(Boolean).join(", ");
      return `<tr><td>${esc(t.bereich)}</td><td>${esc(t.title)}</td><td>${esc(helpers)}</td><td>${t.done ? "Ja" : "Nein"}</td></tr>`;
    }).join("");
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>` +
      `<table border="1">` +
      `<tr><td><b>Saubermachtag</b></td><td>${esc(fmtDateLong(ev.event_date))}</td></tr>` +
      `<tr><td>Uhrzeit</td><td>${esc(ev.start_time || "")} - ${esc(ev.end_time || "")} Uhr</td></tr>` +
      `<tr><td>Hauptverantwortlich</td><td>${esc(ev.creator_name || "")}</td></tr>` +
      `<tr><td>Es kocht</td><td>${esc(ev.cook_name || "")}</td></tr>` +
      `<tr><td>Es gibt</td><td>${esc(ev.cook_dish || "")}</td></tr>` +
      `<tr><td></td><td></td></tr>` +
      `<tr><th>Bereich</th><th>Aufgabe</th><th>Eingetragene Helfer</th><th>Fertig</th></tr>` +
      rows +
      `</table></body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Saubermachtag_${ev.event_date}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- Inspektionsliste ---
  function openNewInsp() {
    setEditingInsp(null);
    setInspBereich("");
    setInspBeschreibung("");
    setInspStand("");
    setInspError("");
    setShowInspForm(true);
  }
  function openEditInsp(row) {
    setEditingInsp(row);
    setInspBereich(row.bereich || "");
    setInspBeschreibung(row.beschreibung || "");
    setInspStand(row.stand || "");
    setInspError("");
    setShowInspForm(true);
  }
  async function handleSaveInsp() {
    setInspError("");
    setInspSaving(true);
    try {
      const payload = {
        bereich: inspBereich.trim() || null,
        beschreibung: inspBeschreibung.trim() || null,
        stand: inspStand.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editingInsp) {
        const { error } = await supabase.from("smt_inspection").update(payload).eq("id", editingInsp.id);
        if (error) throw error;
      } else {
        const maxSort = inspection.reduce((m, r) => Math.max(m, r.sort_order || 0), 0);
        const { error } = await supabase.from("smt_inspection").insert({ ...payload, sort_order: maxSort + 1 });
        if (error) throw error;
      }
      setShowInspForm(false);
      setEditingInsp(null);
      await loadAll();
    } catch (e) {
      setInspError(e.message || "Speichern hat nicht geklappt.");
    } finally {
      setInspSaving(false);
    }
  }
  async function handleDeleteInsp(row) {
    if (!window.confirm("Diesen Eintrag der Inspektionsliste wirklich löschen?")) return;
    try {
      await supabase.from("smt_inspection").delete().eq("id", row.id);
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht gelöscht werden.");
    }
  }
  async function handleUploadInspPhotos(inspId, files) {
    try {
      for (const file of files) {
        const { url, filename } = await uploadInspectionPhoto(inspId, file);
        await supabase.from("smt_inspection_photos").insert({ inspection_id: inspId, url, filename, created_by: user.id });
      }
      await loadAll();
    } catch (e) {
      alert(e.message || "Foto konnte nicht hochgeladen werden.");
    }
  }
  async function handleDeleteInspPhoto(photo) {
    if (!window.confirm("Foto wirklich löschen?")) return;
    try {
      await supabase.from("smt_inspection_photos").delete().eq("id", photo.id);
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht gelöscht werden.");
    }
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
      setPasswordError(e.message || "Konnte nicht geändert werden.");
    } finally {
      setSavingPassword(false);
    }
  }
  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const bereichOptions = useMemo(() => {
    const set = new Set();
    templates.forEach((t) => t.bereich && set.add(t.bereich));
    tasks.forEach((t) => t.bereich && set.add(t.bereich));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [templates, tasks]);

  const filteredInspection = useMemo(() => {
    const q = inspSearch.trim().toLowerCase();
    if (!q) return inspection;
    return inspection.filter((r) =>
      [r.bereich, r.beschreibung, r.stand].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [inspection, inspSearch]);

  const currentYear = new Date().getFullYear();

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: PAPER }}>
        <Loader2 className="animate-spin" size={24} style={{ color: INK_SOFT }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAPER, color: INK }}>
      <div className="max-w-3xl mx-auto lg:max-w-none lg:w-2/3 lg:mx-auto px-4 sm:px-6 py-5">
        <div className="mb-4 sticky top-0 z-30 pb-2" style={{ backgroundColor: PAPER }}>
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs lg:text-sm font-bold truncate max-w-[110px] lg:max-w-[180px]" style={{ color: INK_SOFT }}>Hallo {ownMember?.spitzname || ownMember?.vorname || userName}</span>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>{ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}</button>
            <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
          </div>
          <a href="/" className="flex items-center gap-2.5 mt-2">
            <img src="/saubermachtag/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
            <h1 className="font-bold text-lg lg:text-2xl">Saubermachtag</h1>
          </a>
          <div className="mt-3 flex items-center gap-1 p-1 rounded-full w-fit flex-wrap" style={{ backgroundColor: "#E4E1D3" }}>
            {[
              { key: "tage", label: "Saubermachtage" },
              { key: "uebersicht", label: "Übersicht" },
              { key: "inspektion", label: "Inspektionsliste" },
            ].map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="px-3.5 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap"
                  style={{ backgroundColor: active ? "#fff" : "transparent", color: active ? INK : INK_SOFT }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {tab === "tage" && (
          <>
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                onClick={openNewForm}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: PINK }}
              >
                <Plus size={14} /> Neuer Saubermachtag
              </button>
              <button
                onClick={() => setShowArchive((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
              >
                <Archive size={12} /> {showArchive ? "Archiv ausblenden" : `Archiv (${archivedEvents.length})`}
              </button>
            </div>

            {upcomingEvents.length === 0 && (
              <div className="text-center py-10 rounded-xl mb-4" style={{ backgroundColor: "#E9E6D9" }}>
                <p className="text-sm" style={{ color: INK_SOFT }}>Kein bevorstehender Saubermachtag angelegt.</p>
              </div>
            )}

            {upcomingEvents.length > 0 && (
              <div className="mb-6">
                <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: INK_SOFT }}>Bevorstehende Saubermachtage</div>
                <div className="flex flex-col gap-4">
                  {upcomingEvents.map((ev, idx) => (
                    <EventCard
                      key={ev.id}
                      ev={ev}
                      defaultExpanded={idx === 0 || ev.id === openId}
                      highlighted={idx === 0}
                      tasks={tasksFor(ev.id)}
                      signupsFor={signupsFor}
                      foodList={foodFor(ev.id)}
                      myFoodRow={myFood(ev.id)}
                      canManage={canManage}
                      canManageEvent={canManageEvent(ev)}
                      userId={user.id}
                      bereichOptions={bereichOptions}
                      onEdit={() => openEditForm(ev)}
                      onDelete={() => handleDeleteEvent(ev)}
                      onSetFood={(diet) => handleSetFood(ev.id, diet)}
                      onToggleSignup={handleToggleSignup}
                      onToggleDone={handleToggleDone}
                      onAddTask={(bereich, title) => handleAddTask(ev.id, bereich, title)}
                      onDeleteTask={handleDeleteTask}
                      onDownloadExcel={() => downloadExcel(ev)}
                    />
                  ))}
                </div>
              </div>
            )}

            {showArchive && (
              <div>
                {archivedEvents.length === 0 ? (
                  <p className="text-xs" style={{ color: INK_SOFT }}>Keine vergangenen Saubermachtage.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {archivedEvents.map((ev) => {
                      const isExpanded = expandedArchiveId === ev.id;
                      return (
                        <div key={ev.id}>
                          {isExpanded ? (
                            <EventCard
                              ev={ev}
                              defaultExpanded
                              tasks={tasksFor(ev.id)}
                              signupsFor={signupsFor}
                              foodList={foodFor(ev.id)}
                              myFoodRow={myFood(ev.id)}
                              canManage={canManage}
                              canManageEvent={canManageEvent(ev)}
                              userId={user.id}
                              bereichOptions={bereichOptions}
                              onCollapse={() => setExpandedArchiveId(null)}
                              onEdit={() => openEditForm(ev)}
                              onDelete={() => handleDeleteEvent(ev)}
                              onSetFood={(diet) => handleSetFood(ev.id, diet)}
                              onToggleSignup={handleToggleSignup}
                              onToggleDone={handleToggleDone}
                              onAddTask={(bereich, title) => handleAddTask(ev.id, bereich, title)}
                              onDeleteTask={handleDeleteTask}
                              onDownloadExcel={() => downloadExcel(ev)}
                            />
                          ) : (
                            <button
                              onClick={() => setExpandedArchiveId(ev.id)}
                              className="w-full text-left rounded-xl p-3.5 flex items-center justify-between"
                              style={{ backgroundColor: `${BLUE}14`, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderLeft: `3px solid ${BLUE}` }}
                            >
                              <div className="min-w-0">
                                <div className="font-semibold text-sm">{fmtDateLong(ev.event_date)}</div>
                                {ev.cook_name && <div className="text-xs truncate mt-0.5" style={{ color: INK_SOFT }}>Es kocht: {ev.cook_name}</div>}
                              </div>
                              <ChevronRight size={16} style={{ color: INK_SOFT }} className="flex-shrink-0" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === "uebersicht" && (
          <OverviewTab templates={templates} tasks={tasks} events={events} year={currentYear} />
        )}

        {tab === "inspektion" && (
          <InspectionTab
            rows={filteredInspection}
            photosFor={photosFor}
            canManage={canManage}
            search={inspSearch}
            onSearch={setInspSearch}
            onNew={openNewInsp}
            onEdit={openEditInsp}
            onDelete={handleDeleteInsp}
            onUploadPhotos={handleUploadInspPhotos}
            onDeletePhoto={handleDeleteInspPhoto}
            onOpenPhoto={setLightboxUrl}
          />
        )}
      </div>

      {/* Termin-Formular */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") setShowForm(false); }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[85dvh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editingEvent ? "Saubermachtag bearbeiten" : "Neuer Saubermachtag"}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <label className="text-xs font-medium block mb-1">Datum</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium block mb-1">Startzeit</label>
                <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Endzeit</label>
                <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
            </div>

            <label className="text-xs font-medium block mb-1">Welcher Putztag im Jahr?</label>
            <select value={formSlot} onChange={(e) => setFormSlot(Number(e.target.value))} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} disabled={!!editingEvent}>
              {SLOT_OPTIONS.map((o) => (
                <option key={o.slot} value={o.slot}>{o.label}</option>
              ))}
            </select>
            {editingEvent && <p className="text-xs -mt-2 mb-3" style={{ color: INK_SOFT }}>Der Putztag lässt sich nachträglich nicht ändern (Aufgaben sind bereits angelegt).</p>}

            <label className="text-xs font-medium block mb-1">Wer kocht?</label>
            <input value={formCookName} onChange={(e) => setFormCookName(e.target.value)} placeholder="Name" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Was gibt es zu essen?</label>
            <input value={formCookDish} onChange={(e) => setFormCookDish(e.target.value)} placeholder="z.B. Chili sin Carne" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Notiz (optional)</label>
            <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            {formError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}</div>}

            <button onClick={handleSaveEvent} disabled={saving} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: BLUE, opacity: saving ? 0.7 : 1 }}>
              {saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      )}

      {/* Inspektions-Formular */}
      {showInspForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") setShowInspForm(false); }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[85dvh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editingInsp ? "Eintrag bearbeiten" : "Eintrag hinzufügen"}</h2>
              <button onClick={() => setShowInspForm(false)}><X size={20} /></button>
            </div>

            <label className="text-xs font-medium block mb-1">Bereich</label>
            <input value={inspBereich} onChange={(e) => setInspBereich(e.target.value)} placeholder="z.B. Keller" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Beschreibung</label>
            <textarea value={inspBeschreibung} onChange={(e) => setInspBeschreibung(e.target.value)} rows={4} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Stand / Maßnahme</label>
            <textarea value={inspStand} onChange={(e) => setInspStand(e.target.value)} rows={2} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            {inspError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {inspError}</div>}
            {!editingInsp && <p className="text-xs mb-3" style={{ color: INK_SOFT }}>Fotos kannst du nach dem Speichern am Eintrag hinzufügen.</p>}

            <button onClick={handleSaveInsp} disabled={inspSaving} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: BLUE, opacity: inspSaving ? 0.7 : 1 }}>
              {inspSaving && <Loader2 size={15} className="animate-spin" />} {inspSaving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)", height: "100dvh" }} onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.2)" }}><X size={20} color="#fff" /></button>
        </div>
      )}

      {/* Konto */}
      {showAccount && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") setShowAccount(false); }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[85dvh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Konto</h2><button onClick={() => setShowAccount(false)}><X size={20} /></button></div>
            <div className="flex items-center gap-3 mb-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white overflow-hidden flex-shrink-0" style={{ backgroundColor: INK }}>
                {ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{userName}{isAdmin ? " · Admin" : ""}</div>
                <div className="text-xs truncate" style={{ color: INK_SOFT }}>{user.email}</div>
              </div>
            </div>

            <label className="text-xs font-medium block mb-1">Passwort ändern</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Neues Passwort" className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
            <input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} placeholder="Neues Passwort wiederholen" className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
            {passwordError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{passwordError}</p>}
            {passwordSuccess && <p className="text-xs mb-2" style={{ color: GREEN }}>Passwort geändert!</p>}
            <button onClick={handleChangePassword} disabled={savingPassword} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: INK, opacity: savingPassword ? 0.7 : 1 }}>
              {savingPassword && <Loader2 size={15} className="animate-spin" />} {savingPassword ? "Speichern…" : "Passwort speichern"}
            </button>
            <button onClick={handleLogout} className="w-full rounded-lg py-2.5 text-sm border" style={{ borderColor: "#E0B8B8", color: "#A13D3D" }}>Abmelden</button>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
function EventCard({
  ev, defaultExpanded, highlighted, tasks, signupsFor, foodList, myFoodRow, canManage, canManageEvent, userId,
  bereichOptions, onCollapse, onEdit, onDelete, onSetFood, onToggleSignup, onToggleDone, onAddTask, onDeleteTask, onDownloadExcel,
}) {
  const [expanded, setExpanded] = useState(!!defaultExpanded);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newBereichSel, setNewBereichSel] = useState("");
  const [newBereichCustom, setNewBereichCustom] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const accent = PINK;

  const groupedTasks = useMemo(() => {
    const sorted = tasks.slice().sort((a, b) => (a.sort_order - b.sort_order) || a.title.localeCompare(b.title));
    const groups = [];
    const idx = {};
    for (const t of sorted) {
      const key = t.bereich || "Sonstiges";
      if (!(key in idx)) { idx[key] = groups.length; groups.push({ bereich: key, items: [] }); }
      groups[idx[key]].items.push(t);
    }
    return groups;
  }, [tasks]);

  const foodTotal = foodList.length;
  const byDiet = (d) => foodList.filter((f) => f.diet === d);

  function submitAddTask() {
    const bereich = newBereichCustom.trim() || newBereichSel;
    if (!bereich || !newTaskTitle.trim()) return;
    onAddTask(bereich, newTaskTitle);
    setNewTaskTitle("");
    setNewBereichCustom("");
  }

  return (
    <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: expanded ? "#fff" : `${accent}0D`, boxShadow: highlighted ? "0 2px 8px rgba(0,0,0,0.10)" : "0 1px 3px rgba(0,0,0,0.08)", border: highlighted ? `1.5px solid ${accent}33` : `1px solid ${accent}1A`, borderLeft: `4px solid ${accent}` }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="flex items-center gap-1.5 font-bold text-base"><Calendar size={15} style={{ color: accent }} /> {fmtDateLong(ev.event_date)}</div>
          <div className="text-sm mt-0.5" style={{ color: INK_SOFT }}>{ev.start_time || ""}{ev.end_time ? `–${ev.end_time}` : ""} Uhr</div>
          {ev.creator_name && <div className="text-sm mt-0.5" style={{ color: INK_SOFT }}>Hauptverantwortlich: {ev.creator_name}</div>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canManageEvent && (
            <>
              <button onClick={onEdit}><Pencil size={14} style={{ color: "#B8B4A2" }} /></button>
              <button onClick={onDelete}><Trash2 size={14} style={{ color: "#B8B4A2" }} /></button>
            </>
          )}
          {onCollapse && (
            <button onClick={onCollapse} className="text-xs font-semibold" style={{ color: INK_SOFT }}>Einklappen</button>
          )}
        </div>
      </div>

      {ev.notes && <p className="text-sm mb-1 whitespace-pre-line" style={{ color: INK_SOFT }}>{ev.notes}</p>}

      <button onClick={() => setExpanded((v) => !v)} className="mt-1 flex items-center gap-1 text-xs font-semibold" style={{ color: accent }}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {expanded ? "Weniger anzeigen" : "Mehr anzeigen"}
      </button>

      {expanded && (
        <>
          {/* Essen */}
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
            <div className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: INK_SOFT }}>Essen</div>
            <p className="text-sm mb-2">
              Es kocht: <span className="font-semibold">{ev.cook_name || "—"}</span>
              {ev.cook_dish ? <> — Es gibt: <span className="font-semibold">{ev.cook_dish}</span></> : null}
            </p>
            <div className="flex gap-2 mb-2">
              {DIET_OPTIONS.map((opt) => {
                const active = myFoodRow?.diet === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => onSetFood(opt.key)}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold"
                    style={{ backgroundColor: active ? GREEN : `${GREEN}1A`, color: active ? "#fff" : GREEN }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <div className="text-xs" style={{ color: INK_SOFT }}>
              <div className="flex items-center gap-1.5 mb-0.5"><Users size={12} /> {foodTotal} {foodTotal === 1 ? "Mitesser" : "Mitesser"}</div>
              {DIET_OPTIONS.map((opt) => {
                const rows = byDiet(opt.key);
                return (
                  <div key={opt.key} className="mt-0.5">
                    <span className="font-semibold">{opt.label}: {rows.length}</span>
                    {rows.length > 0 && <span> — {rows.map((r) => r.user_name).filter(Boolean).join(", ")}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aufgaben */}
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-sm font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Aufgaben</div>
              <button onClick={onDownloadExcel} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                <Download size={12} /> Aufgabenliste (Excel)
              </button>
            </div>

            {groupedTasks.length === 0 && <p className="text-xs" style={{ color: INK_SOFT }}>Noch keine Aufgaben angelegt.</p>}

            {groupedTasks.map((group) => (
              <div key={group.bereich} className="mb-3">
                <div className="text-xs font-bold mb-1.5" style={{ color: accent }}>{group.bereich}</div>
                <div className="flex flex-col gap-2">
                  {group.items.map((task) => {
                    const sList = signupsFor(task.id);
                    const isSignedUp = sList.some((s) => s.user_id === userId);
                    const canFinish = canManage || isSignedUp;
                    const doneStyle = task.done
                      ? { backgroundColor: `${GREEN}0D`, borderColor: `${GREEN}55` }
                      : { backgroundColor: "#fff", borderColor: BORDER_SOFT };
                    return (
                      <div key={task.id} className="rounded-lg flex items-stretch overflow-hidden" style={{ border: `1px solid ${doneStyle.borderColor}`, borderLeft: `4px solid ${task.done ? GREEN : BORDER_SOFT}`, backgroundColor: doneStyle.backgroundColor }}>
                        <div className="flex-1 min-w-0 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold">{task.title}</div>
                              {sList.length > 0 && (
                                <div className="text-sm mt-1 font-medium" style={{ color: INK }}>
                                  <span style={{ color: INK_SOFT }}>Helfer: </span>{sList.map((s) => s.user_name).filter(Boolean).join(", ")}
                                </div>
                              )}
                              {task.done && task.done_by_name && (
                                <div className="text-xs mt-1 font-semibold" style={{ color: GREEN }}>Erledigt von {task.done_by_name}</div>
                              )}
                            </div>
                            {canManage && (
                              <button onClick={() => onDeleteTask(task)} className="flex-shrink-0"><Trash2 size={13} style={{ color: "#B8B4A2" }} /></button>
                            )}
                          </div>
                          <button
                            onClick={() => onToggleSignup(task)}
                            className="mt-2 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold"
                            style={isSignedUp
                              ? { backgroundColor: `${PURPLE}1A`, color: PURPLE }
                              : { backgroundColor: PURPLE, color: "#fff" }}
                          >
                            {isSignedUp ? "Nicht mehr mitmachen" : "Ich mache mit"}
                          </button>
                        </div>
                        <button
                          onClick={() => canFinish && onToggleDone(task)}
                          disabled={!canFinish}
                          className="w-[76px] flex-shrink-0 flex flex-col items-center justify-center gap-1 text-sm font-bold"
                          style={{
                            borderLeft: `1px solid ${task.done ? `${GREEN}55` : BORDER_SOFT}`,
                            ...(task.done
                              ? { backgroundColor: GREEN, color: "#fff" }
                              : { backgroundColor: canFinish ? `${GREEN}1A` : "#EEEDE6", color: canFinish ? GREEN : "#B8B4A2" }),
                          }}
                        >
                          {task.done ? <><Check size={18} /> Erledigt</> : "Fertig"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {canManage && (
              <div className="mt-2">
                {!showAddTask ? (
                  <button onClick={() => setShowAddTask(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                    <Plus size={13} /> Aufgabe hinzufügen
                  </button>
                ) : (
                  <div className="rounded-lg p-3" style={{ backgroundColor: "#fff", border: `1px solid ${BORDER_SOFT}` }}>
                    <label className="text-xs font-medium block mb-1">Bereich</label>
                    <select value={newBereichSel} onChange={(e) => setNewBereichSel(e.target.value)} className="w-full rounded-lg px-3 py-2 mb-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
                      <option value="">— vorhandenen Bereich wählen —</option>
                      {bereichOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <input value={newBereichCustom} onChange={(e) => setNewBereichCustom(e.target.value)} placeholder="oder neuer Bereich" className="w-full rounded-lg px-3 py-2 mb-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
                    <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Aufgabe" className="w-full rounded-lg px-3 py-2 mb-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
                    <div className="flex gap-2">
                      <button onClick={submitAddTask} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: BLUE }}>Hinzufügen</button>
                      <button onClick={() => { setShowAddTask(false); setNewTaskTitle(""); setNewBereichCustom(""); setNewBereichSel(""); }} className="px-3 py-2 rounded-lg text-sm" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>Abbrechen</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// =====================================================================
function OverviewTab({ templates, tasks, events, year }) {
  const rows = useMemo(() => {
    const eventYear = {};
    for (const e of events) {
      eventYear[e.id] = e.event_date ? Number(e.event_date.slice(0, 4)) : null;
    }
    const countByTemplate = {};
    for (const t of tasks) {
      if (t.done && t.template_id && eventYear[t.event_id] === year) {
        countByTemplate[t.template_id] = (countByTemplate[t.template_id] || 0) + 1;
      }
    }
    const sorted = templates.slice().sort((a, b) =>
      (a.bereich || "").localeCompare(b.bereich || "") || (a.sort_order - b.sort_order)
    );
    const groups = [];
    const idx = {};
    for (const tpl of sorted) {
      const key = tpl.bereich || "Sonstiges";
      if (!(key in idx)) { idx[key] = groups.length; groups.push({ bereich: key, items: [] }); }
      groups[idx[key]].items.push({ ...tpl, done: countByTemplate[tpl.id] || 0 });
    }
    return groups;
  }, [templates, tasks, events, year]);

  return (
    <div>
      <div className="mb-3">
        <div className="text-sm font-bold" style={{ color: INK }}>Übersicht {year}</div>
        <p className="text-xs mt-0.5" style={{ color: INK_SOFT }}>Wie oft wurde jede Aufgabe in diesem Jahr erledigt.</p>
      </div>
      {rows.length === 0 && (
        <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}>
          <p className="text-sm" style={{ color: INK_SOFT }}>Noch keine Vorlage-Aufgaben angelegt.</p>
        </div>
      )}
      {rows.map((group) => (
        <div key={group.bereich} className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: BLUE }}>{group.bereich}</div>
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER_SOFT}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#E4E1D3" }}>
                  <th className="text-left px-3 py-2 font-semibold">Aufgabe</th>
                  <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">Geplant</th>
                  <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">Erledigt {year}</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((tpl) => (
                  <tr key={tpl.id} style={{ backgroundColor: "#fff", borderTop: `1px solid ${BORDER_SOFT}` }}>
                    <td className="px-3 py-2">{tpl.title}</td>
                    <td className="px-3 py-2 text-center" style={{ color: INK_SOFT }}>{tpl.haeufigkeit || "—"}</td>
                    <td className="px-3 py-2 text-center font-semibold" style={{ color: tpl.done > 0 ? GREEN : INK_SOFT }}>{tpl.done}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// =====================================================================
function InspectionTab({ rows, photosFor, canManage, search, onSearch, onNew, onEdit, onDelete, onUploadPhotos, onDeletePhoto, onOpenPhoto }) {
  return (
    <div>
      <div className="rounded-xl p-3 mb-3 flex items-start gap-2" style={{ backgroundColor: `${BLUE}14`, border: `1px solid ${BLUE}22` }}>
        <ClipboardList size={16} style={{ color: BLUE }} className="mt-0.5 flex-shrink-0" />
        <p className="text-xs" style={{ color: INK_SOFT }}>Wird beim Saubermachtag vom Inspektions-Team gepflegt. Erscheint bei jedem Termin als Aufgabe „Inspektionsgang".</p>
      </div>

      <div className="mb-3 sticky top-[64px] z-20 pb-1" style={{ backgroundColor: PAPER }}>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-lg px-3 py-2 border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
            <Search size={15} style={{ color: INK_SOFT }} />
            <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Suchen…" className="flex-1 text-sm outline-none" style={{ backgroundColor: "transparent" }} />
          </div>
          {canManage && (
            <button onClick={onNew} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-white flex-shrink-0" style={{ backgroundColor: PURPLE }}>
              <Plus size={14} /> Eintrag
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 && (
        <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}>
          <p className="text-sm" style={{ color: INK_SOFT }}>Keine Einträge.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((row) => {
          const photos = photosFor(row.id);
          return (
            <div key={row.id} className="rounded-xl p-4" style={{ backgroundColor: "#fff", border: `1px solid ${BORDER_SOFT}`, borderLeft: `4px solid ${BLUE}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {row.bereich && <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white mb-1" style={{ backgroundColor: BLUE }}>{row.bereich}</span>}
                  {row.beschreibung && <p className="text-sm whitespace-pre-line">{row.beschreibung}</p>}
                  {row.stand && (
                    <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Stand / Maßnahme</span>
                      <p className="text-sm whitespace-pre-line" style={{ color: INK_SOFT }}>{row.stand}</p>
                    </div>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => onEdit(row)}><Pencil size={14} style={{ color: "#B8B4A2" }} /></button>
                    <button onClick={() => onDelete(row)}><Trash2 size={14} style={{ color: "#B8B4A2" }} /></button>
                  </div>
                )}
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                  {photos.map((p) => (
                    <div key={p.id} className="relative group">
                      <button onClick={() => onOpenPhoto(p.url)} className="block w-full">
                        <img src={p.url} alt={p.filename || ""} className="w-full h-20 object-cover rounded-lg" style={{ border: `1px solid ${BORDER_SOFT}` }} />
                      </button>
                      {canManage && (
                        <button onClick={() => onDeletePhoto(p)} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
                          <Trash2 size={11} color="#fff" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canManage && (
                <label className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                  <Camera size={13} /> Fotos hinzufügen
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files || []); if (fs.length) onUploadPhotos(row.id, fs); e.target.value = ""; }} />
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
