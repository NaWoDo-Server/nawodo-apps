import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Zap, Home, Package, Plus, Trash2, ChevronLeft, ChevronRight, ChevronDown, X, AlertCircle, Loader2,
  Image as ImageIcon, Pencil, Check, CalendarDays,
} from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";
import { ICONS, ICON_KEYS } from "./icons";
import { PAPER, INK, INK_SOFT, BORDER, BORDER_SOFT, FILTER_KEY } from "./theme";
import {
  fmtDate, addDays, toMinutes, bookingEndDate, bookingCoversDate,
  bookingRangeMs, rangeOverlapsMs, spanSegmentStyle,
  startOfWeek, addWeeks, rangeLabel, firstOfMonth, addMonths,
  monthLabel, monthGrid, shadeForIndex,
} from "./calendarUtils";
import { useIsDesktop } from "./useIsDesktop";
import CategorySidebar from "./CategorySidebar";
import MiniMonthCalendar from "./MiniMonthCalendar";
import DesktopMonthGrid from "./DesktopMonthGrid";
import DesktopWeekGrid from "./DesktopWeekGrid";
import BookingDialog from "./BookingDialog";
import DayAgenda from "./DayAgenda";

// "sharing": alle Reiter außer Termine sind buchbar/bearbeitbar, Termine nur sichtbar.
// "termine": nur der Termine-Reiter ist buchbar/bearbeitbar, alle anderen nur sichtbar.
// Beide Apps teilen sich dieselbe Datenbank (Kategorien/Ressourcen/Buchungen), sehen sich
// also gegenseitig, sind aber getrennt nutzbar. Für die Termine-App: hier auf "termine" ändern.
const APP_MODE = "sharing";
// Sharing und Termine laufen unter derselben Domain (nur andere Pfade), teilen sich
// also denselben localStorage – daher eigener Schlüssel pro App-Modus.
const APP_FILTER_KEY = `${FILTER_KEY}_${APP_MODE}`;

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
  const [access, setAccess] = useState(undefined); // undefined = wird geprueft, true/false = Zugriff erlaubt/gesperrt
  const [appEnabled, setAppEnabled] = useState(undefined); // undefined = wird geprueft, false = App suite-weit deaktiviert

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Kein Login vorhanden: zurueck zur Hauptseite, dort ist jetzt der Login.
    if (session === null) {
      window.location.href = "/";
    }
  }, [session]);

  useEffect(() => {
    // App-Berechtigung pruefen: fehlt eine Zeile, ist der Zugriff erlaubt (bestehende Mitglieder
    // sind unveraendert), nur ein explizites allowed=false sperrt die App.
    if (!session) return;
    supabase
      .from("member_permissions")
      .select("allowed")
      .eq("user_id", session.user.id)
      .eq("app_key", "sharing")
      .maybeSingle()
      .then(({ data }) => setAccess(!data || data.allowed !== false))
      .catch(() => setAccess(true));
  }, [session]);

  useEffect(() => {
    // Suite-weiter Ein/Aus-Schalter (app_settings.app_enabled_sharing), fehlt die Zeile ist die App an.
    if (!session) return;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_enabled_sharing")
      .maybeSingle()
      .then(({ data }) => setAppEnabled(!data || data.value !== false))
      .catch(() => setAppEnabled(true));
  }, [session]);

  if (session === undefined || session === null || access === undefined || appEnabled === undefined) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={28} style={{ color: INK_SOFT }} /></div>;
  }

  if (appEnabled === false && session.user.user_metadata?.is_superadmin !== true) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}>
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
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}>
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-3" size={28} style={{ color: "#A13D3D" }} />
          <p className="font-semibold mb-1">Kein Zugriff</p>
          <p className="text-sm mb-4" style={{ color: INK_SOFT }}>Für diese App wurde dir noch kein Zugriff freigeschaltet.</p>
          <a href="/" className="text-sm font-semibold" style={{ color: INK }}>Zurück zur Startseite</a>
        </div>
      </div>
    );
  }

  return <Hofteiler session={session} />;
}

