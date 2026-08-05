import React, { useState, useEffect, useMemo } from "react";
import {
  Home, Plus, X, AlertCircle, AlertTriangle, Loader2, MapPin, Tag, Camera,
  MessageSquare, Lock, Trash2, Pencil, ChevronRight, Check, Clock, Wrench,
  CheckCircle2, Ban, User as UserIcon, Calendar, HelpCircle,
} from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";

const APP_KEY = "schadenmelder";

const PAPER = "#F1F0EA";
const INK = "#2B2B26";
const INK_SOFT = "#6B6A61";
const BORDER_SOFT = "#D8D5C7";
const ACCENT = "#C2410C";

// --- Status ---------------------------------------------------------------
// Fuenf Hauptstufen im Ablauf + Nebenstatus "abgelehnt".
const STATUS_FLOW = ["gemeldet", "begutachtung", "freigegeben", "behebung", "erledigt"];
const STATUS_META = {
  gemeldet:     { label: "Gemeldet",                 short: "Gemeldet",     color: "#6B6A61" },
  begutachtung: { label: "In Begutachtung",          short: "Begutachtung", color: "#2E86AB" },
  freigegeben:  { label: "Zur Behebung freigegeben", short: "Freigegeben",  color: "#6C63A6" },
  behebung:     { label: "In Behebung",              short: "In Behebung",  color: "#C2410C" },
  erledigt:     { label: "Erledigt",                 short: "Erledigt",     color: "#2E7D4F" },
  abgelehnt:    { label: "Abgelehnt / kein Schaden", short: "Abgelehnt",    color: "#A13D3D" },
};

const CATEGORIES = ["Sanitär", "Heizung", "Dach", "Gebäude", "Fenster", "Wohnung", "Lüftungsanlage", "Elektrik", "Schließanlage", "Außenanlage", "Sonstige"];

const PRIORITIES = {
  niedrig: { label: "Niedrig", color: "#6B6A61" },
  mittel:  { label: "Mittel",  color: "#C79A3A" },
  hoch:    { label: "Hoch",    color: "#A13D3D" },
};

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

function fmtDateLong(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d}. ${MONTH_NAMES[m - 1]} ${y}`;
}
function fmtWhen(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function uploadPhoto(ticketId, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `schaden/${ticketId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, filename: file.name };
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

  return <SchadenApp session={session} />;
}

