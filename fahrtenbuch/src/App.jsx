import React, { useState, useEffect, useRef } from "react";
import { Plus, Car, X, AlertCircle, Loader2, Home, Download, Calendar, BarChart3, Pencil, Trash2 } from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";
import { useIsDesktop } from "./useIsDesktop";

const PAPER = "#F1F0EA";
const INK = "#2B2B26";
const INK_SOFT = "#6B6A61";
const BLUE = "#2E86AB";
const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function fmtDate(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function currentMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return [fmtDate(start), fmtDate(end)];
}
function currentMonthLabel() {
  const today = new Date();
  return `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
}
function currentQuarterRange() {
  const today = new Date();
  const q = Math.floor(today.getMonth() / 3);
  const start = new Date(today.getFullYear(), q * 3, 1);
  const end = new Date(today.getFullYear(), q * 3 + 3, 0);
  return [fmtDate(start), fmtDate(end)];
}
function currentQuarterLabel() {
  const today = new Date();
  return `${Math.floor(today.getMonth() / 3) + 1}. Quartal ${today.getFullYear()}`;
}
function fmtDateShort(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}
function fmtEntryDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d}. ${MONTH_NAMES[m - 1]} '${String(y).slice(-2)}`;
}

export default function App() {
  if (configMissing) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}>
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
  const [session, setSession] = useState(undefined); // undefined = wird geladen, null = kein Login
  const [access, setAccess] = useState(undefined); // undefined = wird geprueft, true/false = Zugriff erlaubt/gesperrt

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
      .eq("app_key", "fahrtenbuch")
      .maybeSingle()
      .then(({ data }) => setAccess(!data || data.allowed !== false))
      .catch(() => setAccess(true));
  }, [session]);

  if (session === undefined || session === null || access === undefined) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={28} style={{ color: INK_SOFT }} /></div>;
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

  return <Fahrtenbuch session={session} />;
}