function Hofteiler({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
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
    setEpSaving(true);
    try {
      const newEmail = epEmail.trim().toLowerCase();
      const payload = {
        vorname: epVorname.trim(),
        nachname: epNachname.trim(),
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
  const initial = userName.charAt(0).toUpperCase();

  // Popups per ESC-Taste schliessbar machen.
  useEffect(() => {
    function handleEscape(e) {
      if (e.key !== "Escape") return;
      setShowResourceForm(false);
      setShowEditResourceForm(false);
      setShowSettings(false);
      setShowEditProfile(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);
  const isAdmin = user.user_metadata?.is_admin === true;
  const isSuperAdmin = user.user_metadata?.is_superadmin === true;
  const [myModApps, setMyModApps] = useState([]);
  useEffect(() => {
    supabase.from("app_moderators").select("app_key").eq("user_id", user.id).then(({ data }) => {
      setMyModApps((data || []).map((r) => r.app_key));
    });
  }, [user.id]);
  // Moderator fuer "sharing" ODER "termine" hat hier dieselben Rechte wie ein globaler Admin,
  // weil Kategorien/Artikel zwischen beiden Apps geteilt werden.
  const isElevated = isAdmin || isSuperAdmin || myModApps.includes("sharing") || myModApps.includes("termine");

  // Admins koennen eine Buchung fuer ein anderes Mitglied anlegen/umtragen.
  // Liste wird nur fuer Admins geladen (RPC prueft das serverseitig zusaetzlich ab).
  const [members, setMembers] = useState([{ id: user.id, name: userName }]);
  const [bookingUserId, setBookingUserId] = useState(user.id);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.rpc("list_members").then(({ data, error }) => {
      if (!error && data) setMembers(data);
    });
  }, [isAdmin]);

  const [categories, setCategories] = useState([]);
  const [resources, setResources] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeCategoryIds, setActiveCategoryIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(APP_FILTER_KEY)) || null; } catch { return null; }
  });
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()));
  const [viewMode, setViewMode] = useState("month");
  const [calendarMonth, setCalendarMonth] = useState(firstOfMonth(fmtDate(new Date())));
  const [calendarWeekStart, setCalendarWeekStart] = useState(startOfWeek(fmtDate(new Date())));
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [showEditResourceForm, setShowEditResourceForm] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingResPhoto, setUploadingResPhoto] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [formRoomId, setFormRoomId] = useState(null);
  const [formBlockZoe, setFormBlockZoe] = useState(false);

  const [formTitle, setFormTitle] = useState("");
  const [formStart, setFormStart] = useState("08:00");
  const [formEnd, setFormEnd] = useState("10:00");
  const [formNote, setFormNote] = useState("");
  const [formAllDay, setFormAllDay] = useState(false);
  const [formStartDate, setFormStartDate] = useState(fmtDate(new Date()));
  const [formEndDate, setFormEndDate] = useState(fmtDate(new Date()));

  // Desktop-Kalender: eigener Buchungsdialog mit Reiter-/Artikel-Auswahl,
  // eigener Monat/Woche-Umschalter, unabhängig von der mobilen Tag/Woche/Monat-Ansicht.
  const isDesktop = useIsDesktop();
  const [desktopViewMode, setDesktopViewMode] = useState("month");
  const [desktopDialogOpen, setDesktopDialogOpen] = useState(false);
  const [dialogCategoryId, setDialogCategoryId] = useState(null);
  const [dialogResourceId, setDialogResourceId] = useState(null);
  const [editingBookingId, setEditingBookingId] = useState(null);
  const [showMobileNav, setShowMobileNav] = useState(false);

  const [newResName, setNewResName] = useState("");
  const [newResIcon, setNewResIcon] = useState("zap");
  const [newResCategoryId, setNewResCategoryId] = useState("");
  const [newResPhoto, setNewResPhoto] = useState(null);

  const [manageCategories, setManageCategories] = useState(false);
  const [catRenameId, setCatRenameId] = useState(null);
  const [catRenameName, setCatRenameName] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  const [editResName, setEditResName] = useState("");
  const [editResIcon, setEditResIcon] = useState("zap");
  const [editResCategoryId, setEditResCategoryId] = useState("");
  const [editResPhoto, setEditResPhoto] = useState(null);

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
  const roomCategory = categories.find((c) => c.name === "Raumbuchung");
  const roomResources = roomCategory ? resources.filter((r) => r.category_id === roomCategory.id) : [];
  // Ausnahme: Raumbuchung bleibt in BEIDEN Apps buchbar (Räume werden oft zusammen mit
  // Terminen gebraucht), alle anderen Sharing-Reiter nur in der Sharing-App.
  const isRoom = (resource) => !!(roomCategory && resource?.category_id === roomCategory.id);
  // Reiter, die in DIESER App tatsächlich buchbar sind (die jeweils andere Kategorie
  // bleibt sichtbar/filterbar, ist hier aber nur zum Ansehen da).
  const pickableCategories = APP_MODE === "termine"
    ? categories.filter((c) => roomCategory && c.id === roomCategory.id)
    : categories.filter((c) => !c.event_mode);
  // Wird nur an den BookingDialog übergeben, um den Termine-Reiter dort ein-/auszublenden.
  // Alle anderen Übergaben von eventCategory (an die Kalender-Grids/DayAgenda) bleiben
  // unverändert, da Termine weiterhin überall SICHTBAR sein sollen.
  const dialogEventCategory = APP_MODE === "termine" ? eventCategory : null;
  // Bestimmt pro Buchung, ob sie in DIESER App bearbeitet/gelöscht werden darf.
  function isManageable(resource) {
    if (!resource) return true;
    const isEvent = !!(eventCategory && resource.category_id === eventCategory.id);
    return APP_MODE === "termine" ? (isEvent || isRoom(resource)) : !isEvent;
  }
  // Reihenfolge/Gruppierung für die Reiter-Liste: in der Termine-App stehen Termine
  // und Raumbuchung oben (beide dort buchbar), alle anderen (nur zum Ansehen) sind
  // unter "Sharing" eingeklappt.
  const primaryCategoryIds = APP_MODE === "termine" && eventCategory
    ? [eventCategory.id, ...(roomCategory ? [roomCategory.id] : [])]
    : null;
  const groupCategoryIds = APP_MODE === "termine"
    ? categories.filter((c) => c.id !== eventCategory?.id && c.id !== roomCategory?.id).map((c) => c.id)
    : null;
  const zoeResource = resources.find((r) => r.name === "Zoe");
  const isWallboxResource = (r) => r?.name === "Wallbox 1" || r?.name === "Wallbox 2";

  const loadAll = useCallback(async (isFirst = false) => {
    try {
      const [cats, res, bks] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order").then((r) => r.data || []),
        supabase.from("resources").select("*").order("created_at").then((r) => r.data || []),
        supabase.from("bookings").select("*").then((r) => r.data || []),
      ]);
      setCategories(cats);
      setResources(res);
      setBookings(bks);
      if (isFirst) {
        setActiveCategoryIds((prev) => {
          if (prev) return prev;
          const eventCat = cats.find((c) => c.event_mode);
          const roomCat = cats.find((c) => c.name === "Raumbuchung");
          if (!eventCat) return cats.map((c) => c.id);
          return APP_MODE === "termine"
            ? [eventCat.id, ...(roomCat ? [roomCat.id] : [])]
            : cats.filter((c) => c.id !== eventCat.id).map((c) => c.id);
        });
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
    if (activeCategoryIds) localStorage.setItem(APP_FILTER_KEY, JSON.stringify(activeCategoryIds));
  }, [activeCategoryIds]);

  function toggleCategory(id) {
    setActiveCategoryIds((prev) => {
      const set = new Set(prev || []);
      if (set.has(id)) set.delete(id); else set.add(id);
      return Array.from(set);
    });
  }

  // Ressourcen für Kalender/Tagesübersicht: alle aktiven Bereiche, inkl. Termine.
  // activeCategoryIds === null heißt "noch nicht initialisiert" (kurz beim Laden) -> alles zeigen.
  // Ein leeres Array heißt "bewusst alles abgewählt" -> nichts zeigen.
  const calendarResources = activeCategoryIds ? resources.filter((r) => activeCategoryIds.includes(r.category_id)) : resources;

  async function refreshBookings() {
    const { data } = await supabase.from("bookings").select("*");
    setBookings(data || []);
    return data || [];
  }

  // bookingId gesetzt = bestehende Buchung aktualisieren (eigene Buchung wird bei der
  // Konfliktprüfung ignoriert), sonst neue Buchung anlegen.
  // skipConflict: NaWoDo-Termine duerfen sich zeitlich ueberschneiden (mehrere Termine
  // gleichzeitig sind erlaubt) - Sharing-Ressourcen und Raumbuchung pruefen weiterhin
  // wie bisher auf Ueberschneidung.
  function checkConflictAndSave({ bookingId, resourceId, startDate, endDate, allDay, startTime, endTime, name, note, title, userId, skipConflict }) {
    return (async () => {
      const latest = await refreshBookings();
      const newBooking = { date: startDate, end_date: endDate, all_day: allDay, start_time: allDay ? "00:00" : startTime, end_time: allDay ? "23:59" : endTime };
      const [newStart, newEnd] = bookingRangeMs(newBooking);
      const conflict = skipConflict ? null : latest.find((b) => {
        if (bookingId && b.id === bookingId) return false;
        if (b.resource_id !== resourceId) return false;
        const [bStart, bEnd] = bookingRangeMs(b);
        return rangeOverlapsMs(newStart, newEnd, bStart, bEnd);
      });
      if (conflict) {
        const range = conflict.date === bookingEndDate(conflict) ? conflict.date : `${conflict.date} – ${bookingEndDate(conflict)}`;
        throw new Error(conflict.all_day ? `Schon belegt von ${conflict.name} (ganztägig, ${range}).` : `Schon belegt von ${conflict.name} (${conflict.date} ${conflict.start_time} – ${bookingEndDate(conflict)} ${conflict.end_time}).`);
      }
      const payload = {
        resource_id: resourceId,
        date: startDate,
        end_date: endDate,
        all_day: allDay,
        start_time: allDay ? "00:00" : startTime,
        end_time: allDay ? "23:59" : endTime,
        name: name.trim(),
        note: note.trim() || null,
        title: title ? title.trim() : null,
        user_id: userId || user.id,
      };
      const { error } = bookingId
        ? await supabase.from("bookings").update(payload).eq("id", bookingId)
        : await supabase.from("bookings").insert(payload);
      if (error) throw error;
      await refreshBookings();
    })();
  }

  // ---- Buchungsdialog (Desktop + Mobile teilen sich diesen): Reiter + Artikel werden im Dialog selbst gewählt ----
  function openBookingDialog(dateStr, startTime) {
    setFormError("");
    setEditingBookingId(null);
    setFormTitle("");
    setFormNote("");
    setFormAllDay(false);
    setFormStartDate(dateStr);
    setFormEndDate(dateStr);
    setFormStart(startTime || "08:00");
    if (startTime) {
      const [hh, mm] = startTime.split(":").map(Number);
      const endMin = Math.min(23 * 60 + 59, hh * 60 + mm + 60);
      setFormEnd(`${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`);
    } else {
      setFormEnd("10:00");
    }
    setFormRoomId(null);
    setFormBlockZoe(false);
    setDialogResourceId(null);
    setDialogCategoryId(dialogEventCategory?.id || pickableCategories[0]?.id || null);
    setSelectedDate(dateStr);
    setBookingUserId(user.id);
    setDesktopDialogOpen(true);
  }

  // Öffnet denselben Dialog vorausgefüllt mit einer bestehenden Buchung, zum Korrigieren
  // von Tippfehlern o.ä. (Zeit/Datum/Notiz/Titel). Der Artikel selbst lässt sich hier
  // nicht wechseln, um Verwechslungen zu vermeiden.
  function openEditBookingDialog(booking) {
    const res = resources.find((r) => r.id === booking.resource_id);
    if (!isManageable(res)) return; // Sicherheitsnetz – Button ist in der DayAgenda ohnehin ausgeblendet
    const isEventBooking = !!(eventCategory && res?.category_id === eventCategory.id);
    setFormError("");
    setEditingBookingId(booking.id);
    setDialogCategoryId(res?.category_id ?? null);
    setDialogResourceId(isEventBooking ? null : booking.resource_id);
    setFormTitle(booking.title || "");
    setFormAllDay(booking.all_day);
    setFormStartDate(booking.date);
    setFormEndDate(bookingEndDate(booking));
    setFormStart(booking.start_time);
    setFormEnd(booking.end_time);
    setFormNote(booking.note || "");
    setFormRoomId(null);
    setFormBlockZoe(false);
    setBookingUserId(booking.user_id || user.id);
    setDesktopDialogOpen(true);
  }

  async function handleDesktopSave() {
    setFormError("");
    const isEventMode = dialogEventCategory && dialogCategoryId === dialogEventCategory.id;
    if (isEventMode) {
      if (!formTitle.trim()) return setFormError("Bitte einen Titel für den Termin eintragen.");
    } else if (!dialogResourceId) {
      return setFormError("Bitte einen Artikel auswählen.");
    }
    if (formEndDate < formStartDate) return setFormError("Enddatum darf nicht vor dem Startdatum liegen.");
    if (!formAllDay && formEndDate === formStartDate && toMinutes(formEnd) <= toMinutes(formStart)) {
      return setFormError("Ende muss nach dem Start liegen.");
    }
    // Admins koennen eine Buchung fuer ein anderes Mitglied anlegen - Name/ID des
    // ausgewaehlten Mitglieds werden dann statt der eigenen verwendet.
    const bookingAsName = isAdmin ? (members.find((m) => m.id === bookingUserId)?.name || userName) : userName;
    const bookingAsUserId = isAdmin ? bookingUserId : user.id;
    setSaving(true);
    try {
      if (isEventMode) {
        await checkConflictAndSave({ bookingId: editingBookingId, resourceId: eventResource.id, startDate: formStartDate, endDate: formEndDate, allDay: formAllDay, startTime: formStart, endTime: formEnd, name: bookingAsName, note: formNote, title: formTitle, userId: bookingAsUserId, skipConflict: true });
        if (formRoomId) {
          try {
            await checkConflictAndSave({ resourceId: formRoomId, startDate: formStartDate, endDate: formEndDate, allDay: formAllDay, startTime: formStart, endTime: formEnd, name: bookingAsName, note: formNote, title: formTitle, userId: bookingAsUserId });
          } catch (roomErr) {
            setFormError(`Termin gespeichert, aber der Raum konnte nicht mitgebucht werden: ${roomErr.message}`);
            setSaving(false);
            return;
          }
        }
      } else {
        await checkConflictAndSave({ bookingId: editingBookingId, resourceId: dialogResourceId, startDate: formStartDate, endDate: formEndDate, allDay: formAllDay, startTime: formStart, endTime: formEnd, name: bookingAsName, note: formNote, userId: bookingAsUserId });
        const dialogResource = resources.find((r) => r.id === dialogResourceId);
        if (formBlockZoe && zoeResource && isWallboxResource(dialogResource)) {
          try {
            await checkConflictAndSave({ resourceId: zoeResource.id, startDate: formStartDate, endDate: formEndDate, allDay: formAllDay, startTime: formStart, endTime: formEnd, name: bookingAsName, note: formNote, userId: bookingAsUserId });
          } catch (zoeErr) {
            setFormError(`Gebucht, aber Zoe konnte nicht mitgeblockt werden: ${zoeErr.message}`);
            setSaving(false);
            return;
          }
        }
      }
      setDesktopDialogOpen(false);
      setEditingBookingId(null);
    } catch (e) {
      setFormError(e.message || "Speichern hat nicht geklappt. Nochmal versuchen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(booking) {
    const res = resources.find((r) => r.id === booking.resource_id);
    if (!isManageable(res)) return; // Sicherheitsnetz – Button ist in der DayAgenda ohnehin ausgeblendet
    const label = booking.all_day
      ? `Ganztägig${bookingEndDate(booking) !== booking.date ? ` (${booking.date} – ${bookingEndDate(booking)})` : ` (${booking.date})`}`
      : `${booking.start_time}–${booking.end_time}`;
    if (!window.confirm(`Buchung von ${booking.name} wirklich löschen?\n${label}`)) return;
    try { await supabase.from("bookings").delete().eq("id", booking.id); await refreshBookings(); } catch {}
  }

  const CATEGORY_COLOR_PALETTE = ["#2E86AB", "#6C63A6", "#B54A45", "#C9A227", "#1F6F5C", "#C9752F", "#3E8E7E", "#A13D3D"];

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      const color = CATEGORY_COLOR_PALETTE[categories.length % CATEGORY_COLOR_PALETTE.length];
      const { data, error } = await supabase.from("categories").insert({ name: newCatName.trim(), color, sort_order: categories.length }).select().single();
      if (error) throw error;
      setCategories((prev) => [...prev, data]);
      setNewCatName("");
    } catch (e) {
      alert(e.message || "Kategorie konnte nicht angelegt werden.");
    } finally {
      setSavingCat(false);
    }
  }

  async function handleRenameCategory(id) {
    if (!catRenameName.trim()) return;
    try {
      const { error } = await supabase.from("categories").update({ name: catRenameName.trim() }).eq("id", id);
      if (error) throw error;
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: catRenameName.trim() } : c)));
      setCatRenameId(null);
    } catch (e) {
      alert(e.message || "Konnte nicht umbenannt werden.");
    }
  }

  async function handleDeleteCategory(id, name) {
    if (!window.confirm(`Kategorie "${name}" wirklich löschen? Alle Items (und deren Buchungen) in dieser Kategorie werden dabei mitgelöscht. Das kann nicht rückgängig gemacht werden.`)) return;
    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setResources((prev) => prev.filter((r) => r.category_id !== id));
    } catch (e) {
      alert(e.message || "Konnte nicht gelöscht werden.");
    }
  }

  async function handleAddResource() {
    if (!newResName.trim() || !newResCategoryId) return;
    try {
      let photo_url = null;
      if (newResPhoto) { setUploadingResPhoto(true); photo_url = await uploadFile(newResPhoto, `resources/${Date.now()}`); }
      const { data, error } = await supabase.from("resources").insert({ name: newResName.trim(), icon: newResIcon, category_id: newResCategoryId, photo_url }).select().single();
      if (error) throw error;
      setResources((prev) => [...prev, data]);
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
    setEditingResourceId(resource.id);
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

  function requireAdmin(action) {
    if (isElevated) { action(); return; }
    alert("Das dürfen nur Admin-Accounts. Melde dich beim Admin, falls du das brauchst.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
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

  const editingResource = resources.find((r) => r.id === editingResourceId);

  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className={isDesktop ? "w-full" : "sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto sm:border-x"} style={{ borderColor: "#E4E1D3" }}>
      <div className="px-5 lg:px-8 pt-6 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src="/sharing/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
          <h1 className="font-bold text-lg lg:text-2xl">Sharing</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs lg:text-sm font-bold truncate max-w-[110px] lg:max-w-[180px]" style={{ color: INK_SOFT }}>Hallo {userName}</span>
          <button onClick={() => setShowSettings(true)} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>{ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}</button>
          <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
        </div>
      </div>

      {!isDesktop && (
      <>
      {/* Mobiler Aufklapp-Pfeil fuer die Ansichten-Navigation (welche Kategorien im Kalender gezeigt werden) */}
      <button
        onClick={() => setShowMobileNav((v) => !v)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-50 w-7 h-10 rounded-r-full flex items-center justify-center shadow"
        style={{ backgroundColor: INK, color: "#fff" }}
      >
        {showMobileNav ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
      </button>
      {showMobileNav && (
        <div
          className="fixed inset-0 z-40"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setShowMobileNav(false)}
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] overflow-y-auto p-4 transition-transform duration-200 ${showMobileNav ? "translate-x-0" : "-translate-x-full"}`}
        style={{ backgroundColor: PAPER }}
      >
        <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Ansichten</div>
        <CategorySidebar
          categories={categories}
          activeCategoryIds={activeCategoryIds}
          onToggle={toggleCategory}
          onAll={() => setActiveCategoryIds(categories.map((c) => c.id))}
          onNone={() => setActiveCategoryIds([])}
          primaryCategoryIds={primaryCategoryIds}
          groupLabel="Sharing"
          groupCategoryIds={groupCategoryIds}
        />
      </div>

      <div className="px-5 mt-1 mb-3">
        <button onClick={() => openBookingDialog(selectedDate)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: "#D6A428" }}><Plus size={14} /> Buchen</button>
      </div>
      </>
      )}

      {isDesktop && (
        <div className="px-5 lg:px-8 mt-3 flex gap-6 items-start">
          <div className="w-52 flex-shrink-0">
            <MiniMonthCalendar month={calendarMonth} onMonthChange={setCalendarMonth} selectedDate={selectedDate} onSelectDate={setSelectedDate} onOpenDialog={(d) => openBookingDialog(d)} />
            <CategorySidebar
              categories={categories}
              activeCategoryIds={activeCategoryIds}
              onToggle={toggleCategory}
              onAll={() => setActiveCategoryIds(categories.map((c) => c.id))}
              onNone={() => setActiveCategoryIds([])}
              primaryCategoryIds={primaryCategoryIds}
              groupLabel="Sharing"
              groupCategoryIds={groupCategoryIds}
            />
            {isElevated && (
              <button onClick={() => requireAdmin(() => setShowResourceForm(true))} className="mt-4 flex items-center gap-1 px-3 py-2 rounded-full text-sm" style={{ border: "1.5px dashed #B8B4A2", color: INK_SOFT }}><Plus size={14} /> Neuer Artikel</button>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="mb-3">
              <div className="flex gap-1 p-1 rounded-full w-fit" style={{ backgroundColor: "#E4E1D3" }}>
                <button onClick={() => setDesktopViewMode("month")} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold" style={{ backgroundColor: desktopViewMode === "month" ? "#fff" : "transparent", color: desktopViewMode === "month" ? INK : INK_SOFT }}><CalendarDays size={13} /> Monat</button>
                <button onClick={() => { setDesktopViewMode("week"); setCalendarWeekStart(startOfWeek(selectedDate)); }} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold" style={{ backgroundColor: desktopViewMode === "week" ? "#fff" : "transparent", color: desktopViewMode === "week" ? INK : INK_SOFT }}><CalendarDays size={13} /> Woche</button>
              </div>
            </div>
            <div className="mb-3">
              <button onClick={() => openBookingDialog(selectedDate)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: "#D6A428" }}><Plus size={14} /> Buchen</button>
            </div>
            {desktopViewMode === "month" ? (
              <DesktopMonthGrid
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                bookings={bookings}
                calendarResources={calendarResources}
                eventCategory={eventCategory}
                colorFor={colorFor}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onOpenDialog={(d) => openBookingDialog(d)}
              />
            ) : (
              <DesktopWeekGrid
                weekStart={calendarWeekStart}
                onWeekChange={setCalendarWeekStart}
                bookings={bookings}
                calendarResources={calendarResources}
                eventCategory={eventCategory}
                colorFor={colorFor}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onOpenDialog={(d, t) => openBookingDialog(d, t)}
              />
            )}
            <div className="mt-4">
              <DayAgenda
                date={selectedDate}
                bookings={bookings}
                resources={resources}
                calendarResources={calendarResources}
                eventCategory={eventCategory}
                colorFor={colorFor}
                isManageable={isManageable}
                onDelete={handleDelete}
                onEdit={openEditBookingDialog}
                onBook={(d) => openBookingDialog(d)}
                showBookButton={false}
              />
            </div>
          </div>
        </div>
      )}

      {!isDesktop && <>
        <div className="px-5 mt-2 flex items-center justify-between">
          <div className="flex gap-1 p-1 rounded-full" style={{ backgroundColor: "#E4E1D3" }}>
            <button onClick={() => { setViewMode("month"); setCalendarMonth(firstOfMonth(selectedDate)); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: viewMode === "month" ? "#fff" : "transparent", color: viewMode === "month" ? INK : INK_SOFT }}><CalendarDays size={13} /> Monat</button>
            <button onClick={() => { setViewMode("week"); setCalendarWeekStart(selectedDate); }} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold" style={{ backgroundColor: viewMode === "week" ? "#fff" : "transparent", color: viewMode === "week" ? INK : INK_SOFT }}><CalendarDays size={13} /> Woche</button>
          </div>
        </div>

        {viewMode === "week" && (
          <div className="px-5 mt-3">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setCalendarWeekStart(addDays(calendarWeekStart, -3))} className="p-2 rounded-full" style={{ backgroundColor: "#E4E1D3" }}><ChevronLeft size={16} /></button>
              <div className="font-semibold text-sm">{rangeLabel(calendarWeekStart, addDays(calendarWeekStart, 2))}</div>
              <button onClick={() => setCalendarWeekStart(addDays(calendarWeekStart, 3))} className="p-2 rounded-full" style={{ backgroundColor: "#E4E1D3" }}><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => addDays(calendarWeekStart, i)).map((dateStr) => {
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
                    onClick={() => setSelectedDate(dateStr)}
                    onDoubleClick={() => openBookingDialog(dateStr)}
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
                    onClick={() => setSelectedDate(cell.date)}
                    onDoubleClick={() => openBookingDialog(cell.date)}
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

        <div className="px-5 mt-4 mb-4">
          <DayAgenda
            date={selectedDate}
            bookings={bookings}
            resources={resources}
            calendarResources={calendarResources}
            eventCategory={eventCategory}
            colorFor={colorFor}
            isManageable={isManageable}
            onDelete={handleDelete}
            onEdit={openEditBookingDialog}
            onBook={(d) => openBookingDialog(d)}
            showBookButton={true}
          />
        </div>
      </>}
      </div>

      <BookingDialog
        open={desktopDialogOpen}
        onClose={() => { setDesktopDialogOpen(false); setEditingBookingId(null); }}
        isEditing={!!editingBookingId}
        userName={userName}
        isAdmin={isAdmin}
        members={members}
        ownUserId={user.id}
        bookingUserId={bookingUserId}
        onBookingUserChange={setBookingUserId}
        pickableCategories={pickableCategories}
        eventCategory={dialogEventCategory}
        resources={resources}
        roomResources={roomResources}
        zoeResource={zoeResource}
        isWallboxResource={isWallboxResource}
        colorFor={colorFor}
        categoryId={dialogCategoryId}
        onCategoryChange={(id) => { setDialogCategoryId(id); setDialogResourceId(null); }}
        resourceId={dialogResourceId}
        onResourceChange={setDialogResourceId}
        formTitle={formTitle} setFormTitle={setFormTitle}
        formAllDay={formAllDay} setFormAllDay={setFormAllDay}
        formStartDate={formStartDate} setFormStartDate={setFormStartDate}
        formStart={formStart} setFormStart={setFormStart}
        formEndDate={formEndDate} setFormEndDate={setFormEndDate}
        formEnd={formEnd} setFormEnd={setFormEnd}
        formRoomId={formRoomId} setFormRoomId={setFormRoomId}
        formBlockZoe={formBlockZoe} setFormBlockZoe={setFormBlockZoe}
        formNote={formNote} setFormNote={setFormNote}
        formError={formError}
        saving={saving}
        onSave={handleDesktopSave}
      />

      {showResourceForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowResourceForm(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Neues Item</h2><button onClick={() => setShowResourceForm(false)}><X size={20} /></button></div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium block">Bereich</label>
              <button type="button" onClick={() => setManageCategories((v) => !v)} className="text-[11px] font-semibold underline" style={{ color: INK_SOFT }}>
                {manageCategories ? "Fertig" : "Kategorien verwalten"}
              </button>
            </div>
            {manageCategories ? (
              <div className="mb-3 flex flex-col gap-1.5">
                {categories.filter((c) => c.id !== eventCategory?.id && c.id !== roomCategory?.id).map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    {catRenameId === c.id ? (
                      <input
                        autoFocus
                        value={catRenameName}
                        onChange={(e) => setCatRenameName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRenameCategory(c.id)}
                        onBlur={() => handleRenameCategory(c.id)}
                        className="flex-1 rounded-lg px-2 py-1 text-xs border"
                        style={{ borderColor: "#D8D5C7" }}
                      />
                    ) : (
                      <button type="button" onClick={() => { setCatRenameId(c.id); setCatRenameName(c.name); }} className="flex-1 text-left text-xs font-medium">{c.name}</button>
                    )}
                    <button type="button" onClick={() => handleDeleteCategory(c.id, c.name)}><Trash2 size={13} style={{ color: "#B8B4A2" }} /></button>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-1">
                  <input
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Neue Kategorie…"
                    className="flex-1 rounded-lg px-2 py-1.5 text-xs border"
                    style={{ borderColor: "#D8D5C7" }}
                  />
                  <button type="button" onClick={handleAddCategory} disabled={savingCat || !newCatName.trim()} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: INK, opacity: savingCat || !newCatName.trim() ? 0.6 : 1 }}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mb-3 flex-wrap">
                {pickableCategories.map((c) => (
                  <button key={c.id} onClick={() => setNewResCategoryId(c.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: newResCategoryId === c.id ? c.color : "transparent", color: newResCategoryId === c.id ? "#fff" : INK, border: `1.5px solid ${newResCategoryId === c.id ? c.color : "#D8D5C7"}` }}>{c.name}</button>
                ))}
              </div>
            )}
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

      {showEditResourceForm && editingResource && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowEditResourceForm(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
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
            {editingResource.photo_url && !editResPhoto && <img src={editingResource.photo_url} className="w-full h-24 object-cover rounded-lg mb-2" />}
            <button onClick={() => editResPhotoInputRef.current?.click()} className="w-full rounded-lg py-2.5 mb-4 text-sm border flex items-center justify-center gap-2" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}><ImageIcon size={15} /> {editResPhoto ? editResPhoto.name : editingResource.photo_url ? "Foto ersetzen" : "Foto hinzufügen"}</button>
            <input ref={editResPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setEditResPhoto(e.target.files?.[0] || null)} />
            <button onClick={() => handleEditResource(editingResource.id)} disabled={savingEdit} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2 mb-2" style={{ backgroundColor: INK, opacity: savingEdit ? 0.7 : 1 }}>{savingEdit && <Loader2 size={15} className="animate-spin" />} {savingEdit ? "Speichern…" : "Speichern"}</button>
            <button onClick={() => handleDeleteResource(editingResource.id)} className="w-full rounded-lg py-3 font-semibold text-sm flex items-center justify-center gap-2" style={{ color: "#A13D3D", border: "1.5px solid #E0B8B8" }}><Trash2 size={15} /> Item löschen</button>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowSettings(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Einstellungen</h2><button onClick={() => setShowSettings(false)}><X size={20} /></button></div>
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

            <button onClick={() => { setShowSettings(false); openEditProfile(); }} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold flex items-center justify-center gap-2" style={{ border: "1.5px solid #D8D5C7", color: INK }}>
              <Pencil size={14} /> Eintrag bearbeiten
            </button>

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

            <button onClick={handleLogout} className="w-full rounded-lg py-2.5 text-sm border" style={{ borderColor: "#E0B8B8", color: "#A13D3D" }}>Abmelden</button>
          </div>
        </div>
      )}

      {showEditProfile && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowEditProfile(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
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