// =====================================================================
function SchadenApp({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
  const initial = userName.charAt(0).toUpperCase();

  const isAdmin = user.user_metadata?.is_admin === true;
  const isSuperAdmin = user.user_metadata?.is_superadmin === true;
  const [myModApps, setMyModApps] = useState([]);
  const isElevated = isAdmin || isSuperAdmin || myModApps.includes(APP_KEY);

  const [tickets, setTickets] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [comments, setComments] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState("offen"); // offen | alle | erledigt | abgelehnt | <status>
  const [filterCategory, setFilterCategory] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  // --- Ziel-Postfach für neue Meldungen (nur Superadmin) ---
  const [notifyTo, setNotifyTo] = useState("");
  const [savingNotifyTo, setSavingNotifyTo] = useState(false);
  const [notifyToSaved, setNotifyToSaved] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    supabase
      .from("mail_settings")
      .select("schaden_notify_to")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => setNotifyTo(data?.schaden_notify_to || ""))
      .catch(() => {});
  }, [isSuperAdmin]);

  async function saveNotifyTo() {
    setSavingNotifyTo(true);
    setNotifyToSaved(false);
    try {
      const { error } = await supabase
        .from("mail_settings")
        .update({ schaden_notify_to: notifyTo.trim() || null, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
      setNotifyToSaved(true);
      setTimeout(() => setNotifyToSaved(false), 3000);
    } catch (e) {
      alert(e.message || "Konnte nicht gespeichert werden.");
    } finally {
      setSavingNotifyTo(false);
    }
  }

  // --- Konto / Profil (einheitlich wie in den anderen Apps) ---
  const [ownMemberId, setOwnMemberId] = useState(null);
  const [ownFotoUrl, setOwnFotoUrl] = useState(null);
  const [ownMember, setOwnMember] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key !== "Escape") return;
      setShowForm(false);
      setShowAccount(false);
      setShowEditProfile(false);
      setShowHelp(false);
      setSelectedId(null);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    supabase.from("members").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setOwnMemberId(data?.id || null);
      setOwnFotoUrl(data?.foto_url || null);
      setOwnMember(data || null);
    });
  }, [user.id]);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [tk, ph, co, ev, mods] = await Promise.all([
      supabase.from("schaden_tickets").select("*").order("created_at", { ascending: false }),
      supabase.from("schaden_photos").select("*").order("created_at"),
      supabase.from("schaden_comments").select("*").order("created_at"),
      supabase.from("schaden_events").select("*").order("created_at"),
      supabase.from("app_moderators").select("app_key").eq("user_id", user.id),
    ]);
    setTickets(tk.data || []);
    setPhotos(ph.data || []);
    setComments(co.data || []);
    setEvents(ev.data || []);
    setMyModApps((mods.data || []).map((r) => r.app_key));
    setLoading(false);
  }

  const photosFor = (id) => photos.filter((p) => p.ticket_id === id);
  const commentsFor = (id) => comments.filter((c) => c.ticket_id === id);
  const eventsFor = (id) => events.filter((e) => e.ticket_id === id);

  const selected = tickets.find((t) => t.id === selectedId) || null;

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (filterCategory && t.category !== filterCategory) return false;
      if (filterStatus === "alle") return true;
      if (filterStatus === "offen") return t.status !== "erledigt" && t.status !== "abgelehnt";
      if (filterStatus === "erledigt") return t.status === "erledigt";
      if (filterStatus === "abgelehnt") return t.status === "abgelehnt";
      return t.status === filterStatus;
    });
  }, [tickets, filterStatus, filterCategory]);

  const openCount = tickets.filter((t) => t.status !== "erledigt" && t.status !== "abgelehnt").length;

  // ---- Aktionen ----
  async function logEvent(ticketId, kind, detail) {
    try {
      await supabase.from("schaden_events").insert({
        ticket_id: ticketId, kind, detail, created_by: user.id, created_by_name: userName,
      });
    } catch (_) { /* Log-Fehler nicht blockierend */ }
  }

  async function updateTicket(ticket, patch, eventKind, eventDetail) {
    try {
      const { error } = await supabase
        .from("schaden_tickets")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
      if (error) throw error;
      if (eventKind && eventDetail) await logEvent(ticket.id, eventKind, eventDetail);
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht gespeichert werden.");
    }
  }

  async function handleAddComment(ticketId, body, isInternal) {
    try {
      const { error } = await supabase.from("schaden_comments").insert({
        ticket_id: ticketId, body, is_internal: isInternal,
        created_by: user.id, created_by_name: userName,
      });
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message || "Kommentar konnte nicht gespeichert werden.");
    }
  }

  async function handleDeleteComment(c) {
    if (!window.confirm("Diesen Kommentar wirklich löschen?")) return;
    try {
      await supabase.from("schaden_comments").delete().eq("id", c.id);
      await loadAll();
    } catch (e) { alert(e.message || "Konnte nicht gelöscht werden."); }
  }

  async function handleUploadPhotos(ticketId, files) {
    try {
      for (const file of files) {
        const { url, filename } = await uploadPhoto(ticketId, file);
        await supabase.from("schaden_photos").insert({ ticket_id: ticketId, url, filename, created_by: user.id });
      }
      await logEvent(ticketId, "field", `${files.length === 1 ? "Ein Foto" : files.length + " Fotos"} hinzugefügt`);
      await loadAll();
    } catch (e) { alert(e.message || "Foto-Upload fehlgeschlagen."); }
  }

  async function handleDeletePhoto(p) {
    if (!window.confirm("Dieses Foto wirklich entfernen?")) return;
    try {
      await supabase.from("schaden_photos").delete().eq("id", p.id);
      await loadAll();
    } catch (e) { alert(e.message || "Konnte nicht entfernt werden."); }
  }

  async function handleDeleteTicket(t) {
    if (!window.confirm(`Meldung „${t.title}" wirklich löschen? Fotos, Kommentare und Verlauf gehen dabei mit verloren. Das kann nicht rückgängig gemacht werden.`)) return;
    try {
      await supabase.from("schaden_tickets").delete().eq("id", t.id);
      setSelectedId(null);
      await loadAll();
    } catch (e) { alert(e.message || "Konnte nicht gelöscht werden."); }
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: PAPER }}>
        <Loader2 className="animate-spin" size={24} style={{ color: INK_SOFT }} />
      </div>
    );
  }

  const STATUS_FILTERS = [
    { key: "offen", label: `Offen (${openCount})` },
    { key: "alle", label: "Alle" },
    { key: "erledigt", label: "Erledigt" },
    { key: "abgelehnt", label: "Abgelehnt" },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAPER, color: INK }}>
      <div className="max-w-3xl mx-auto lg:max-w-none lg:w-2/3 lg:mx-auto px-4 sm:px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5 sticky top-0 z-30 pb-2" style={{ backgroundColor: PAPER }}>
          <a href="/" className="flex items-center gap-2.5">
            <img src="/schadenmelder/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
            <h1 className="font-bold text-lg lg:text-2xl">Schadenmelder</h1>
          </a>
          <div className="flex items-center gap-2">
            <span className="text-xs lg:text-sm font-bold truncate max-w-[110px] lg:max-w-[180px]" style={{ color: INK_SOFT }}>Hallo {ownMember?.spitzname || ownMember?.vorname || userName}</span>
            <button onClick={() => setShowAccount(true)} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>{ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}</button>
            <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
          </div>
        </div>

        {/* Aktion + Filter */}
        <div className="mb-4 flex items-center gap-2">
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: ACCENT }}>
            <Plus size={14} /> Schaden melden
          </button>
          <button onClick={() => setShowHelp(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
            <HelpCircle size={14} /> Hilfe
          </button>
        </div>

        {/* Ziel-Postfach (nur Superadmin) */}
        {isSuperAdmin && (
          <div className="rounded-lg p-3 mb-4" style={{ backgroundColor: "#fff", border: `1px solid ${BORDER_SOFT}` }}>
            <label className="text-xs font-semibold block mb-1.5" style={{ color: INK }}>
              Ziel-Postfach für neue Meldungen (Superadmin)
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={notifyTo}
                onChange={(e) => { setNotifyTo(e.target.value); setNotifyToSaved(false); }}
                placeholder="z.B. schaden@nawodo.de"
                className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm border"
                style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
              />
              <button
                onClick={saveNotifyTo}
                disabled={savingNotifyTo}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: INK, opacity: savingNotifyTo ? 0.6 : 1 }}
              >
                {savingNotifyTo && <Loader2 size={14} className="animate-spin" />} Speichern
              </button>
              {notifyToSaved && (
                <span className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: "#2E7D4F" }}>
                  <Check size={13} /> Gespeichert.
                </span>
              )}
            </div>
            <p className="text-[11px] mt-1.5" style={{ color: INK_SOFT }}>
              Hier gehen neue Schadensmeldungen als E-Mail hin. Absender/SMTP wird zentral in Settings → E-Mail gepflegt.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold"
              style={filterStatus === f.key
                ? { backgroundColor: INK, color: "#fff" }
                : { border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
            >
              {f.label}
            </button>
          ))}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border ml-auto"
            style={{ borderColor: BORDER_SOFT, color: INK_SOFT, backgroundColor: "#fff" }}
          >
            <option value="">Alle Kategorien</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}>
            <Wrench className="mx-auto mb-2" size={26} style={{ color: INK_SOFT }} />
            <p className="text-sm" style={{ color: INK_SOFT }}>Keine Meldungen in dieser Ansicht.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((t) => (
              <TicketCard
                key={t.id}
                t={t}
                photoCount={photosFor(t.id).length}
                commentCount={commentsFor(t.id).filter((c) => !c.is_internal || isElevated).length}
                onOpen={() => setSelectedId(t.id)}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <ReportForm
          userId={user.id}
          userName={userName}
          onClose={() => setShowForm(false)}
          onCreated={async (ticket, files) => {
            // Erst-Event + Fotos
            await logEvent(ticket.id, "created", "Schaden gemeldet");
            if (files.length) {
              try {
                for (const file of files) {
                  const { url, filename } = await uploadPhoto(ticket.id, file);
                  await supabase.from("schaden_photos").insert({ ticket_id: ticket.id, url, filename, created_by: user.id });
                }
              } catch (_) { /* Foto-Fehler nicht blockierend */ }
            }
            // Info-Mail an das Schadensmeldungs-Postfach (best effort; tut nichts, solange
            // in der Edge Function keine SMTP-Zugangsdaten hinterlegt sind).
            try {
              await fetch(`${window.__SUPABASE_URL__}/functions/v1/schaden-notify`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ ticket_id: ticket.id }),
              });
            } catch (_) { /* Mail-Fehler nie blockierend */ }
            setShowForm(false);
            await loadAll();
            setSelectedId(ticket.id);
          }}
        />
      )}

      {selected && (
        <TicketDetail
          key={selected.id}
          ticket={selected}
          photos={photosFor(selected.id)}
          comments={commentsFor(selected.id)}
          events={eventsFor(selected.id)}
          isElevated={isElevated}
          userId={user.id}
          canManage={isElevated || selected.created_by === user.id}
          onClose={() => setSelectedId(null)}
          onUpdate={updateTicket}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onUploadPhotos={handleUploadPhotos}
          onDeletePhoto={handleDeletePhoto}
          onDeleteTicket={handleDeleteTicket}
        />
      )}

      {showHelp && (
        <Modal onClose={() => setShowHelp(false)} maxW="max-w-lg">
          <div className="flex items-start justify-between mb-4 gap-3">
            <h2 className="font-bold text-lg leading-tight" style={{ color: INK }}>So meldest du einen Schaden</h2>
            <button onClick={() => setShowHelp(false)} className="flex-shrink-0"><X size={20} /></button>
          </div>
          <p className="text-sm mb-4" style={{ color: INK_SOFT }}>In wenigen Schritten ist ein Schaden gemeldet:</p>
          <ol className="list-decimal pl-5 flex flex-col gap-2 text-sm mb-4" style={{ color: INK }}>
            <li>Tippe oben auf „Schaden melden".</li>
            <li>Gib einen kurzen, klaren Titel ein (z. B. „Wasserhahn tropft, 2. OG").</li>
            <li>Beschreibe den Schaden möglichst genau.</li>
            <li>Wähle den Ort im Gebäude und die passende Kategorie.</li>
            <li>Füge – wenn möglich – ein oder mehrere Fotos hinzu.</li>
            <li>Tippe auf „Schaden melden". Fertig!</li>
          </ol>
          <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: "#E9E6D9", color: INK }}>
            Das Schadenmelder-Team erhält deine Meldung (auch per E-Mail) und kümmert sich darum. Du und alle anderen Mitglieder können den Fortschritt jederzeit verfolgen – von „Gemeldet" über „In Begutachtung" bis „Erledigt". Rückfragen stellst du direkt als Kommentar an der Meldung.
          </div>
          <button onClick={() => setShowHelp(false)} className="w-full rounded-lg py-3 mt-4 font-semibold text-sm text-white" style={{ backgroundColor: ACCENT }}>
            Verstanden
          </button>
        </Modal>
      )}

      {showAccount && (
        <AccountModal
          session={session} user={user} userName={userName} initial={initial}
          ownMemberId={ownMemberId} ownFotoUrl={ownFotoUrl} setOwnFotoUrl={setOwnFotoUrl} setOwnMemberId={setOwnMemberId}
          isAdmin={isAdmin}
          onClose={() => setShowAccount(false)}
          onEditProfile={() => { setShowAccount(false); setShowEditProfile(true); }}
        />
      )}

      {showEditProfile && (
        <EditProfileModal
          session={session} user={user} userName={userName}
          ownMember={ownMember} ownMemberId={ownMemberId}
          setOwnMember={setOwnMember} setOwnMemberId={setOwnMemberId}
          onClose={() => setShowEditProfile(false)}
        />
      )}
    </div>
  );
}