function Fahrtenbuch({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
  const [ownMemberId, setOwnMemberId] = useState(null);
  const [ownFotoUrl, setOwnFotoUrl] = useState(null);
  useEffect(() => {
    supabase.from("members").select("id, foto_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setOwnMemberId(data?.id || null);
      setOwnFotoUrl(data?.foto_url || null);
    });
  }, [user.id]);
  const isAdmin = user.user_metadata?.is_admin === true;
  const isSuperAdmin = user.user_metadata?.is_superadmin === true;
  const [myModApps, setMyModApps] = useState([]);
  useEffect(() => {
    supabase.from("app_moderators").select("app_key").eq("user_id", user.id).then(({ data }) => {
      setMyModApps((data || []).map((r) => r.app_key));
    });
  }, [user.id]);
  const isElevated = isAdmin || isSuperAdmin || myModApps.includes("fahrtenbuch");
  const initial = userName.charAt(0).toUpperCase();
  const isDesktop = useIsDesktop();

  const [cars, setCars] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCarId, setSelectedCarId] = useState(null);

  const [month0, month1] = currentMonthRange();
  const [quarter0, quarter1] = currentQuarterRange();
  const [filterFrom, setFilterFrom] = useState(month0);
  const [filterTo, setFilterTo] = useState(month1);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [pickerMode, setPickerMode] = useState("view"); // "view" oder "export"
  const [rangeFromInput, setRangeFromInput] = useState(month0);
  const [rangeToInput, setRangeToInput] = useState(month1);
  const [exportCarIds, setExportCarIds] = useState([]);

  const [showStats, setShowStats] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formDate, setFormDate] = useState(fmtDate(new Date()));
  const [formStartKm, setFormStartKm] = useState("");
  const [formEndKm, setFormEndKm] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formDriverName, setFormDriverName] = useState("");
  const [linkedBookingId, setLinkedBookingId] = useState(null);
  const [formIsExpense, setFormIsExpense] = useState(false);
  const [formExpenseAmount, setFormExpenseAmount] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const startKmRef = useRef(null);

  const [showCarForm, setShowCarForm] = useState(false);
  const [newCarName, setNewCarName] = useState("");
  const [savingCar, setSavingCar] = useState(false);
  const [carRenameId, setCarRenameId] = useState(null);
  const [carRenameName, setCarRenameName] = useState("");

  const [showAccount, setShowAccount] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel("logbook-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "logbook_entries" }, () => {
        supabase.from("logbook_entries").select("*").order("date", { ascending: false }).then(({ data }) => data && setEntries(data));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    if (showForm && startKmRef.current && !editingEntry) {
      startKmRef.current.focus();
      const val = formStartKm;
      if (val.length > 3) {
        startKmRef.current.setSelectionRange(val.length - 3, val.length);
      } else {
        startKmRef.current.select();
      }
    }
  }, [showForm]);

  async function loadAll() {
    const [catRes, resRes, entriesRes, bookingsRes] = await Promise.all([
      supabase.from("categories").select("*"),
      supabase.from("resources").select("*"),
      supabase.from("logbook_entries").select("*").order("date", { ascending: false }),
      supabase.from("bookings").select("*"),
    ]);
    const cats = catRes.data || [];
    const carCategory = cats.find((c) => c.name === "Car Sharing");
    const carResources = carCategory ? (resRes.data || []).filter((r) => r.category_id === carCategory.id) : [];
    setCars(carResources);
    setEntries(entriesRes.data || []);
    setBookings(bookingsRes.data || []);
    if (carResources.length && !selectedCarId) setSelectedCarId(carResources[0].id);
    setLoading(false);
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
      setPasswordError(e.message || "Hat nicht geklappt.");
    } finally {
      setSavingPassword(false);
    }
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

  async function handleAddCar() {
    if (!newCarName.trim()) return;
    const carCategory = (await supabase.from("categories").select("*").eq("name", "Car Sharing").single()).data;
    if (!carCategory) return;
    setSavingCar(true);
    try {
      const { data, error } = await supabase.from("resources").insert({ name: newCarName.trim(), icon: "car", category_id: carCategory.id }).select().single();
      if (error) throw error;
      setCars((prev) => [...prev, data]);
      setSelectedCarId(data.id);
      setNewCarName("");
    } catch (e) {
      // Formular bleibt offen
    } finally {
      setSavingCar(false);
    }
  }

  async function handleRenameCar(id) {
    if (!carRenameName.trim()) return;
    try {
      const { error } = await supabase.from("resources").update({ name: carRenameName.trim() }).eq("id", id);
      if (error) throw error;
      setCars((prev) => prev.map((c) => (c.id === id ? { ...c, name: carRenameName.trim() } : c)));
      setCarRenameId(null);
    } catch (e) {
      alert(e.message || "Konnte nicht umbenannt werden.");
    }
  }

  async function handleDeleteCar(id, name) {
    if (!window.confirm(`Fahrzeug "${name}" wirklich löschen? Alle Fahrtenbuch-Einträge dazu werden mitgelöscht. Das kann nicht rückgängig gemacht werden.`)) return;
    try {
      const { error } = await supabase.from("resources").delete().eq("id", id);
      if (error) throw error;
      setCars((prev) => prev.filter((c) => c.id !== id));
      if (selectedCarId === id) setSelectedCarId(null);
    } catch (e) {
      alert(e.message || "Konnte nicht gelöscht werden.");
    }
  }

  const rangeFilteredEntries = entries.filter((e) => e.date >= filterFrom && e.date <= filterTo);
  const carEntries = rangeFilteredEntries.filter((e) => e.resource_id === selectedCarId);
  const carAllEntries = entries.filter((e) => e.resource_id === selectedCarId);
  const lastKm = carAllEntries.length ? Math.max(...carAllEntries.map((e) => e.end_km)) : "";
  const activeCar = cars.find((c) => c.id === selectedCarId);

  const isCurrentMonthRange = filterFrom === month0 && filterTo === month1;
  const isCurrentQuarterRange = filterFrom === quarter0 && filterTo === quarter1;
  const rangeLabel = isCurrentMonthRange ? currentMonthLabel() : isCurrentQuarterRange ? currentQuarterLabel() : `${fmtDateShort(filterFrom)} – ${fmtDateShort(filterTo)}`;

  const formDistance = (() => {
    const s = parseInt(formStartKm, 10), e = parseInt(formEndKm, 10);
    if (isNaN(s) || isNaN(e) || e <= s) return null;
    return e - s;
  })();

  function canEdit(entry) {
    return isElevated || entry.user_id === user.id;
  }

  // Nur wer das Fahrzeug gebucht hat (oder ein Admin) darf die km dazu eintragen.
  // Alte Buchungen ohne user_id (vor der Umstellung angelegt) bleiben für alle offen.
  function canLogBooking(b) {
    return isElevated || !b.user_id || b.user_id === user.id;
  }

  const todayStr = fmtDate(new Date());
  const loggedBookingIds = new Set(entries.filter((e) => e.booking_id).map((e) => e.booking_id));
  const pendingBookings = bookings
    .filter((b) => b.resource_id === selectedCarId)
    .filter((b) => !loggedBookingIds.has(b.id))
    .filter((b) => (b.end_date || b.date) <= todayStr)
    .filter(canLogBooking)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  function openForm() {
    setEditingEntry(null);
    setFormError("");
    setFormDate(fmtDate(new Date()));
    setFormStartKm(lastKm !== "" ? String(lastKm) : "");
    setFormEndKm("");
    setFormNote("");
    setFormDriverName(userName);
    setFormIsExpense(false);
    setFormExpenseAmount("");
    setLinkedBookingId(null);
    setShowForm(true);
  }

  function openFormFromBooking(booking) {
    setEditingEntry(null);
    setFormError("");
    setFormDate(booking.date);
    setFormStartKm(lastKm !== "" ? String(lastKm) : "");
    setFormEndKm("");
    setFormNote(booking.note || "");
    setFormDriverName(booking.name || userName);
    setFormIsExpense(false);
    setFormExpenseAmount("");
    setLinkedBookingId(booking.id);
    setShowForm(true);
  }

  function openEditForm(entry) {
    setEditingEntry(entry);
    setFormError("");
    setFormDate(entry.date);
    setFormStartKm(String(entry.start_km));
    setFormEndKm(String(entry.end_km));
    setFormNote(entry.note || "");
    setFormDriverName(entry.driver_name);
    setFormIsExpense(entry.is_expense || false);
    setFormExpenseAmount(entry.expense_amount != null ? String(entry.expense_amount) : "");
    setShowForm(true);
  }

  async function handleSaveEntry() {
    setFormError("");
    const start = parseInt(formStartKm, 10);
    const end = parseInt(formEndKm, 10);
    if (!formDate) return setFormError("Bitte ein Datum wählen.");
    if (isNaN(start) || start < 0) return setFormError("Bitte einen gültigen Start-Kilometerstand eintragen.");
    if (isNaN(end) || end <= start) return setFormError("Der End-Kilometerstand muss größer als der Start sein.");
    if (formIsExpense && (formExpenseAmount === "" || isNaN(parseFloat(formExpenseAmount)))) return setFormError("Bitte einen gültigen Betrag für die Ausgabe eintragen.");
    if (!formDriverName.trim()) return setFormError("Bitte einen Fahrer eintragen.");
    setSaving(true);
    try {
      const payload = {
        date: formDate,
        start_km: start,
        end_km: end,
        note: formNote.trim() || null,
        is_expense: formIsExpense,
        expense_amount: formIsExpense ? parseFloat(formExpenseAmount) : null,
        driver_name: formDriverName.trim(),
      };
      if (editingEntry) {
        const { error } = await supabase.from("logbook_entries").update(payload).eq("id", editingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("logbook_entries").insert({
          ...payload,
          resource_id: selectedCarId,
          user_id: user.id,
          booking_id: linkedBookingId,
        });
        if (error) throw error;
      }
      setShowForm(false);
      setEditingEntry(null);
      loadAll();
    } catch (e) {
      setFormError(e.message || "Speichern hat nicht geklappt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEntry() {
    if (!editingEntry) return;
    if (!window.confirm(`Fahrt vom ${editingEntry.date} wirklich löschen?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("logbook_entries").delete().eq("id", editingEntry.id);
      if (error) throw error;
      setShowForm(false);
      setEditingEntry(null);
      loadAll();
    } catch (e) {
      setFormError(e.message || "Löschen hat nicht geklappt.");
    } finally {
      setSaving(false);
    }
  }

  function exportCSVRange(from, to) {
    const rows = entries.filter((e) => e.date >= from && e.date <= to && exportCarIds.includes(e.resource_id));
    const header = ["Datum", "Fahrzeug", "Fahrer", "km Start", "km Ende", "km gefahren", "Ausgabe (€)", "Bemerkung"];
    const csvRows = rows.map((e) => {
      const carName = cars.find((c) => c.id === e.resource_id)?.name || "";
      return [e.date, carName, e.driver_name, e.start_km, e.end_km, e.end_km - e.start_km, e.is_expense ? e.expense_amount : "", e.note || ""];
    });
    const csv = [header, ...csvRows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fahrtenbuch-${from}-bis-${to}.csv`;
    link.click();
  }

  function openPicker(mode) {
    setPickerMode(mode);
    setRangeFromInput(filterFrom);
    setRangeToInput(filterTo);
    if (mode === "export") setExportCarIds(cars.map((c) => c.id));
    setShowRangePicker(true);
  }

  function toggleExportCar(id) {
    setExportCarIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function applyRange(from, to) {
    if (pickerMode === "export") {
      exportCSVRange(from, to);
    } else {
      setFilterFrom(from);
      setFilterTo(to);
    }
    setShowRangePicker(false);
  }

  const statsByDriver = {};
  for (const e of entries) {
    const dist = e.end_km - e.start_km;
    const carName = cars.find((c) => c.id === e.resource_id)?.name || "Unbekannt";
    if (!statsByDriver[e.driver_name]) statsByDriver[e.driver_name] = { total: 0, byCar: {} };
    statsByDriver[e.driver_name].total += dist;
    statsByDriver[e.driver_name].byCar[carName] = (statsByDriver[e.driver_name].byCar[carName] || 0) + dist;
  }
  const statsRows = Object.entries(statsByDriver).sort((a, b) => b[1].total - a[1].total);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={28} style={{ color: INK_SOFT }} /></div>;
  }

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className={isDesktop ? "w-full" : "sm:max-w-2xl mx-auto sm:border-x"} style={{ borderColor: "#E4E1D3" }}>
        <div className={isDesktop ? "max-w-6xl mx-auto px-8 pt-10 pb-6 flex items-center justify-between" : "px-5 pt-6 pb-3 flex items-center justify-between"}>
          <div className="flex items-center gap-2.5">
            <img src="/fahrtenbuch/logo-nawodo.png" alt="NaWoDo" className={isDesktop ? "h-11 object-contain" : "h-8 object-contain"} />
            <h1 className={isDesktop ? "font-bold text-2xl" : "font-bold text-lg"}>Fahrtenbuch</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="p-2 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} style={{ color: INK_SOFT }} /></a>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>{ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}</button>
          </div>
        </div>

        {!isDesktop && (
          cars.length === 0 && !isElevated ? (
            <p className="px-5 text-sm" style={{ color: INK_SOFT }}>Noch keine Autos vorhanden.</p>
          ) : (
            <>
              <div className="px-5 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {cars.map((c) => {
                  const active = c.id === selectedCarId;
                  return (
                    <button key={c.id} onClick={() => setSelectedCarId(c.id)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium flex-shrink-0" style={{ backgroundColor: active ? BLUE : `${BLUE}1A`, color: active ? "#fff" : INK, border: `1.5px solid ${active ? BLUE : `${BLUE}55`}` }}>
                      <Car size={14} /> {c.name}
                    </button>
                  );
                })}
                {isElevated && (
                  <button onClick={() => { setShowCarForm(true); setNewCarName(""); }} className="flex items-center gap-1 px-3 py-2 rounded-full text-sm flex-shrink-0" style={{ border: "1.5px dashed #B8B4A2", color: INK_SOFT }}><Plus size={14} /> Neu</button>
                )}
              </div>

              {activeCar && (
                <div className="px-5 mt-4 mb-2">
                  <div className="text-xs" style={{ color: INK_SOFT }}>Letzter Stand: <span className="font-semibold" style={{ color: INK }}>{lastKm !== "" ? `${lastKm} km` : "noch kein Eintrag"}</span></div>
                </div>
              )}

              <div className="px-5 mt-1 mb-3">
                <button onClick={() => openPicker("view")} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: isCurrentMonthRange ? "#E4E1D3" : INK, color: isCurrentMonthRange ? INK_SOFT : "#fff" }}>
                  <Calendar size={12} /> {rangeLabel}
                </button>
              </div>

              {activeCar && (
                <div className="px-5 mb-3">
                  <button onClick={openForm} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: BLUE }}><Plus size={14} /> Eintrag</button>
                </div>
              )}

              {pendingBookings.length > 0 && (
                <div className="px-5 mb-4">
                  <div className="text-xs font-semibold mb-2" style={{ color: "#C9752F" }}>Ausstehende Buchungen – noch nicht im Fahrtenbuch</div>
                  <div className="space-y-2">
                    {pendingBookings.map((b) => (
                      <button key={b.id} onClick={() => openFormFromBooking(b)} className="w-full text-left rounded-lg px-3.5 py-3 flex items-center justify-between" style={{ backgroundColor: "#fff", border: "1.5px dashed #C9752F55" }}>
                        <div>
                          <div className="text-sm font-semibold">{fmtEntryDate(b.date)}{b.end_date && b.end_date !== b.date ? ` – ${fmtEntryDate(b.end_date)}` : ""}</div>
                          <div className="text-xs" style={{ color: INK_SOFT }}>{b.name}{b.all_day ? " · ganztägig" : ` · ${b.start_time}–${b.end_time}`}</div>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#C9752F1A", color: "#C9752F" }}>km eintragen</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-5 space-y-2">
                {carEntries.length === 0 && (
                  <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}><p className="text-sm" style={{ color: INK_SOFT }}>Keine Fahrten in diesem Zeitraum.</p></div>
                )}
                {carEntries.map((e) => (
                  <div key={e.id} onClick={() => canEdit(e) && openEditForm(e)} className="rounded-lg px-3.5 py-3" style={{ backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.06)", cursor: canEdit(e) ? "pointer" : "default" }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{fmtEntryDate(e.date)}</div>
                        <div className="text-xs" style={{ color: INK_SOFT }}>{e.driver_name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-sm font-semibold">{e.end_km - e.start_km} km</div>
                          <div className="text-xs" style={{ color: INK_SOFT }}>{e.start_km} → {e.end_km}</div>
                        </div>
                        {canEdit(e) && <Pencil size={13} style={{ color: "#B8B4A2" }} />}
                      </div>
                    </div>
                    {(e.note || e.is_expense) && (
                      <div className="text-xs mt-1.5 pt-1.5 flex items-center justify-between" style={{ color: INK_SOFT, borderTop: "1px solid #F1F0EA" }}>
                        <span>{e.note}</span>
                        {e.is_expense && <span className="font-semibold" style={{ color: "#C9752F" }}>Ausgabe: {e.expense_amount} €</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="px-5 mt-4">
                <button onClick={() => setShowStats(true)} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-full" style={{ border: "1.5px solid #D8D5C7", color: INK_SOFT }}>
                  <BarChart3 size={12} /> Statistiken
                </button>
              </div>
            </>
          )
        )}

        {isDesktop && (
          cars.length === 0 && !isElevated ? (
            <p className="px-8 text-sm" style={{ color: INK_SOFT }}>Noch keine Autos vorhanden.</p>
          ) : (
            <div className="max-w-6xl mx-auto px-8 pb-12 flex gap-8 items-start">
              <div className="w-64 flex-shrink-0 flex flex-col gap-5">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: INK_SOFT }}>Fahrzeuge</div>
                  <div className="flex flex-col gap-1.5">
                    {cars.map((c) => {
                      const active = c.id === selectedCarId;
                      return (
                        <button key={c.id} onClick={() => setSelectedCarId(c.id)} className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium text-left" style={{ backgroundColor: active ? BLUE : `${BLUE}1A`, color: active ? "#fff" : INK, border: `1.5px solid ${active ? BLUE : `${BLUE}55`}` }}>
                          <Car size={14} /> {c.name}
                        </button>
                      );
                    })}
                    {isElevated && (
                      <button onClick={() => { setShowCarForm(true); setNewCarName(""); }} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm text-left" style={{ border: "1.5px dashed #B8B4A2", color: INK_SOFT }}><Plus size={14} /> Neu</button>
                    )}
                  </div>
                </div>

                {activeCar && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs" style={{ color: INK_SOFT }}>Letzter Stand: <span className="font-semibold" style={{ color: INK }}>{lastKm !== "" ? `${lastKm} km` : "noch kein Eintrag"}</span></div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button onClick={() => setShowStats(true)} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full" style={{ border: "1.5px solid #D8D5C7", color: INK_SOFT }}>
                    <BarChart3 size={12} /> Statistiken
                  </button>
                  {isElevated && (
                    <button onClick={() => openPicker("export")} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full" style={{ border: "1.5px solid #D8D5C7", color: INK_SOFT }}>
                      <Download size={12} /> Als CSV exportieren
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="mb-3">
                  <button onClick={() => openPicker("view")} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full" style={{ backgroundColor: isCurrentMonthRange ? "#E4E1D3" : INK, color: isCurrentMonthRange ? INK_SOFT : "#fff" }}>
                    <Calendar size={12} /> {rangeLabel}
                  </button>
                </div>
                {activeCar && (
                  <div className="mb-4">
                    <button onClick={openForm} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: BLUE }}><Plus size={14} /> Eintrag</button>
                  </div>
                )}

                {pendingBookings.length > 0 && (
                  <div className="mb-5">
                    <div className="text-xs font-semibold mb-2" style={{ color: "#C9752F" }}>Ausstehende Buchungen – noch nicht im Fahrtenbuch</div>
                    <div className="flex flex-col gap-2">
                      {pendingBookings.map((b) => (
                        <button key={b.id} onClick={() => openFormFromBooking(b)} className="text-left rounded-lg px-3.5 py-3 flex items-center justify-between" style={{ backgroundColor: "#fff", border: "1.5px dashed #C9752F55" }}>
                          <div>
                            <div className="text-sm font-semibold">{fmtEntryDate(b.date)}{b.end_date && b.end_date !== b.date ? ` – ${fmtEntryDate(b.end_date)}` : ""}</div>
                            <div className="text-xs" style={{ color: INK_SOFT }}>{b.name}{b.all_day ? " · ganztägig" : ` · ${b.start_time}–${b.end_time}`}</div>
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ml-2" style={{ backgroundColor: "#C9752F1A", color: "#C9752F" }}>km eintragen</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {carEntries.length === 0 ? (
                  <div className="text-center py-14 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}><p className="text-sm" style={{ color: INK_SOFT }}>Keine Fahrten in diesem Zeitraum.</p></div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {carEntries.map((e) => (
                      <div key={e.id} onClick={() => canEdit(e) && openEditForm(e)} className="rounded-lg px-4 py-3" style={{ backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.06)", cursor: canEdit(e) ? "pointer" : "default" }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">{fmtEntryDate(e.date)}</div>
                            <div className="text-xs" style={{ color: INK_SOFT }}>{e.driver_name}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-semibold">{e.end_km - e.start_km} km</div>
                              <div className="text-xs" style={{ color: INK_SOFT }}>{e.start_km} → {e.end_km}</div>
                            </div>
                            {canEdit(e) && <Pencil size={13} style={{ color: "#B8B4A2" }} />}
                          </div>
                        </div>
                        {(e.note || e.is_expense) && (
                          <div className="text-xs mt-1.5 pt-1.5 flex items-center justify-between" style={{ color: INK_SOFT, borderTop: "1px solid #F1F0EA" }}>
                            <span>{e.note}</span>
                            {e.is_expense && <span className="font-semibold" style={{ color: "#C9752F" }}>Ausgabe: {e.expense_amount} €</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowForm(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">{editingEntry ? "Fahrt bearbeiten" : `${activeCar?.name} – Fahrt eintragen`}</h2><button onClick={() => setShowForm(false)}><X size={20} /></button></div>
            {linkedBookingId && !editingEntry && (
              <div className="mb-3 px-3 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: `${BLUE}1A`, color: BLUE }}>Aus Buchung übernommen – bitte nur noch die Kilometer eintragen</div>
            )}
            <label className="text-xs font-medium block mb-1">Fahrer</label>
            <input value={formDriverName} onChange={(e) => setFormDriverName(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            <label className="text-xs font-medium block mb-1">Datum</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            <div className="flex gap-3 mb-1">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">km Start</label>
                <input ref={startKmRef} type="text" inputMode="numeric" value={formStartKm} onChange={(e) => setFormStartKm(e.target.value.replace(/[^0-9]/g, ""))} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">km Ende</label>
                <input type="text" inputMode="numeric" value={formEndKm} onChange={(e) => setFormEndKm(e.target.value.replace(/[^0-9]/g, ""))} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
              </div>
            </div>
            <div className="text-xs font-semibold mb-3" style={{ color: formDistance !== null ? BLUE : INK_SOFT }}>
              {formDistance !== null ? `→ ${formDistance} km gefahren` : "→ Kilometer eintragen für die Differenz"}
            </div>
            <label className="text-xs font-medium block mb-1">Bemerkung (optional)</label>
            <input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="z.B. Einkauf, Arztbesuch" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />

            <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
              <input type="checkbox" checked={formIsExpense} onChange={(e) => setFormIsExpense(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">Ausgabe (z.B. Tanken, Parken)</span>
            </label>
            {formIsExpense && (
              <input type="number" step="0.01" value={formExpenseAmount} onChange={(e) => setFormExpenseAmount(e.target.value)} placeholder="Betrag in €" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            )}

            {formError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}</div>}
            <button onClick={handleSaveEntry} disabled={saving} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2 mb-2" style={{ backgroundColor: BLUE, opacity: saving ? 0.7 : 1 }}>
              {saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Speichern…" : editingEntry ? "Änderungen speichern" : "Eintragen"}
            </button>
            {editingEntry && (
              <button onClick={handleDeleteEntry} disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2" style={{ color: "#A13D3D", border: "1.5px solid #E0B8B8" }}>
                <Trash2 size={14} /> Eintrag löschen
              </button>
            )}
          </div>
        </div>
      )}

      {showCarForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowCarForm(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Fahrzeuge</h2><button onClick={() => setShowCarForm(false)}><X size={20} /></button></div>

            {cars.length > 0 && (
              <div className="mb-4 flex flex-col gap-1.5">
                {cars.map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    {carRenameId === c.id ? (
                      <input
                        autoFocus
                        value={carRenameName}
                        onChange={(e) => setCarRenameName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRenameCar(c.id)}
                        onBlur={() => handleRenameCar(c.id)}
                        className="flex-1 rounded-lg px-2 py-1.5 text-sm border"
                        style={{ borderColor: "#D8D5C7" }}
                      />
                    ) : (
                      <span className="flex-1 text-sm font-medium">{c.name}</span>
                    )}
                    <button onClick={() => { setCarRenameId(c.id); setCarRenameName(c.name); }}><Pencil size={14} style={{ color: "#B8B4A2" }} /></button>
                    <button onClick={() => handleDeleteCar(c.id, c.name)}><Trash2 size={14} style={{ color: "#B8B4A2" }} /></button>
                  </div>
                ))}
              </div>
            )}

            <label className="text-xs font-medium block mb-1">Neues Fahrzeug</label>
            <input value={newCarName} onChange={(e) => setNewCarName(e.target.value)} placeholder="z.B. Zoe 2" className="w-full rounded-lg px-3 py-2.5 mb-4 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            <button onClick={handleAddCar} disabled={savingCar} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: INK, opacity: savingCar ? 0.7 : 1 }}>
              {savingCar && <Loader2 size={15} className="animate-spin" />} {savingCar ? "Speichern…" : "Hinzufügen"}
            </button>
          </div>
        </div>
      )}

      {showRangePicker && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowRangePicker(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">{pickerMode === "export" ? "Zeitraum für Export" : "Zeitraum wählen"}</h2><button onClick={() => setShowRangePicker(false)}><X size={20} /></button></div>

            {pickerMode === "export" && (
              <>
                <label className="text-xs font-medium block mb-2">Fahrzeuge in der CSV</label>
                <div className="flex gap-2 flex-wrap mb-4">
                  {cars.map((c) => (
                    <button key={c.id} onClick={() => toggleExportCar(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: exportCarIds.includes(c.id) ? BLUE : "transparent", color: exportCarIds.includes(c.id) ? "#fff" : INK_SOFT, border: `1.5px solid ${exportCarIds.includes(c.id) ? BLUE : "#D8D5C7"}` }}>{c.name}</button>
                  ))}
                </div>
              </>
            )}

            <button onClick={() => applyRange(month0, month1)} className="w-full rounded-lg py-2.5 mb-2 text-sm font-semibold border text-left px-3" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}>{currentMonthLabel()} (aktuell)</button>
            <button onClick={() => applyRange(quarter0, quarter1)} className="w-full rounded-lg py-2.5 mb-2 text-sm font-semibold border text-left px-3" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}>{currentQuarterLabel()} (aktuell)</button>
            <button onClick={() => applyRange("2000-01-01", "2100-01-01")} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold border text-left px-3" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}>Alles anzeigen</button>
            <label className="text-xs font-medium block mb-1">Eigener Zeitraum</label>
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <label className="text-xs block mb-1" style={{ color: INK_SOFT }}>Von</label>
                <input type="date" value={rangeFromInput} onChange={(e) => setRangeFromInput(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
              </div>
              <div className="flex-1">
                <label className="text-xs block mb-1" style={{ color: INK_SOFT }}>Bis</label>
                <input type="date" value={rangeToInput} onChange={(e) => setRangeToInput(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
              </div>
            </div>
            <button onClick={() => applyRange(rangeFromInput, rangeToInput)} className="w-full rounded-lg py-3 font-semibold text-sm text-white" style={{ backgroundColor: BLUE }}>{pickerMode === "export" ? "Exportieren" : "Anwenden"}</button>
          </div>
        </div>
      )}

      {showStats && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowStats(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1"><h2 className="font-bold text-lg">Statistiken</h2><button onClick={() => setShowStats(false)}><X size={20} /></button></div>
            <p className="text-xs mb-4" style={{ color: INK_SOFT }}>Gesamt gefahrene Kilometer, alle Zeit.</p>
            {statsRows.length === 0 && <p className="text-sm" style={{ color: INK_SOFT }}>Noch keine Fahrten eingetragen.</p>}
            <div className="space-y-3">
              {statsRows.map(([driver, s]) => (
                <div key={driver} className="rounded-lg px-3.5 py-3" style={{ backgroundColor: "#fff" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold">{driver}</span>
                    <span className="text-sm font-bold" style={{ color: BLUE }}>{s.total} km</span>
                  </div>
                  {Object.entries(s.byCar).map(([car, km]) => (
                    <div key={car} className="flex items-center justify-between text-xs" style={{ color: INK_SOFT }}>
                      <span>{car}</span>
                      <span>{km} km</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showAccount && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowAccount(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
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
    </div>
  );
}
