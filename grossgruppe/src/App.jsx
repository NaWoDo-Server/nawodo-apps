import React, { useState, useEffect, useMemo } from "react";
import {
  Home, Plus, X, AlertCircle, Loader2, Calendar, User, Users, FileText, Paperclip,
  Trash2, Pencil, ChevronDown, ChevronRight, Check, Archive, Video,
} from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";

const PAPER = "#F1F0EA";
const INK = "#2B2B26";
const INK_SOFT = "#6B6A61";
const BORDER_SOFT = "#D8D5C7";
const BLUE = "#2E86AB";
const PURPLE = "#6C63A6";

// Farbe/Beschriftung je Meeting-Typ: Workshop (blau) vs. Steuerungskreis (lila).
function typeColor(mt) { return mt === "steuerungskreis" ? PURPLE : BLUE; }
function typeLabel(mt) { return mt === "steuerungskreis" ? "Steuerungskreis" : "Workshop"; }
function typeTime(mt) { return mt === "steuerungskreis" ? "20:00–22:00 Uhr" : "10:00–16:00 Uhr"; }

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function fmtDateLong(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d}. ${MONTH_NAMES[m - 1]} ${y}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function uploadAttachment(file) {
  const ext = file.name.split(".").pop();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `workshops/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, filename: file.name };
}

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
    if (session === null) {
      window.location.href = "/";
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("member_permissions")
      .select("allowed")
      .eq("user_id", session.user.id)
      .eq("app_key", "grossgruppe")
      .maybeSingle()
      .then(({ data }) => setAccess(!data || data.allowed !== false))
      .catch(() => setAccess(true));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_enabled_grossgruppe")
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

  return <WorkshopApp session={session} />;
}

function WorkshopApp({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
  const initial = userName.charAt(0).toUpperCase();

  // Popups per ESC-Taste schliessbar machen.
  useEffect(() => {
    function handleEscape(e) {
      if (e.key !== "Escape") return;
      setShowForm(false);
      setShowAccount(false);
      setShowEditProfile(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);
  const [ownMemberId, setOwnMemberId] = useState(null);
  const [ownFotoUrl, setOwnFotoUrl] = useState(null);
  const [ownMember, setOwnMember] = useState(null);
  useEffect(() => {
    supabase.from("members").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setOwnMemberId(data?.id || null);
      setOwnFotoUrl(data?.foto_url || null);
      setOwnMember(data || null);
    });
  }, [user.id]);

  // --- Eigenes Profil bearbeiten (aus dem Konto-Popup heraus erreichbar) ---
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [epVorname, setEpVorname] = useState("");
  const [epNachname, setEpNachname] = useState("");
  const [epSpitzname, setEpSpitzname] = useState("");
  const [epStrasse, setEpStrasse] = useState("");
  const [epHausnummer, setEpHausnummer] = useState("");
  const [epPlz, setEpPlz] = useState("");
  const [epWohnort, setEpWohnort] = useState("");
  const [epWohneinheit, setEpWohneinheit] = useState("");
  const [epEmail, setEpEmail] = useState("");
  const [epError, setEpError] = useState("");
  const [epSaving, setEpSaving] = useState(false);

  function openEditProfile() {
    setEpVorname(ownMember?.vorname || "");
    setEpNachname(ownMember?.nachname || "");
    setEpSpitzname(ownMember?.spitzname || "");
    setEpStrasse(ownMember?.strasse || "");
    setEpHausnummer(ownMember?.hausnummer || "");
    setEpPlz(ownMember?.plz || "");
    setEpWohnort(ownMember?.wohnort || "");
    setEpWohneinheit(ownMember?.wohneinheit || "");
    setEpEmail(ownMember?.email || user.email || "");
    setEpError("");
    setShowEditProfile(true);
  }

  async function syncOwnLoginEmail(newEmail) {
    const resp = await fetch(`${window.__SUPABASE_URL__}/functions/v1/admin-create-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type: "set_email", target_user_id: user.id, email: newEmail }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || "Login-Email konnte nicht mit geändert werden.");
  }

  async function handleSaveEditProfile() {
    setEpError("");
    if (!epVorname.trim()) return setEpError("Bitte einen Vornamen eintragen.");
    if (!epEmail.trim()) return setEpError("Bitte eine E-Mail-Adresse eintragen.");
    const newEmailCheck = epEmail.trim().toLowerCase();
    if ((ownMember?.email || "").toLowerCase() !== newEmailCheck) {
      const { data: dupe } = await supabase.from("members").select("id").ilike("email", newEmailCheck).neq("id", ownMemberId || "00000000-0000-0000-0000-000000000000").maybeSingle();
      if (dupe) return setEpError("Diese E-Mail-Adresse wird bereits von einem anderen Mitglied verwendet.");
    }
    setEpSaving(true);
    try {
      const newEmail = epEmail.trim().toLowerCase();
      const payload = {
        vorname: epVorname.trim(),
        nachname: epNachname.trim(),
        spitzname: epSpitzname.trim() || null,
        strasse: epStrasse.trim() || null,
        hausnummer: epHausnummer.trim() || null,
        plz: epPlz.trim() || null,
        wohnort: epWohnort.trim() || null,
        wohneinheit: epWohneinheit.trim() || null,
        email: newEmail,
      };
      if (ownMemberId) {
        const { error } = await supabase.from("members").update(payload).eq("id", ownMemberId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("members")
          .insert({ user_id: user.id, created_by: user.id, is_child: false, ...payload })
          .select()
          .single();
        if (error) throw error;
        setOwnMemberId(inserted.id);
      }
      const emailChanged = (ownMember?.email || null) !== newEmail;
      if (emailChanged) {
        await syncOwnLoginEmail(newEmail);
      }
      setOwnMember((prev) => ({ ...(prev || {}), ...payload }));
      setShowEditProfile(false);
    } catch (e) {
      setEpError(e.message || "Konnte nicht gespeichert werden.");
    } finally {
      setEpSaving(false);
    }
  }
  const isAdmin = user.user_metadata?.is_admin === true;
  const isSuperAdmin = user.user_metadata?.is_superadmin === true;

  const [myModApps, setMyModApps] = useState([]);
  const isElevated = isAdmin || isSuperAdmin || myModApps.includes("grossgruppe");

  const [workshops, setWorkshops] = useState([]);
  const [termineEventResourceId, setTermineEventResourceId] = useState(null);
  const [gmrResourceId, setGmrResourceId] = useState(null);
  const [termineSyncWarning, setTermineSyncWarning] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [expandedArchiveId, setExpandedArchiveId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState(null);
  const [formDate, setFormDate] = useState(todayStr());
  const [formModeratorUserId, setFormModeratorUserId] = useState("");
  const [formThemenList, setFormThemenList] = useState([{ title: "", info: "" }]);
  const [formAgendaList, setFormAgendaList] = useState([{ time: "", text: "" }]);
  const [formMeetingType, setFormMeetingType] = useState("workshop");
  const [formMode, setFormMode] = useState("praesenz");
  const [formZoomLink, setFormZoomLink] = useState("");
  const [formProtokollUrl, setFormProtokollUrl] = useState("");
  const [formFiles, setFormFiles] = useState([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showAccount, setShowAccount] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [ws, att, food, at, rem, mods, us, cats, res] = await Promise.all([
      supabase.from("workshops").select("*").order("date", { ascending: false }),
      supabase.from("workshop_attachments").select("*"),
      supabase.from("workshop_food_items").select("*").order("created_at"),
      supabase.from("workshop_attendance").select("*"),
      supabase.from("workshop_reminders").select("*").eq("user_id", user.id),
      supabase.from("app_moderators").select("app_key").eq("user_id", user.id),
      supabase.rpc("list_all_users"),
      supabase.from("categories").select("*"),
      supabase.from("resources").select("*"),
    ]);
    setWorkshops(ws.data || []);
    setAttachments(att.data || []);
    setFoodItems(food.data || []);
    setAttendance(at.data || []);
    setReminders(rem.data || []);
    setMyModApps((mods.data || []).map((r) => r.app_key));
    setAllUsers(us.data || []);
    // Fuer die Termine-Verknuepfung: die Buchungs-"Resource" der Termine-App finden
    // (die Kategorie mit event_mode=true, dort die erste/einzige Resource "Termin").
    const eventCat = (cats.data || []).find((c) => c.event_mode);
    const eventRes = eventCat ? (res.data || []).find((r) => r.category_id === eventCat.id) : null;
    setTermineEventResourceId(eventRes?.id || null);
    // Der GMR-Raum wird bei jedem Workshop automatisch mitgebucht.
    const gmrRes = (res.data || []).find((r) => (r.name || "").trim().toLowerCase() === "gmr");
    setGmrResourceId(gmrRes?.id || null);
    setLoading(false);
  }

  // Hauptansicht: ALLE bevorstehenden Meetings (Datum >= heute), das naechste zuerst.
  // Archiv: nur vergangene Meetings (Datum < heute), das juengste zuerst.
  const { upcomingWorkshops, archivedWorkshops } = useMemo(() => {
    const today = todayStr();
    const upcoming = workshops.filter((w) => w.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = workshops.filter((w) => w.date < today).sort((a, b) => b.date.localeCompare(a.date));
    return { upcomingWorkshops: upcoming, archivedWorkshops: past };
  }, [workshops]);

  // Deep-Link von der Termine-App aus (/grossgruppe/?open=<id>): passendes vergangenes
  // Meeting automatisch im Archiv aufklappen (bevorstehende stehen ohnehin oben).
  useEffect(() => {
    if (loading) return;
    const openId = new URLSearchParams(window.location.search).get("open");
    if (!openId) return;
    if (archivedWorkshops.some((w) => w.id === openId)) {
      setShowArchive(true);
      setExpandedArchiveId(openId);
    }
  }, [loading, archivedWorkshops]);

  // Generische Anhaenge (Protokoll ist jetzt ein pCloud-Link, kein Anhang mehr).
  function attachmentsFor(workshopId) { return attachments.filter((a) => a.workshop_id === workshopId); }
  function foodItemsFor(workshopId) { return foodItems.filter((f) => f.workshop_id === workshopId); }
  function attendanceFor(workshopId) { return attendance.filter((a) => a.workshop_id === workshopId); }
  function myAttendance(workshopId) { return attendance.find((a) => a.workshop_id === workshopId && a.user_id === user.id); }
  function myReminderOn(workshopId) { return reminders.some((r) => r.workshop_id === workshopId && r.user_id === user.id); }

  function canManageWorkshop(w) {
    return !!w && (isElevated || w.created_by === user.id);
  }

  function resetForm() {
    setFormDate(todayStr());
    setFormModeratorUserId("");
    setFormThemenList([{ title: "", info: "" }]);
    setFormAgendaList([{ time: "", text: "" }]);
    setFormMeetingType("workshop");
    setFormMode("praesenz");
    setFormZoomLink("");
    setFormProtokollUrl("");
    setFormFiles([]);
    setFormError("");
  }

  function parseThemenPairs(themenStr, infoStr) {
    const titles = (themenStr || "").split("\n").map((s) => s.trim());
    const infos = (infoStr || "").split("\n").map((s) => s.trim());
    const len = Math.max(titles.length, infos.length, 1);
    const pairs = [];
    for (let i = 0; i < len; i++) {
      if (titles[i] || infos[i]) pairs.push({ title: titles[i] || "", info: infos[i] || "" });
    }
    return pairs.length ? pairs : [{ title: "", info: "" }];
  }

  function updateThemenField(index, field, value) {
    setFormThemenList((list) => list.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  function addThemenField() {
    setFormThemenList((list) => [...list, { title: "", info: "" }]);
  }

  function removeThemenField(index) {
    setFormThemenList((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  function parseAgendaPairs(agendaStr, timesStr) {
    const texts = (agendaStr || "").split("\n").map((s) => s.trim());
    const times = (timesStr || "").split("\n").map((s) => s.trim());
    const len = Math.max(texts.length, times.length, 1);
    const pairs = [];
    for (let i = 0; i < len; i++) {
      if (texts[i] || times[i]) pairs.push({ time: times[i] || "", text: texts[i] || "" });
    }
    return pairs.length ? pairs : [{ time: "", text: "" }];
  }

  function updateAgendaField(index, field, value) {
    setFormAgendaList((list) => list.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function addAgendaField() {
    setFormAgendaList((list) => [...list, { time: "", text: "" }]);
  }

  function removeAgendaField(index) {
    setFormAgendaList((list) => (list.length > 1 ? list.filter((_, i) => i !== index) : list));
  }

  function openNewForm() {
    resetForm();
    setEditingWorkshop(null);
    setShowForm(true);
  }

  function openEditForm(w) {
    setEditingWorkshop(w);
    setFormDate(w.date);
    setFormModeratorUserId(w.moderator_user_id || "");
    setFormThemenList(parseThemenPairs(w.themen, w.themen_info));
    setFormAgendaList(parseAgendaPairs(w.agenda, w.agenda_times));
    setFormMeetingType(w.meeting_type || "workshop");
    setFormMode(w.mode || "praesenz");
    setFormZoomLink(w.zoom_link || "");
    setFormProtokollUrl(w.protokoll_url || "");
    setFormFiles([]);
    setFormError("");
    setShowForm(true);
  }

  // Legt fuer das Meeting automatisch einen Termin im Termine-Kalender an bzw.
  // aktualisiert ihn. Zeiten haengen vom Typ ab (Workshop 10-16 Uhr, Steuerungskreis
  // 20-22 Uhr). Der GMR-Raum wird mitgebucht - AUSSER bei einem Zoom-Steuerungskreis,
  // dann entfaellt die Raumbuchung (nur der sichtbare Termin wird angelegt).
  // Ein Fehler hier lässt das Speichern selbst nicht scheitern, wird aber
  // sichtbar gemacht (termineSyncWarning), statt still zu verschwinden.
  async function syncTermineBooking(workshopId, { date, moderatorName, themenTitle, agenda, meetingType, mode }) {
    const isSK = meetingType === "steuerungskreis";
    const typeName = isSK ? "Steuerungskreis" : "Workshop";
    const startTime = isSK ? "20:00" : "10:00";
    const endTime = isSK ? "22:00" : "16:00";
    const title = themenTitle ? `${typeName}: ${themenTitle}` : typeName;
    const skipGmr = isSK && mode === "zoom";
    const targets = [
      { resourceId: termineEventResourceId, label: "Termin" },
      ...(skipGmr ? [] : [{ resourceId: gmrResourceId, label: "GMR" }]),
    ].filter((t) => t.resourceId);

    if (targets.length === 0) {
      const warning = "Konnte nicht im Termine-Kalender eingetragen werden: Termin- oder GMR-Ressource nicht gefunden.";
      setTermineSyncWarning(warning);
      return warning;
    }

    // Falls zuvor (z.B. als Praesenz) der GMR-Raum gebucht war, dieser aber jetzt
    // wegfaellt (Zoom), die alte GMR-Buchung entfernen.
    if (skipGmr && gmrResourceId) {
      try { await supabase.from("bookings").delete().eq("workshop_id", workshopId).eq("resource_id", gmrResourceId); } catch (e) { /* egal */ }
    }

    const problems = [];
    for (const t of targets) {
      const payload = {
        resource_id: t.resourceId,
        date,
        end_date: date,
        all_day: false,
        start_time: startTime,
        end_time: endTime,
        name: moderatorName || typeName,
        title: t.label === "GMR" ? `${title} (GMR)` : title,
        note: null,
        // Online-Hinweis nur am sichtbaren Termin eines Zoom-Steuerungskreises (rot im Kalender).
        online_note: (isSK && mode === "zoom" && t.label === "Termin") ? "Online (Zoom)" : null,
        user_id: user.id,
        workshop_id: workshopId,
      };
      try {
        const { data: existing, error: selErr } = await supabase.from("bookings").select("id").eq("workshop_id", workshopId).eq("resource_id", t.resourceId).maybeSingle();
        if (selErr) throw selErr;
        if (existing) {
          const { error } = await supabase.from("bookings").update(payload).eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("bookings").insert(payload);
          if (error) throw error;
        }
      } catch (e) {
        problems.push(`${t.label}: ${e.message || "unbekannter Fehler"}`);
      }
    }
    const warning = problems.length ? `Termine-Kalender: ${problems.join(" · ")}` : "";
    setTermineSyncWarning(warning);
    return warning;
  }

  async function handleSaveWorkshop() {
    setFormError("");
    if (!formDate) return setFormError("Bitte ein Datum eintragen.");
    setSaving(true);
    try {
      const moderator = allUsers.find((u) => u.id === formModeratorUserId);
      const cleanedThemen = formThemenList
        .map((t) => ({ title: t.title.trim(), info: t.info.trim() }))
        .filter((t) => t.title || t.info);
      const cleanedAgenda = formAgendaList
        .map((a) => ({ time: a.time.trim(), text: a.text.trim() }))
        .filter((a) => a.time || a.text);
      const isSK = formMeetingType === "steuerungskreis";
      const payload = {
        date: formDate,
        moderator_user_id: formModeratorUserId || null,
        moderator_name: moderator?.name || null,
        themen: cleanedThemen.length ? cleanedThemen.map((t) => t.title).join("\n") : null,
        themen_info: cleanedThemen.length ? cleanedThemen.map((t) => t.info).join("\n") : null,
        agenda: cleanedAgenda.length ? cleanedAgenda.map((a) => a.text).join("\n") : null,
        agenda_times: cleanedAgenda.length ? cleanedAgenda.map((a) => a.time).join("\n") : null,
        meeting_type: formMeetingType,
        mode: isSK ? formMode : null,
        zoom_link: isSK && formMode === "zoom" ? (formZoomLink.trim() || null) : null,
        protokoll_url: formProtokollUrl.trim() || null,
      };

      let workshopId = editingWorkshop?.id;
      if (editingWorkshop) {
        const { error } = await supabase.from("workshops").update(payload).eq("id", editingWorkshop.id);
        if (error) throw error;
      } else {
        payload.created_by = user.id;
        payload.created_by_name = userName;
        const { data, error } = await supabase.from("workshops").insert(payload).select().single();
        if (error) throw error;
        workshopId = data.id;
      }

      for (const file of formFiles) {
        const { url, filename } = await uploadAttachment(file);
        await supabase.from("workshop_attachments").insert({ workshop_id: workshopId, url, filename, created_by: user.id });
      }

      const syncWarning = await syncTermineBooking(workshopId, { date: formDate, moderatorName: moderator?.name || null, themenTitle: cleanedThemen[0]?.title || "", agenda: payload.agenda, meetingType: formMeetingType, mode: payload.mode });

      setShowForm(false);
      setEditingWorkshop(null);
      await loadAll();
      if (syncWarning) alert(syncWarning);
    } catch (e) {
      setFormError(e.message || "Speichern hat nicht geklappt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWorkshop(w) {
    if (!window.confirm(`Workshop vom ${fmtDateLong(w.date)} wirklich löschen? Essens-Zusagen, Teilnahme und Anhänge gehen dabei mit verloren. Das kann nicht rückgängig gemacht werden.`)) return;
    try {
      await supabase.from("workshops").delete().eq("id", w.id);
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht gelöscht werden.");
    }
  }

  async function handleDeleteAttachment(a) {
    if (!window.confirm(`"${a.filename}" wirklich entfernen?`)) return;
    try {
      await supabase.from("workshop_attachments").delete().eq("id", a.id);
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht entfernt werden.");
    }
  }

  async function handleAddFoodItem(workshopId, text) {
    if (!text.trim()) return;
    try {
      await supabase.from("workshop_food_items").insert({
        workshop_id: workshopId, item: text.trim(), created_by: user.id, created_by_name: userName,
      });
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht hinzugefügt werden.");
    }
  }

  async function handleDeleteFoodItem(id) {
    try {
      await supabase.from("workshop_food_items").delete().eq("id", id);
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht entfernt werden.");
    }
  }

  async function handleSetAttendance(workshopId, attending) {
    try {
      const existing = myAttendance(workshopId);
      if (existing) {
        await supabase.from("workshop_attendance").update({ attending }).eq("workshop_id", workshopId).eq("user_id", user.id);
      } else {
        await supabase.from("workshop_attendance").insert({ workshop_id: workshopId, user_id: user.id, user_name: userName, attending });
      }
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht gespeichert werden.");
    }
  }

  // E-Mail-Erinnerung 1 Tag vorher: pro Nutzer nur ein Opt-in-Flag. Optimistisch wie
  // die Teilnahme - der tatsaechliche Versand ist ein separater, geplanter Job.
  async function handleToggleReminder(workshopId, on) {
    setReminders((prev) => on
      ? (prev.some((r) => r.workshop_id === workshopId && r.user_id === user.id) ? prev : [...prev, { workshop_id: workshopId, user_id: user.id }])
      : prev.filter((r) => !(r.workshop_id === workshopId && r.user_id === user.id)));
    try {
      if (on) {
        await supabase.from("workshop_reminders").insert({ workshop_id: workshopId, user_id: user.id });
      } else {
        await supabase.from("workshop_reminders").delete().eq("workshop_id", workshopId).eq("user_id", user.id);
      }
    } catch (e) {
      alert(e.message || "Konnte nicht gespeichert werden.");
      await loadAll();
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

  async function handleAvatarUpload(file) {
    setAvatarError("");
    setUploadingAvatar(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `mitglied-foto/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (ownMemberId) {
        const { error } = await supabase.from("members").update({ foto_url: data.publicUrl }).eq("id", ownMemberId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("members")
          .insert({ user_id: user.id, created_by: user.id, is_child: false, vorname: userName, nachname: "", foto_url: data.publicUrl })
          .select()
          .single();
        if (error) throw error;
        setOwnMemberId(inserted.id);
      }
      setOwnFotoUrl(data.publicUrl);
    } catch (e) {
      setAvatarError(e.message || "Foto konnte nicht hochgeladen werden.");
    } finally {
      setUploadingAvatar(false);
    }
  }

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
        <div className="mb-5 sticky top-0 z-30 pb-2" style={{ backgroundColor: PAPER }}>
          <div className="flex items-center justify-end gap-2">
            <span className="text-xs lg:text-sm font-bold truncate max-w-[110px] lg:max-w-[180px]" style={{ color: INK_SOFT }}>Hallo {ownMember?.spitzname || ownMember?.vorname || userName}</span>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>{ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}</button>
            <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
          </div>
          <a href="/" className="flex items-center gap-2.5 mt-2">
            <img src="/grossgruppe/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
            <h1 className="font-bold text-lg lg:text-2xl">Großgruppe</h1>
          </a>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              onClick={openNewForm}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: "#6C63A6" }}
            >
              <Plus size={14} /> Neues Meeting
            </button>
            <button
              onClick={() => setShowArchive((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
            >
              <Archive size={12} /> {showArchive ? "Archiv ausblenden" : `Archiv (${archivedWorkshops.length})`}
            </button>
          </div>
        </div>

        {upcomingWorkshops.length === 0 && (
          <div className="text-center py-10 rounded-xl mb-4" style={{ backgroundColor: "#E9E6D9" }}>
            <p className="text-sm" style={{ color: INK_SOFT }}>Kein bevorstehendes Meeting angelegt.</p>
          </div>
        )}

        {upcomingWorkshops.length > 0 && (
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: INK_SOFT }}>Bevorstehende Meetings</div>
            <div className="flex flex-col gap-4">
              {upcomingWorkshops.map((w, idx) => (
                <WorkshopCard
                  key={w.id}
                  w={w}
                  highlighted={idx === 0}
                  attachmentsList={attachmentsFor(w.id)}
                  foodList={foodItemsFor(w.id)}
                  attendanceList={attendanceFor(w.id)}
                  myAttendanceRow={myAttendance(w.id)}
                  reminderOn={myReminderOn(w.id)}
                  canManage={canManageWorkshop(w)}
                  userId={user.id}
                  onEdit={() => openEditForm(w)}
                  onDelete={() => handleDeleteWorkshop(w)}
                  onDeleteAttachment={handleDeleteAttachment}
                  onAddFood={(text) => handleAddFoodItem(w.id, text)}
                  onDeleteFood={handleDeleteFoodItem}
                  onSetAttendance={(v) => handleSetAttendance(w.id, v)}
                  onToggleReminder={(on) => handleToggleReminder(w.id, on)}
                />
              ))}
            </div>
          </div>
        )}

        {showArchive && (
          <div>
            {archivedWorkshops.length === 0 ? (
              <p className="text-xs" style={{ color: INK_SOFT }}>Keine vergangenen Meetings.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {archivedWorkshops.map((w) => {
                  const isExpanded = expandedArchiveId === w.id;
                  return (
                    <div key={w.id}>
                      {isExpanded ? (
                        <WorkshopCard
                          w={w}
                          attachmentsList={attachmentsFor(w.id)}
                          foodList={foodItemsFor(w.id)}
                          attendanceList={attendanceFor(w.id)}
                          myAttendanceRow={myAttendance(w.id)}
                          reminderOn={myReminderOn(w.id)}
                          canManage={canManageWorkshop(w)}
                          userId={user.id}
                          onCollapse={() => setExpandedArchiveId(null)}
                          onEdit={() => openEditForm(w)}
                          onDelete={() => handleDeleteWorkshop(w)}
                          onDeleteAttachment={handleDeleteAttachment}
                          onAddFood={(text) => handleAddFoodItem(w.id, text)}
                          onDeleteFood={handleDeleteFoodItem}
                          onSetAttendance={(v) => handleSetAttendance(w.id, v)}
                          onToggleReminder={(on) => handleToggleReminder(w.id, on)}
                        />
                      ) : (
                        <button
                          onClick={() => setExpandedArchiveId(w.id)}
                          className="w-full text-left rounded-xl p-3.5 flex items-center justify-between"
                          style={{ backgroundColor: `${typeColor(w.meeting_type)}14`, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderLeft: `3px solid ${typeColor(w.meeting_type)}` }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full text-white flex-shrink-0" style={{ backgroundColor: typeColor(w.meeting_type) }}>{typeLabel(w.meeting_type)}</span>
                              <span className="font-semibold text-sm">{fmtDateLong(w.date)}</span>
                            </div>
                            {w.themen && <div className="text-xs truncate mt-0.5" style={{ color: INK_SOFT }}>{w.themen}</div>}
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
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowForm(false); } }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[85dvh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editingWorkshop ? "Meeting bearbeiten" : "Neues Meeting"}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <label className="text-xs font-medium block mb-1">Art</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { key: "workshop", label: "Workshop", time: "10:00–16:00 Uhr" },
                { key: "steuerungskreis", label: "Steuerungskreis", time: "20:00–22:00 Uhr" },
              ].map((opt) => {
                const active = formMeetingType === opt.key;
                const c = typeColor(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFormMeetingType(opt.key)}
                    className="rounded-lg px-3 py-2.5 text-sm font-semibold text-left border"
                    style={{ borderColor: active ? c : BORDER_SOFT, backgroundColor: active ? `${c}1A` : "#fff", color: active ? c : INK }}
                  >
                    <div>{opt.label}</div>
                    <div className="text-xs font-normal" style={{ color: INK_SOFT }}>{opt.time}</div>
                  </button>
                );
              })}
            </div>

            {formMeetingType === "steuerungskreis" && (
              <>
                <label className="text-xs font-medium block mb-1">Format</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { key: "praesenz", label: "Präsenz" },
                    { key: "zoom", label: "Zoom" },
                  ].map((opt) => {
                    const active = formMode === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setFormMode(opt.key)}
                        className="rounded-lg px-3 py-2.5 text-sm font-semibold border"
                        style={{ borderColor: active ? PURPLE : BORDER_SOFT, backgroundColor: active ? `${PURPLE}1A` : "#fff", color: active ? PURPLE : INK }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {formMode === "zoom" && (
                  <>
                    <label className="text-xs font-medium block mb-1">Zoom-Link / Einladung</label>
                    <input value={formZoomLink} onChange={(e) => setFormZoomLink(e.target.value)} placeholder="https://zoom.us/j/…" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
                  </>
                )}
              </>
            )}

            <label className="text-xs font-medium block mb-1">Datum</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Moderator/in</label>
            <select value={formModeratorUserId} onChange={(e) => setFormModeratorUserId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
              <option value="">Noch offen</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>

            <label className="text-xs font-medium block mb-1">Themen</label>
            <div className="flex flex-col gap-2 mb-3">
              {formThemenList.map((t, i) => (
                <div key={i} className="rounded-lg p-2.5" style={{ border: `1px solid ${BORDER_SOFT}` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <input
                      value={t.title}
                      onChange={(e) => updateThemenField(i, "title", e.target.value)}
                      placeholder={`Thema ${i + 1}`}
                      className="flex-1 rounded-lg px-3 py-2 text-sm border"
                      style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
                    />
                    {formThemenList.length > 1 && (
                      <button type="button" onClick={() => removeThemenField(i)}><X size={16} style={{ color: INK_SOFT }} /></button>
                    )}
                  </div>
                  <textarea
                    value={t.info}
                    onChange={(e) => updateThemenField(i, "info", e.target.value)}
                    rows={2}
                    placeholder="Info dazu (optional)"
                    className="w-full rounded-lg px-3 py-2 text-sm border"
                    style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addThemenField}
                className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
              >
                <Plus size={13} /> Weiteres Thema
              </button>
            </div>

            <label className="text-xs font-medium block mb-1">Agenda</label>
            <div className="flex flex-col gap-2 mb-3">
              {formAgendaList.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={a.time}
                    onChange={(e) => updateAgendaField(i, "time", e.target.value)}
                    className="rounded-lg px-2.5 py-2 text-sm border flex-shrink-0"
                    style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
                  />
                  <input
                    value={a.text}
                    onChange={(e) => updateAgendaField(i, "text", e.target.value)}
                    placeholder={`Punkt ${i + 1}`}
                    className="flex-1 rounded-lg px-3 py-2 text-sm border"
                    style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
                  />
                  {formAgendaList.length > 1 && (
                    <button type="button" onClick={() => removeAgendaField(i)}><X size={16} style={{ color: INK_SOFT }} /></button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addAgendaField}
                className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
              >
                <Plus size={13} /> Punkt hinzufügen
              </button>
            </div>

            <label className="text-xs font-medium block mb-1">Protokoll-Link (pCloud)</label>
            <input value={formProtokollUrl} onChange={(e) => setFormProtokollUrl(e.target.value)} placeholder="https://…" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Anhänge (optional)</label>
            <input type="file" multiple onChange={(e) => setFormFiles(Array.from(e.target.files || []))} className="w-full text-sm mb-3" />

            {formError &&<div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}</div>}

            <button
              onClick={handleSaveWorkshop}
              disabled={saving}
              className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: BLUE, opacity: saving ? 0.7 : 1 }}
            >
              {saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      )}

      {showAccount && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowAccount(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[85dvh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Konto</h2><button onClick={() => setShowAccount(false)}><X size={20} /></button></div>
            <div className="flex items-center gap-3 mb-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
              <div className="relative flex-shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white overflow-hidden" style={{ backgroundColor: INK }}>
                  {ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}
                </div>
                <label className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer" style={{ backgroundColor: INK, border: "2px solid #E4E1D3" }}>
                  <Pencil size={10} color="#fff" />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleAvatarUpload(e.target.files[0])} />
                </label>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{userName}{isAdmin ? " · Admin" : ""}</div>
                <div className="text-xs truncate" style={{ color: INK_SOFT }}>{user.email}</div>
                {uploadingAvatar && <div className="text-xs mt-0.5" style={{ color: INK_SOFT }}>Wird hochgeladen…</div>}
                {avatarError && <div className="text-xs mt-0.5" style={{ color: "#A13D3D" }}>{avatarError}</div>}
              </div>
            </div>
            <button onClick={() => { setShowAccount(false); openEditProfile(); }} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold flex items-center justify-center gap-2" style={{ border: "1.5px solid #D8D5C7", color: INK }}>
              <Pencil size={14} /> Eintrag bearbeiten
            </button>

            <label className="text-xs font-medium block mb-1">Passwort ändern</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Neues Passwort" className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            <input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} placeholder="Neues Passwort wiederholen" className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            {passwordError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{passwordError}</p>}
            {passwordSuccess && <p className="text-xs mb-2" style={{ color: "#2E7D4F" }}>Passwort geändert!</p>}
            <button onClick={handleChangePassword} disabled={savingPassword} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: INK, opacity: savingPassword ? 0.7 : 1 }}>
              {savingPassword && <Loader2 size={15} className="animate-spin" />} {savingPassword ? "Speichern…" : "Passwort speichern"}
            </button>
            <button onClick={handleLogout} className="w-full rounded-lg py-2.5 text-sm border" style={{ borderColor: "#E0B8B8", color: "#A13D3D" }}>Abmelden</button>
          </div>
        </div>
      )}

      {showEditProfile && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowEditProfile(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[85dvh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Eintrag bearbeiten</h2><button onClick={() => setShowEditProfile(false)}><X size={20} /></button></div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium block mb-1">Vorname</label>
                <input value={epVorname} onChange={(e) => setEpVorname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Nachname</label>
                <input value={epNachname} onChange={(e) => setEpNachname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
            </div>

            <label className="text-xs font-medium block mb-1">Spitzname</label>
            <input value={epSpitzname} onChange={(e) => setEpSpitzname(e.target.value)} placeholder="optional" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium block mb-1">Straße</label>
                <input value={epStrasse} onChange={(e) => setEpStrasse(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Hausnummer</label>
                <input value={epHausnummer} onChange={(e) => setEpHausnummer(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium block mb-1">PLZ</label>
                <input value={epPlz} onChange={(e) => setEpPlz(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Ort</label>
                <input value={epWohnort} onChange={(e) => setEpWohnort(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
            </div>

            <label className="text-xs font-medium block mb-1">Wohneinheit</label>
            <input value={epWohneinheit} onChange={(e) => setEpWohneinheit(e.target.value)} placeholder="z.B. WE 12" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Login-Email</label>
            <input type="email" value={epEmail} onChange={(e) => setEpEmail(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            {epError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{epError}</p>}
            <button onClick={handleSaveEditProfile} disabled={epSaving} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: INK, opacity: epSaving ? 0.7 : 1 }}>
              {epSaving && <Loader2 size={15} className="animate-spin" />} {epSaving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemenList({ themen, themenInfo }) {
  const items = useMemo(() => {
    const titles = (themen || "").split("\n").map((s) => s.trim()).filter(Boolean);
    const infos = (themenInfo || "").split("\n").map((s) => s.trim());
    return titles.map((title, i) => ({ title, info: infos[i] || "" }));
  }, [themen, themenInfo]);

  const [openIndex, setOpenIndex] = useState(null);

  if (items.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: INK_SOFT }}>Themen</div>
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div key={i} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER_SOFT}` }}>
              <button
                onClick={() => item.info && setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
                style={{ cursor: item.info ? "pointer" : "default" }}
              >
                <span className="text-base font-medium">{item.title}</span>
                {item.info && (
                  isOpen
                    ? <ChevronDown size={14} className="flex-shrink-0" style={{ color: INK_SOFT }} />
                    : <ChevronRight size={14} className="flex-shrink-0" style={{ color: INK_SOFT }} />
                )}
              </button>
              {isOpen && item.info && (
                <p className="text-base whitespace-pre-wrap px-3 pb-2.5" style={{ color: INK_SOFT }}>{item.info}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaList({ agenda, agendaTimes }) {
  const items = useMemo(() => {
    const texts = (agenda || "").split("\n").map((s) => s.trim());
    const times = (agendaTimes || "").split("\n").map((s) => s.trim());
    const len = Math.max(texts.length, times.length);
    const out = [];
    for (let i = 0; i < len; i++) {
      if (texts[i] || times[i]) out.push({ time: times[i] || "", text: texts[i] || "" });
    }
    return out;
  }, [agenda, agendaTimes]);

  if (items.length === 0) return null;

  return (
    <div className="mb-3">
      <div className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: INK_SOFT }}>Agenda</div>
      <div className="flex flex-col gap-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-baseline gap-2 text-base">
            {item.time && <span className="font-semibold flex-shrink-0" style={{ color: INK_SOFT }}>{item.time}</span>}
            {item.time && item.text && <span className="flex-shrink-0" style={{ color: INK_SOFT }}>—</span>}
            {item.text && <span>{item.text}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkshopCard({
  w, highlighted, attachmentsList, foodList, attendanceList, myAttendanceRow, reminderOn, canManage, userId,
  onCollapse, onEdit, onDelete, onDeleteAttachment, onAddFood, onDeleteFood, onSetAttendance, onToggleReminder,
}) {
  const [newFoodText, setNewFoodText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const isSK = w.meeting_type === "steuerungskreis";
  const accent = typeColor(w.meeting_type);
  const yesCount = attendanceList.filter((a) => a.attending).length;
  const noCount = attendanceList.filter((a) => a.attending === false).length;
  const yesNames = attendanceList.filter((a) => a.attending).map((a) => a.user_name);

  return (
    <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: expanded ? "#fff" : `${accent}0D`, boxShadow: highlighted ? "0 2px 8px rgba(0,0,0,0.10)" : "0 1px 3px rgba(0,0,0,0.08)", border: highlighted ? `1.5px solid ${accent}33` : `1px solid ${accent}1A`, borderLeft: `4px solid ${accent}` }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: accent }}>{typeLabel(w.meeting_type)}</span>
          </div>
          <div onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1.5 font-bold text-base cursor-pointer select-none"><Calendar size={15} style={{ color: accent }} /> {fmtDateLong(w.date)}</div>
          <div className="text-sm mt-0.5" style={{ color: INK_SOFT }}>{typeTime(w.meeting_type)}</div>
          {w.moderator_name && <div className="text-base mt-0.5" style={{ color: INK_SOFT }}>Moderator/in: {w.moderator_name}</div>}
          {isSK && w.mode === "zoom" && w.zoom_link && (
            <a href={w.zoom_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 mt-1.5 text-sm font-semibold underline" style={{ color: accent }}>
              <Video size={14} /> Zoom-Meeting beitreten
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canManage && (
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

      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 flex items-center gap-1 text-xs font-semibold"
        style={{ color: accent }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {expanded ? "Weniger anzeigen" : "Mehr anzeigen"}
      </button>

      {expanded && (
      <>
      <ThemenList themen={w.themen} themenInfo={w.themen_info} />

      <AgendaList agenda={w.agenda} agendaTimes={w.agenda_times} />

      {attachmentsList.length > 0 && (
        <div className="mb-3">
          <div className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Anhänge</div>
          <div className="flex flex-col gap-1">
            {attachmentsList.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <Paperclip size={13} style={{ color: INK_SOFT }} />
                <a href={a.url} target="_blank" rel="noreferrer" className="underline flex-1 truncate" style={{ color: BLUE }}>{a.filename}</a>
                {(canManage || a.created_by === userId) && (
                  <button onClick={() => onDeleteAttachment(a)}><Trash2 size={12} style={{ color: "#B8B4A2" }} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {w.protokoll_url && (
        <div className="mb-3">
          <div className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Protokoll</div>
          <a href={w.protokoll_url} target="_blank" rel="noreferrer" title="Protokoll" aria-label="Protokoll" className="inline-flex items-center gap-1.5 text-sm font-semibold underline" style={{ color: accent }}>
            <FileText size={16} /> Protokoll
          </a>
        </div>
      )}

      {!isSK && (
        <div className="mb-3 pt-3" style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
          <div className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: INK_SOFT }}>Wer bringt was mit?</div>
          <div className="flex flex-col gap-1 mb-2">
            {foodList.length === 0 && <p className="text-xs" style={{ color: INK_SOFT }}>Noch nichts eingetragen.</p>}
            {foodList.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{f.item}</span>
                <span className="text-xs" style={{ color: INK_SOFT }}>{f.created_by_name}</span>
                {(canManage || f.created_by === userId) && (
                  <button onClick={() => onDeleteFood(f.id)}><Trash2 size={12} style={{ color: "#B8B4A2" }} /></button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newFoodText}
              onChange={(e) => setNewFoodText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newFoodText.trim()) { onAddFood(newFoodText); setNewFoodText(""); } }}
              placeholder="z.B. Kartoffelsalat"
              className="flex-1 rounded-lg px-3 py-2 text-sm border"
              style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
            />
            <button
              onClick={() => { if (newFoodText.trim()) { onAddFood(newFoodText); setNewFoodText(""); } }}
              className="px-3 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: INK }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="pt-3" style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-sm font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Teilnahme</div>
          <div className="text-xs" style={{ color: INK_SOFT }}>{yesCount} {yesCount === 1 ? "Zusage" : "Zusagen"}</div>
        </div>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => onSetAttendance(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: myAttendanceRow?.attending === true ? "#2E7D4F" : "#2E7D4F1A", color: myAttendanceRow?.attending === true ? "#fff" : "#2E7D4F" }}
          >
            <Check size={14} /> Ich komme ({yesCount})
          </button>
          <button
            onClick={() => onSetAttendance(false)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: myAttendanceRow?.attending === false ? "#A13D3D" : "#A13D3D1A", color: myAttendanceRow?.attending === false ? "#fff" : "#A13D3D" }}
          >
            <X size={14} /> Ich komme nicht ({noCount})
          </button>
        </div>
        {yesNames.length > 0 && (
          <p className="text-xs" style={{ color: INK_SOFT }}>{yesNames.join(", ")}</p>
        )}
        <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            checked={!!reminderOn}
            onChange={(e) => onToggleReminder(e.target.checked)}
            className="w-4 h-4 flex-shrink-0"
            style={{ accentColor: BLUE }}
          />
          <span style={{ color: INK_SOFT }}>E-Mail-Erinnerung 1 Tag vorher</span>
        </label>
      </div>
      </>
      )}
    </div>
  );
}