// =====================================================================
function StatusBadge({ status, size = "sm" }) {
  const meta = STATUS_META[status] || STATUS_META.gemeldet;
  const pad = size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold ${pad}`} style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}>
      {status === "erledigt" ? <CheckCircle2 size={12} /> : status === "abgelehnt" ? <Ban size={12} /> : <Clock size={12} />}
      {meta.label}
    </span>
  );
}

function PriorityBadge({ priority }) {
  if (!priority) return null;
  const meta = PRIORITIES[priority];
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ backgroundColor: `${meta.color}1A`, color: meta.color }}>
      <AlertTriangle size={11} /> {meta.label}
    </span>
  );
}

function StatusStepper({ status }) {
  const rejected = status === "abgelehnt";
  const currentIdx = STATUS_FLOW.indexOf(status);
  return (
    <div>
      <div className="flex items-center">
        {STATUS_FLOW.map((s, i) => {
          const meta = STATUS_META[s];
          const done = !rejected && i <= currentIdx;
          const isCurrent = !rejected && i === currentIdx;
          return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center" style={{ minWidth: 0, flex: "0 0 auto" }}>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{
                    backgroundColor: done ? meta.color : "#E4E1D3",
                    color: done ? "#fff" : INK_SOFT,
                    outline: isCurrent ? `2px solid ${meta.color}` : "none",
                    outlineOffset: 2,
                  }}
                >
                  {done && !isCurrent ? <Check size={13} /> : i + 1}
                </div>
                <span className="text-[9px] mt-1 text-center leading-tight" style={{ color: isCurrent ? meta.color : INK_SOFT, maxWidth: 60 }}>{meta.short}</span>
              </div>
              {i < STATUS_FLOW.length - 1 && (
                <div className="h-0.5 flex-1 mx-1 mb-4" style={{ backgroundColor: !rejected && i < currentIdx ? STATUS_META[STATUS_FLOW[i + 1]].color : "#E4E1D3" }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {rejected && (
        <div className="mt-2 flex items-center gap-1.5 text-sm font-bold" style={{ color: STATUS_META.abgelehnt.color }}>
          <Ban size={15} /> Abgelehnt / kein Schaden
        </div>
      )}
    </div>
  );
}

function TicketCard({ t, photoCount, commentCount, onOpen }) {
  const meta = STATUS_META[t.status] || STATUS_META.gemeldet;
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-xl p-3.5 sm:p-4 flex items-start gap-3"
      style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", borderLeft: `4px solid ${meta.color}` }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
        </div>
        <div className="font-semibold text-sm sm:text-base truncate">{t.title}</div>
        <div className="flex items-center gap-3 mt-1 text-xs flex-wrap" style={{ color: INK_SOFT }}>
          {t.category && <span className="inline-flex items-center gap-1"><Tag size={11} /> {t.category}</span>}
          {t.location && <span className="inline-flex items-center gap-1 truncate"><MapPin size={11} /> {t.location}</span>}
          {photoCount > 0 && <span className="inline-flex items-center gap-1"><Camera size={11} /> {photoCount}</span>}
          {commentCount > 0 && <span className="inline-flex items-center gap-1"><MessageSquare size={11} /> {commentCount}</span>}
        </div>
        <div className="text-[11px] mt-1" style={{ color: INK_SOFT }}>
          {t.created_by_name || "Unbekannt"} · {fmtWhen(t.created_at)}
        </div>
      </div>
      <ChevronRight size={18} style={{ color: INK_SOFT }} className="flex-shrink-0 mt-1" />
    </button>
  );
}

// =====================================================================
function ReportForm({ userId, userName, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!title.trim()) return setError("Bitte gib der Meldung einen kurzen Titel.");
    setSaving(true);
    try {
      const { data, error: insErr } = await supabase.from("schaden_tickets").insert({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        category,
        status: "gemeldet",
        created_by: userId,
        created_by_name: userName,
      }).select().single();
      if (insErr) throw insErr;
      await onCreated(data, files);
    } catch (e) {
      setError(e.message || "Konnte nicht gespeichert werden.");
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} maxW="max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg">Schaden melden</h2>
        <button onClick={onClose}><X size={20} /></button>
      </div>

      <label className="text-xs font-medium block mb-1">Titel / Was ist kaputt?</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Wasserhahn im Waschkeller tropft" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

      <label className="text-xs font-medium block mb-1">Beschreibung</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Was ist passiert? Seit wann? Weitere Details…" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-xs font-medium block mb-1">Ort im Gebäude</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="z.B. Treppenhaus 2. OG" className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">Kategorie</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <label className="text-xs font-medium block mb-1">Fotos (optional)</label>
      <input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} className="w-full text-sm mb-1" />
      {files.length > 0 && <p className="text-xs mb-3" style={{ color: INK_SOFT }}>{files.length} {files.length === 1 ? "Foto" : "Fotos"} ausgewählt</p>}

      {error && <div className="flex items-start gap-2 text-sm mb-3 mt-2 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {error}</div>}

      <button onClick={handleSubmit} disabled={saving} className="w-full rounded-lg py-3 mt-2 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: ACCENT, opacity: saving ? 0.7 : 1 }}>
        {saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Wird gemeldet…" : "Schaden melden"}
      </button>
    </Modal>
  );
}

// =====================================================================
function TicketDetail({
  ticket, photos, comments, events, isElevated, userId, canManage,
  onClose, onUpdate, onAddComment, onDeleteComment, onUploadPhotos, onDeletePhoto, onDeleteTicket,
}) {
  const [commentText, setCommentText] = useState("");
  const [commentInternal, setCommentInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [rejectReason, setRejectReason] = useState(ticket.reject_reason || "");
  const [handwerkerInfo, setHandwerkerInfo] = useState(ticket.handwerker_info || "");
  const [selbstPerson, setSelbstPerson] = useState(ticket.selbstreparatur_person || "");
  const [showTeam, setShowTeam] = useState(true);

  // Aktivitäts-Feed: öffentliche/interne Kommentare + Events, chronologisch.
  const feed = useMemo(() => {
    const items = [
      ...comments.map((c) => ({ type: "comment", at: c.created_at, data: c })),
      ...events.map((e) => ({ type: "event", at: e.created_at, data: e })),
    ];
    items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    return items;
  }, [comments, events]);

  async function submitComment() {
    if (!commentText.trim()) return;
    setSending(true);
    await onAddComment(ticket.id, commentText.trim(), commentInternal && isElevated);
    setCommentText("");
    setCommentInternal(false);
    setSending(false);
  }

  async function changeStatus(newStatus) {
    if (newStatus === ticket.status) return;
    // Einen Schritt zurück (oder eine erledigte/abgelehnte Meldung wieder aktivieren)
    // nur nach ausdrücklicher Bestätigung.
    const curIdx = STATUS_FLOW.indexOf(ticket.status);
    const newIdx = STATUS_FLOW.indexOf(newStatus);
    const goingBack =
      (curIdx !== -1 && newIdx !== -1 && newIdx < curIdx) ||
      (ticket.status === "abgelehnt" && newStatus !== "abgelehnt");
    if (goingBack) {
      const ok = window.confirm(
        `Meldung von „${STATUS_META[ticket.status].label}" auf „${STATUS_META[newStatus].label}" zurücksetzen?`
      );
      if (!ok) return;
    }
    if (newStatus === "abgelehnt") {
      const reason = (rejectReason || "").trim();
      await onUpdate(ticket, { status: "abgelehnt", reject_reason: reason || null }, "status",
        `Status: Abgelehnt / kein Schaden${reason ? " – " + reason : ""}`);
      return;
    }
    await onUpdate(ticket, { status: newStatus }, "status", `Status: ${STATUS_META[newStatus].label}`);
  }

  async function setPriority(p) {
    await onUpdate(ticket, { priority: p }, "priority", `Priorität: ${PRIORITIES[p].label}`);
  }
  async function setRepairMode(mode) {
    const patch = { repair_mode: mode };
    if (mode !== "eigenleistung") patch.resources_available = null;
    await onUpdate(ticket, patch, "field", `Behebungsweg: ${mode === "eigenleistung" ? "Eigenleistung" : "Handwerker"}`);
  }

  return (
    <Modal onClose={onClose} maxW="max-w-2xl">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-lg leading-tight">{ticket.title}</h2>
          <div className="text-[11px] mt-1" style={{ color: INK_SOFT }}>
            {ticket.created_by_name || "Unbekannt"} · {fmtWhen(ticket.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canManage && (
            <button onClick={() => onDeleteTicket(ticket)} title="Meldung löschen"><Trash2 size={16} style={{ color: "#B8B4A2" }} /></button>
          )}
          <button onClick={onClose}><X size={20} /></button>
        </div>
      </div>

      {/* Status-Stepper */}
      <div className="rounded-xl p-3.5 mb-3" style={{ backgroundColor: "#fff", border: `1px solid ${BORDER_SOFT}` }}>
        <StatusStepper status={ticket.status} />
      </div>

      {/* Meta */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <PriorityBadge priority={ticket.priority} />
        {ticket.category && <span className="inline-flex items-center gap-1 text-xs" style={{ color: INK_SOFT }}><Tag size={12} /> {ticket.category}</span>}
        {ticket.location && <span className="inline-flex items-center gap-1 text-xs" style={{ color: INK_SOFT }}><MapPin size={12} /> {ticket.location}</span>}
        {ticket.inspection_date && <span className="inline-flex items-center gap-1 text-xs" style={{ color: INK_SOFT }}><Calendar size={12} /> Begutachtung: {fmtDateLong(ticket.inspection_date)}</span>}
        {ticket.umsetzung_termin && <span className="inline-flex items-center gap-1 text-xs" style={{ color: INK_SOFT }}><Calendar size={12} /> Termin: {fmtDateLong(ticket.umsetzung_termin)}</span>}
      </div>

      {ticket.description && (
        <p className="text-sm whitespace-pre-wrap mb-3">{ticket.description}</p>
      )}

      {/* Behebungs-Info (für alle sichtbar, sobald gesetzt) */}
      {(ticket.repair_mode || ticket.reject_reason) && (
        <div className="rounded-lg p-3 mb-3 text-sm" style={{ backgroundColor: "#E9E6D9" }}>
          {ticket.repair_mode === "eigenleistung" && (
            <div className="flex items-center gap-1.5"><Wrench size={13} /> Behebung in Eigenleistung
              {ticket.resources_available === true && " · Material/Ressourcen vorhanden"}
              {ticket.resources_available === false && " · Material/Ressourcen fehlen noch"}
              {ticket.selbstreparatur_person && ` · repariert von: ${ticket.selbstreparatur_person}`}
            </div>
          )}
          {ticket.repair_mode === "handwerker" && (
            <div className="flex items-center gap-1.5"><Wrench size={13} /> Behebung durch Handwerker{ticket.handwerker_info ? `: ${ticket.handwerker_info}` : " (über Verwaltungsgruppe)"}</div>
          )}
          {ticket.reject_reason && (
            <div className="flex items-start gap-1.5 mt-1" style={{ color: STATUS_META.abgelehnt.color }}><Ban size={13} className="mt-0.5" /> {ticket.reject_reason}</div>
          )}
        </div>
      )}

      {/* Fotos */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Fotos</div>
          <label className="flex items-center gap-1 text-xs font-semibold cursor-pointer" style={{ color: ACCENT }}>
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />} Foto hinzufügen
            <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
              onChange={async (e) => {
                const fs = Array.from(e.target.files || []);
                if (!fs.length) return;
                setUploading(true);
                await onUploadPhotos(ticket.id, fs);
                setUploading(false);
              }} />
          </label>
        </div>
        {photos.length === 0 ? (
          <p className="text-xs" style={{ color: INK_SOFT }}>Noch keine Fotos.</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative group">
                <a href={p.url} target="_blank" rel="noreferrer">
                  <img src={p.url} alt={p.filename || ""} className="w-full h-20 object-cover rounded-lg" style={{ border: `1px solid ${BORDER_SOFT}` }} />
                </a>
                {(isElevated || p.created_by === userId) && (
                  <button onClick={() => onDeletePhoto(p)} className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
                    <Trash2 size={11} color="#fff" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Team-Panel */}
      {isElevated && (
        <div className="rounded-xl p-3.5 mb-3" style={{ backgroundColor: "#fff", border: `1.5px solid ${ACCENT}33` }}>
          <button onClick={() => setShowTeam((v) => !v)} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-2" style={{ color: ACCENT }}>
            <Wrench size={13} /> Bearbeitung (Team) {showTeam ? "▾" : "▸"}
          </button>
          {showTeam && (
            <div className="flex flex-col gap-3">
              {/* Status */}
              <div>
                <div className="text-[11px] font-semibold mb-1" style={{ color: INK_SOFT }}>Status setzen</div>
                <div className="flex flex-wrap gap-1.5">
                  {[...STATUS_FLOW, "abgelehnt"].map((s) => {
                    const meta = STATUS_META[s];
                    const active = ticket.status === s;
                    return (
                      <button key={s} onClick={() => changeStatus(s)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={active ? { backgroundColor: meta.color, color: "#fff" } : { border: `1.5px solid ${meta.color}55`, color: meta.color }}>
                        {meta.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Priorität */}
              <div>
                <div className="text-[11px] font-semibold mb-1" style={{ color: INK_SOFT }}>Priorität</div>
                <div className="flex gap-1.5">
                  {Object.entries(PRIORITIES).map(([k, meta]) => {
                    const active = ticket.priority === k;
                    return (
                      <button key={k} onClick={() => setPriority(k)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        style={active ? { backgroundColor: meta.color, color: "#fff" } : { border: `1.5px solid ${meta.color}55`, color: meta.color }}>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Begutachtungstermin */}
              <div>
                <div className="text-[11px] font-semibold mb-1" style={{ color: INK_SOFT }}>Begutachtungstermin</div>
                <input type="date" value={ticket.inspection_date || ""} onChange={(e) => onUpdate(ticket, { inspection_date: e.target.value || null }, "field", e.target.value ? `Begutachtungstermin: ${fmtDateLong(e.target.value)}` : "Begutachtungstermin entfernt")} className="rounded-lg px-3 py-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>

              {/* Termin für Umsetzung / Handwerker / Bestellung (Schritt Freigabe/Behebung) */}
              <div>
                <div className="text-[11px] font-semibold mb-1" style={{ color: INK_SOFT }}>Termin (Umsetzung / Handwerker)</div>
                <input type="date" value={ticket.umsetzung_termin || ""} onChange={(e) => onUpdate(ticket, { umsetzung_termin: e.target.value || null }, "field", e.target.value ? `Umsetzungstermin: ${fmtDateLong(e.target.value)}` : "Umsetzungstermin entfernt")} className="rounded-lg px-3 py-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>

              {/* Behebungsweg */}
              <div>
                <div className="text-[11px] font-semibold mb-1" style={{ color: INK_SOFT }}>Behebungsweg</div>
                <div className="flex gap-1.5 mb-2">
                  <button onClick={() => setRepairMode("eigenleistung")} className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={ticket.repair_mode === "eigenleistung" ? { backgroundColor: INK, color: "#fff" } : { border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>Eigenleistung</button>
                  <button onClick={() => setRepairMode("handwerker")} className="px-2.5 py-1 rounded-full text-[11px] font-semibold" style={ticket.repair_mode === "handwerker" ? { backgroundColor: INK, color: "#fff" } : { border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>Handwerker</button>
                </div>
                {ticket.repair_mode === "eigenleistung" && (
                  <>
                    <div className="flex items-center gap-2 text-[11px] mb-2" style={{ color: INK_SOFT }}>
                      <span>Ressourcen NaWoDo vorhanden?</span>
                      <button onClick={() => onUpdate(ticket, { resources_available: true }, "field", "Ressourcen vorhanden: Ja")} className="px-2 py-0.5 rounded-full font-semibold" style={ticket.resources_available === true ? { backgroundColor: "#2E7D4F", color: "#fff" } : { border: `1px solid ${BORDER_SOFT}` }}>Ja</button>
                      <button onClick={() => onUpdate(ticket, { resources_available: false }, "field", "Ressourcen vorhanden: Nein")} className="px-2 py-0.5 rounded-full font-semibold" style={ticket.resources_available === false ? { backgroundColor: "#A13D3D", color: "#fff" } : { border: `1px solid ${BORDER_SOFT}` }}>Nein</button>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold mb-1" style={{ color: INK_SOFT }}>Selbstreparatur: wer repariert?</div>
                      <div className="flex gap-2">
                        <input value={selbstPerson} onChange={(e) => setSelbstPerson(e.target.value)} placeholder="Name des Bewohners / der Bewohnerin" className="flex-1 rounded-lg px-3 py-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
                        <button onClick={() => onUpdate(ticket, { selbstreparatur_person: selbstPerson.trim() || null }, "field", selbstPerson.trim() ? `Selbstreparatur durch: ${selbstPerson.trim()}` : "Selbstreparatur-Person entfernt")} className="px-3 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: INK }}>Speichern</button>
                      </div>
                    </div>
                  </>
                )}
                {ticket.repair_mode === "handwerker" && (
                  <div className="flex gap-2">
                    <input value={handwerkerInfo} onChange={(e) => setHandwerkerInfo(e.target.value)} placeholder="Firma / Kontakt / Notiz" className="flex-1 rounded-lg px-3 py-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
                    <button onClick={() => onUpdate(ticket, { handwerker_info: handwerkerInfo.trim() || null }, "field", "Handwerker-Info aktualisiert")} className="px-3 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: INK }}>Speichern</button>
                  </div>
                )}
              </div>

              {/* Ablehnungsgrund */}
              <div>
                <div className="text-[11px] font-semibold mb-1" style={{ color: INK_SOFT }}>Ablehnungsgrund (bei „Abgelehnt")</div>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="Warum wird nichts behoben? (wird beim Ablehnen gespeichert)" className="w-full rounded-lg px-3 py-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aktivität / Kommentare */}
      <div className="mb-3">
        <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: INK_SOFT }}>Verlauf & Kommentare</div>
        <div className="flex flex-col gap-2 mb-3">
          {feed.length === 0 && <p className="text-xs" style={{ color: INK_SOFT }}>Noch keine Einträge.</p>}
          {feed.map((item) => {
            if (item.type === "event") {
              return (
                <div key={"e" + item.data.id} className="flex items-center gap-2 text-[11px] px-1" style={{ color: INK_SOFT }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: BORDER_SOFT }} />
                  <span className="flex-1">{item.data.detail}</span>
                  <span>{item.data.created_by_name} · {fmtWhen(item.data.created_at)}</span>
                </div>
              );
            }
            const c = item.data;
            return (
              <div key={"c" + c.id} className="rounded-lg p-2.5" style={{ backgroundColor: c.is_internal ? "#FBEED9" : "#F4F3EE", border: c.is_internal ? "1px solid #E4C784" : `1px solid ${BORDER_SOFT}` }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  {c.is_internal && <Lock size={11} style={{ color: "#B5842A" }} />}
                  <span className="text-xs font-semibold">{c.created_by_name}</span>
                  {c.is_internal && <span className="text-[10px] font-bold" style={{ color: "#B5842A" }}>· intern</span>}
                  <span className="text-[10px]" style={{ color: INK_SOFT }}>· {fmtWhen(c.created_at)}</span>
                  {(isElevated || c.created_by === userId) && (
                    <button onClick={() => onDeleteComment(c)} className="ml-auto"><Trash2 size={11} style={{ color: "#B8B4A2" }} /></button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            );
          })}
        </div>

        {/* Kommentar schreiben */}
        <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} rows={2} placeholder={commentInternal ? "Interne Team-Notiz…" : "Kommentar schreiben…"} className="w-full rounded-lg px-3 py-2 text-sm border mb-2" style={{ borderColor: commentInternal ? "#E4C784" : BORDER_SOFT, backgroundColor: commentInternal ? "#FBEED9" : "#fff" }} />
        <div className="flex items-center gap-2">
          {isElevated && (
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: INK_SOFT }}>
              <input type="checkbox" checked={commentInternal} onChange={(e) => setCommentInternal(e.target.checked)} />
              <Lock size={12} /> Interne Notiz (nur Team)
            </label>
          )}
          <button onClick={submitComment} disabled={sending || !commentText.trim()} className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: commentInternal ? "#B5842A" : ACCENT, opacity: sending || !commentText.trim() ? 0.6 : 1 }}>
            {sending && <Loader2 size={14} className="animate-spin" />} Senden
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================
// Wiederverwendbares Modal (Backdrop-Klick schließt, Inhalt scrollbar).
function Modal({ children, onClose, maxW = "max-w-lg" }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }}
      onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }}
      onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") onClose(); }}
    >
      <div className={`w-full ${maxW} rounded-2xl p-6 max-h-[88dvh] overflow-y-auto`} style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// =====================================================================
// Konto- und Profil-Modals — identisches Verhalten wie in den anderen Apps.
function AccountModal({ session, user, userName, initial, ownMemberId, ownFotoUrl, setOwnFotoUrl, setOwnMemberId, isAdmin, onClose, onEditProfile }) {
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  async function handleChangePassword() {
    setPasswordError(""); setPasswordSuccess(false);
    if (newPassword.length < 6) return setPasswordError("Mindestens 6 Zeichen.");
    if (newPassword !== newPasswordConfirm) return setPasswordError("Passwörter stimmen nicht überein.");
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess(true); setNewPassword(""); setNewPasswordConfirm("");
    } catch (e) { setPasswordError(e.message || "Konnte nicht geändert werden."); }
    finally { setSavingPassword(false); }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  async function handleAvatarUpload(file) {
    setAvatarError(""); setUploadingAvatar(true);
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
        const { data: inserted, error } = await supabase.from("members")
          .insert({ user_id: user.id, created_by: user.id, is_child: false, vorname: userName, nachname: "", foto_url: data.publicUrl })
          .select().single();
        if (error) throw error;
        setOwnMemberId(inserted.id);
      }
      setOwnFotoUrl(data.publicUrl);
    } catch (e) { setAvatarError(e.message || "Foto konnte nicht hochgeladen werden."); }
    finally { setUploadingAvatar(false); }
  }

  return (
    <Modal onClose={onClose} maxW="max-w-md">
      <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Konto</h2><button onClick={onClose}><X size={20} /></button></div>
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
      <button onClick={onEditProfile} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold flex items-center justify-center gap-2" style={{ border: "1.5px solid #D8D5C7", color: INK }}>
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
    </Modal>
  );
}

function EditProfileModal({ session, user, userName, ownMember, ownMemberId, setOwnMember, setOwnMemberId, onClose }) {
  const [epVorname, setEpVorname] = useState(ownMember?.vorname || "");
  const [epNachname, setEpNachname] = useState(ownMember?.nachname || "");
  const [epSpitzname, setEpSpitzname] = useState(ownMember?.spitzname || "");
  const [epStrasse, setEpStrasse] = useState(ownMember?.strasse || "");
  const [epHausnummer, setEpHausnummer] = useState(ownMember?.hausnummer || "");
  const [epPlz, setEpPlz] = useState(ownMember?.plz || "");
  const [epWohnort, setEpWohnort] = useState(ownMember?.wohnort || "");
  const [epWohneinheit, setEpWohneinheit] = useState(ownMember?.wohneinheit || "");
  const [epEmail, setEpEmail] = useState(ownMember?.email || user.email || "");
  const [epError, setEpError] = useState("");
  const [epSaving, setEpSaving] = useState(false);

  async function syncOwnLoginEmail(newEmail) {
    const resp = await fetch(`${window.__SUPABASE_URL__}/functions/v1/admin-create-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type: "set_email", target_user_id: user.id, email: newEmail }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || "Login-Email konnte nicht mit geändert werden.");
  }

  async function handleSave() {
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
        vorname: epVorname.trim(), nachname: epNachname.trim(), spitzname: epSpitzname.trim() || null,
        strasse: epStrasse.trim() || null, hausnummer: epHausnummer.trim() || null, plz: epPlz.trim() || null,
        wohnort: epWohnort.trim() || null, wohneinheit: epWohneinheit.trim() || null, email: newEmail,
      };
      if (ownMemberId) {
        const { error } = await supabase.from("members").update(payload).eq("id", ownMemberId);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase.from("members")
          .insert({ user_id: user.id, created_by: user.id, is_child: false, ...payload }).select().single();
        if (error) throw error;
        setOwnMemberId(inserted.id);
      }
      const emailChanged = (ownMember?.email || null) !== newEmail;
      if (emailChanged) await syncOwnLoginEmail(newEmail);
      setOwnMember((prev) => ({ ...(prev || {}), ...payload }));
      onClose();
    } catch (e) { setEpError(e.message || "Konnte nicht gespeichert werden."); }
    finally { setEpSaving(false); }
  }

  return (
    <Modal onClose={onClose} maxW="max-w-md">
      <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Eintrag bearbeiten</h2><button onClick={onClose}><X size={20} /></button></div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="text-xs font-medium block mb-1">Vorname</label><input value={epVorname} onChange={(e) => setEpVorname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} /></div>
        <div><label className="text-xs font-medium block mb-1">Nachname</label><input value={epNachname} onChange={(e) => setEpNachname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} /></div>
      </div>
      <label className="text-xs font-medium block mb-1">Spitzname</label>
      <input value={epSpitzname} onChange={(e) => setEpSpitzname(e.target.value)} placeholder="optional" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="text-xs font-medium block mb-1">Straße</label><input value={epStrasse} onChange={(e) => setEpStrasse(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} /></div>
        <div><label className="text-xs font-medium block mb-1">Hausnummer</label><input value={epHausnummer} onChange={(e) => setEpHausnummer(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><label className="text-xs font-medium block mb-1">PLZ</label><input value={epPlz} onChange={(e) => setEpPlz(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} /></div>
        <div><label className="text-xs font-medium block mb-1">Ort</label><input value={epWohnort} onChange={(e) => setEpWohnort(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} /></div>
      </div>
      <label className="text-xs font-medium block mb-1">Wohneinheit</label>
      <input value={epWohneinheit} onChange={(e) => setEpWohneinheit(e.target.value)} placeholder="z.B. WE 12" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
      <label className="text-xs font-medium block mb-1">Login-Email</label>
      <input type="email" value={epEmail} onChange={(e) => setEpEmail(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
      {epError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{epError}</p>}
      <button onClick={handleSave} disabled={epSaving} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: INK, opacity: epSaving ? 0.7 : 1 }}>
        {epSaving && <Loader2 size={15} className="animate-spin" />} {epSaving ? "Speichern…" : "Speichern"}
      </button>
    </Modal>
  );
}
