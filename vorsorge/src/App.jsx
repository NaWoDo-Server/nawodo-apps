import React, { useState, useEffect, useMemo } from "react";
import {
  Home, Plus, X, AlertCircle, Loader2, Lock, FileText, Download, Trash2, Pencil,
  Users, UserPlus, ShieldCheck, ChevronDown, ChevronRight, Bell, Siren,
} from "lucide-react";
import { supabase, configMissing, BUCKET, VORSORGE_BUCKET } from "./supabaseClient";

const PAPER = "#F1F0EA";
const INK = "#2B2B26";
const INK_SOFT = "#6B6A61";
const BORDER_SOFT = "#D8D5C7";
const GREEN = "#3B6E5E";

// Rechtlich sinnvolle Dokumente fuer zwei Faelle: Handlungsunfaehigkeit zu Lebzeiten
// (Krankheit/Unfall) und den Todesfall, plus ein paar praktische Ergaenzungen. Diese
// App speichert und organisiert nur Dateien - sie erstellt oder generiert selbst
// keine rechtlichen Inhalte.
const CATEGORIES = [
  { key: "vorsorgevollmacht", label: "Vorsorgevollmacht", group: "Falls handlungsunfähig (Krankheit/Unfall)" },
  { key: "patientenverfuegung", label: "Patientenverfügung", group: "Falls handlungsunfähig (Krankheit/Unfall)" },
  { key: "betreuungsverfuegung", label: "Betreuungsverfügung", group: "Falls handlungsunfähig (Krankheit/Unfall)" },
  { key: "bankvollmacht", label: "Bankvollmacht", group: "Falls handlungsunfähig (Krankheit/Unfall)" },
  { key: "testament", label: "Testament / Erbvertrag", group: "Für den Todesfall" },
  { key: "transmortale_vollmacht", label: "Transmortale Vollmacht", group: "Für den Todesfall" },
  { key: "bestattungsverfuegung", label: "Bestattungsverfügung", group: "Für den Todesfall" },
  { key: "notfallordner", label: "Dokumentenverzeichnis / Notfallordner", group: "Ergänzend" },
  { key: "sorgerechtsverfuegung", label: "Sorgerechtsverfügung", group: "Ergänzend" },
  { key: "organspendeausweis", label: "Organspendeausweis", group: "Ergänzend" },
  { key: "sonstiges", label: "Sonstiges", group: "Ergänzend" },
];

const CATEGORY_GROUPS = [...new Set(CATEGORIES.map((c) => c.group))];

function categoryLabel(doc) {
  if (doc.category === "eigene") return doc.custom_category || "Eigene Kategorie";
  return CATEGORIES.find((c) => c.key === doc.category)?.label || doc.category;
}

function fmtDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function uploadDocumentFile(file, ownerUserId) {
  const safeBase = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${ownerUserId}/${Date.now()}-${safeBase}`;
  const { error } = await supabase.storage.from(VORSORGE_BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

async function openSignedFile(path) {
  const { data, error } = await supabase.storage.from(VORSORGE_BUCKET).createSignedUrl(path, 120);
  if (error || !data?.signedUrl) throw error || new Error("Kein Link erhalten.");
  window.open(data.signedUrl, "_blank", "noopener");
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
  const [session, setSession] = useState(undefined);
  const [access, setAccess] = useState(undefined);
  const [appEnabled, setAppEnabled] = useState(undefined);
  const [pwConfirmed, setPwConfirmed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwChecking, setPwChecking] = useState(false);

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
      .eq("app_key", "vorsorge")
      .maybeSingle()
      .then(({ data }) => setAccess(!data || data.allowed !== false))
      .catch(() => setAccess(true));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_enabled_vorsorge")
      .maybeSingle()
      .then(({ data }) => setAppEnabled(!data || data.value !== false))
      .catch(() => setAppEnabled(true));
  }, [session]);

  // Zusaetzliche Passwortabfrage bei JEDEM Oeffnen dieser einen App (auch wenn
  // schon eingeloggt) - bewusst ohne Merken/Ueberspringen, jedes Mal aufs Neue.
  async function handleConfirmPassword() {
    setPwError("");
    if (!pwInput) return;
    setPwChecking(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: session.user.email, password: pwInput });
      if (error) throw error;
      setPwConfirmed(true);
      setPwInput("");
    } catch (e) {
      setPwError("Passwort stimmt nicht.");
    } finally {
      setPwChecking(false);
    }
  }

  if (session === undefined || (session && (access === undefined || appEnabled === undefined))) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}>
        <Loader2 className="animate-spin" size={24} style={{ color: INK_SOFT }} />
      </div>
    );
  }
  if (!session) return null;

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

  if (!pwConfirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}>
        <div className="max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "#3B6E5E1A" }}>
            <Lock size={24} style={{ color: GREEN }} />
          </div>
          <p className="font-semibold mb-1">Passwort bestätigen</p>
          <p className="text-sm mb-4" style={{ color: INK_SOFT }}>Zum Schutz sensibler Unterlagen bitte dein Passwort erneut eingeben.</p>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirmPassword()}
            placeholder="Passwort"
            className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border text-center"
            style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
            autoFocus
          />
          {pwError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{pwError}</p>}
          <button
            onClick={handleConfirmPassword}
            disabled={pwChecking || !pwInput}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2 mb-3"
            style={{ backgroundColor: GREEN, opacity: pwChecking || !pwInput ? 0.6 : 1 }}
          >
            {pwChecking && <Loader2 size={15} className="animate-spin" />} {pwChecking ? "Prüfe…" : "Bestätigen"}
          </button>
          <a href="/" className="text-xs font-semibold" style={{ color: INK_SOFT }}>Zurück zur Startseite</a>
        </div>
      </div>
    );
  }

  return <VorsorgeApp session={session} />;
}

const NOTFALLPASS_BLANK = {
  name: "", geburtsdatum: "", adresse: "", blutgruppe: "",
  vorerkrankungen: "", allergien: "", medikamente_liste: [], implantate: "", operationen: "",
  kontakt1_name: "", kontakt1_telefon: "", kontakt2_name: "", kontakt2_telefon: "",
  hausarzt_name: "", hausarzt_telefon: "", facharzt_name: "", facharzt_telefon: "",
  krankenkasse: "", versichertennummer: "",
  vorsorge_hinweis: "", organspendeausweis: false, patientenverfuegung_kurzform: "", besondere_hinweise: "",
};

const NOTFALLPASS_LABELS = {
  name: "Name", geburtsdatum: "Geburtsdatum", adresse: "Adresse", blutgruppe: "Blutgruppe",
  vorerkrankungen: "Vorerkrankungen", allergien: "Allergien / Unverträglichkeiten",
  implantate: "Implantate / Geräte", operationen: "Frühere Operationen (falls relevant)",
  kontakt1_name: "Notfallkontakt 1", kontakt1_telefon: "Telefon Notfallkontakt 1",
  kontakt2_name: "Notfallkontakt 2", kontakt2_telefon: "Telefon Notfallkontakt 2",
  hausarzt_name: "Hausarzt", hausarzt_telefon: "Telefon Hausarzt",
  facharzt_name: "Facharzt", facharzt_telefon: "Telefon Facharzt",
  krankenkasse: "Krankenkasse", versichertennummer: "Versichertennummer",
  vorsorge_hinweis: "Patientenverfügung / Vorsorgevollmacht – Aufbewahrungsort & Kontakt der bevollmächtigten Person",
  patientenverfuegung_kurzform: "Patientenverfügung (Kurzform)",
  besondere_hinweise: "Besondere Hinweise (z.B. Schwangerschaft, Sprachbarriere, Behinderung)",
};

function NpTextInput({ label, value, onChange, placeholder, type }) {
  return (
    <div className="mb-3">
      <label className="text-xs font-medium block mb-1">{label}</label>
      <input type={type || "text"} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
    </div>
  );
}

function NpTextArea({ label, value, onChange, placeholder, rows }) {
  return (
    <div className="mb-3">
      <label className="text-xs font-medium block mb-1">{label}</label>
      <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows || 2} className="w-full rounded-lg px-3 py-2.5 text-sm border resize-none" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
    </div>
  );
}

function NpMedicationList({ value, onChange }) {
  const list = Array.isArray(value) && value.length > 0 ? value : [{ name: "", dosierung: "" }];

  function updateRow(idx, key, v) {
    const next = list.map((row, i) => (i === idx ? { ...row, [key]: v } : row));
    onChange(next);
  }

  function addRow() {
    onChange([...list, { name: "", dosierung: "" }]);
  }

  function removeRow(idx) {
    const next = list.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : [{ name: "", dosierung: "" }]);
  }

  return (
    <div className="mb-3">
      <label className="text-xs font-medium block mb-1">Aktuelle Medikation</label>
      <div className="flex flex-col gap-2">
        {list.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={row.name || ""}
              onChange={(e) => updateRow(idx, "name", e.target.value)}
              placeholder="Medikament"
              className="flex-1 min-w-0 rounded-lg px-3 py-2.5 text-sm border"
              style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
            />
            <input
              type="text"
              value={row.dosierung || ""}
              onChange={(e) => updateRow(idx, "dosierung", e.target.value)}
              placeholder="Dosierung"
              className="w-28 flex-shrink-0 rounded-lg px-3 py-2.5 text-sm border"
              style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
            />
            {list.length > 1 && (
              <button type="button" onClick={() => removeRow(idx)} className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}>
                <X size={13} style={{ color: INK_SOFT }} />
              </button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
        <Plus size={13} /> Weiteres Medikament
      </button>
    </div>
  );
}

function NpField({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div>
      <div className="text-xs font-semibold" style={{ color: INK_SOFT }}>{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function NpPhoneLink({ number }) {
  if (!number) return null;
  return <a href={`tel:${number.replace(/\s+/g, "")}`} className="underline" style={{ color: GREEN }}>{number}</a>;
}

function NpContactBlock({ title, name, phone }) {
  if (!name && !phone) return null;
  return (
    <div>
      <div className="text-xs font-semibold" style={{ color: INK_SOFT }}>{title}</div>
      <div className="text-sm">
        {name}
        {name && phone && " · "}
        <NpPhoneLink number={phone} />
      </div>
    </div>
  );
}

function NotfallpassReadonly({ record }) {
  const medications = Array.isArray(record.medikamente_liste)
    ? record.medikamente_liste.filter((m) => (m?.name || "").trim() || (m?.dosierung || "").trim())
    : [];
  const hasKontakt1 = !!(record.kontakt1_name || record.kontakt1_telefon);
  const hasKontakt2 = !!(record.kontakt2_name || record.kontakt2_telefon);
  const hasMain = !!(
    record.name || record.geburtsdatum || record.adresse || record.vorerkrankungen || medications.length > 0 ||
    record.operationen || record.implantate || record.blutgruppe || hasKontakt1 || hasKontakt2 ||
    record.hausarzt_name || record.hausarzt_telefon || record.krankenkasse
  );
  const hasExtra = !!(
    record.allergien || record.facharzt_name || record.facharzt_telefon || record.versichertennummer ||
    record.vorsorge_hinweis || record.patientenverfuegung_kurzform || record.besondere_hinweise
  );

  return (
    <div className="flex flex-col gap-2.5">
      {record.organspendeausweis && (
        <div className="text-xs font-semibold px-2.5 py-1.5 rounded-lg inline-block w-fit" style={{ backgroundColor: "#FF92921A", color: "#C0453F" }}>Hat einen Organspendeausweis</div>
      )}
      {!hasMain && !hasExtra ? (
        <p className="text-sm" style={{ color: INK_SOFT }}>Noch keine Angaben.</p>
      ) : (
        <>
          <NpField label="Name" value={record.name} />
          <NpField label="Geburtsdatum" value={record.geburtsdatum} />
          <NpField label="Adresse" value={record.adresse} />
          <NpField label="Vorerkrankungen" value={record.vorerkrankungen} />
          {medications.length > 0 && (
            <div>
              <div className="text-xs font-semibold" style={{ color: INK_SOFT }}>Aktuelle Medikation</div>
              <div className="flex flex-col gap-0.5">
                {medications.map((m, i) => (
                  <div key={i} className="text-sm">{m.name}{m.dosierung ? ` – ${m.dosierung}` : ""}</div>
                ))}
              </div>
            </div>
          )}
          <NpField label="Frühere Operationen (falls relevant)" value={record.operationen} />
          <NpField label="Implantate / Geräte" value={record.implantate} />
          <NpField label="Blutgruppe" value={record.blutgruppe} />
          {(hasKontakt1 || hasKontakt2) && (
            <div>
              <div className="text-xs font-semibold" style={{ color: INK_SOFT }}>Notfallkontakte</div>
              <div className="flex flex-col gap-1">
                {hasKontakt1 && (
                  <div className="text-sm">
                    {record.kontakt1_name}
                    {record.kontakt1_name && record.kontakt1_telefon && " · "}
                    <NpPhoneLink number={record.kontakt1_telefon} />
                  </div>
                )}
                {hasKontakt2 && (
                  <div className="text-sm">
                    {record.kontakt2_name}
                    {record.kontakt2_name && record.kontakt2_telefon && " · "}
                    <NpPhoneLink number={record.kontakt2_telefon} />
                  </div>
                )}
              </div>
            </div>
          )}
          <NpContactBlock title="Hausarzt" name={record.hausarzt_name} phone={record.hausarzt_telefon} />
          <NpField label="Krankenkasse" value={record.krankenkasse} />

          {hasExtra && (
            <>
              <div className="text-xs font-bold uppercase tracking-wide mt-1" style={{ color: INK_SOFT }}>Weitere Angaben</div>
              <NpField label="Allergien / Unverträglichkeiten" value={record.allergien} />
              <NpContactBlock title="Facharzt" name={record.facharzt_name} phone={record.facharzt_telefon} />
              <NpField label="Versichertennummer" value={record.versichertennummer} />
              <NpField label={NOTFALLPASS_LABELS.vorsorge_hinweis} value={record.vorsorge_hinweis} />
              <NpField label="Patientenverfügung (Kurzform)" value={record.patientenverfuegung_kurzform} />
              <NpField label="Besondere Hinweise" value={record.besondere_hinweise} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function DocumentRow({ doc, onDownload, downloading, onEdit, onDelete, shareCount, canManage }) {
  return (
    <div className="p-3.5 rounded-xl" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block mb-1" style={{ backgroundColor: "#3B6E5E1A", color: GREEN }}>{categoryLabel(doc)}</span>
          <div className="text-sm font-semibold truncate">{doc.title}</div>
          <div className="text-xs truncate" style={{ color: INK_SOFT }}>{doc.file_name} · {fmtDateTime(doc.created_at)}</div>
          {doc.note && <div className="text-xs mt-1 whitespace-pre-wrap" style={{ color: INK_SOFT }}>{doc.note}</div>}
          {canManage && shareCount > 0 && (
            <div className="text-xs mt-1" style={{ color: GREEN }}>Einzeln freigegeben an {shareCount} {shareCount === 1 ? "Person" : "Personen"}</div>
          )}
          {canManage && doc.reminder_enabled && (
            <div className="text-xs mt-1 flex items-center gap-1" style={{ color: INK_SOFT }}><Bell size={11} /> Erinnerung alle 6 Monate aktiv</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
          <button onClick={onDownload} disabled={downloading} title="Herunterladen" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}>
            {downloading ? <Loader2 size={14} className="animate-spin" style={{ color: INK_SOFT }} /> : <Download size={14} style={{ color: INK_SOFT }} />}
          </button>
          {canManage && (
            <>
              <button onClick={onEdit} title="Bearbeiten" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Pencil size={13} style={{ color: INK_SOFT }} /></button>
              <button onClick={onDelete} title="Löschen" className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Trash2 size={13} style={{ color: "#A13D3D" }} /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function VorsorgeApp({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
  const initial = userName.charAt(0).toUpperCase();

  // Popups per ESC-Taste schliessbar machen.
  useEffect(() => {
    function handleEscape(e) {
      if (e.key !== "Escape") return;
      setShowUploadForm(false);
      setEditingDoc(null);
      setShowAddTrusted(false);
      setShowNotfallpassForm(false);
      setViewingNotfallpassOwnerId(null);
      setShowAccount(false);
      setShowEditProfile(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);
  const isAdmin = user.user_metadata?.is_admin === true;
  const isSuperAdmin = user.user_metadata?.is_superadmin === true;

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

  const [activeTab, setActiveTab] = useState("meine"); // "meine" | "freigegeben" | "alle"
  const [documents, setDocuments] = useState([]);
  const [shares, setShares] = useState([]);
  const [docShares, setDocShares] = useState([]);
  const [notfallpassList, setNotfallpassList] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [notfallpassShares, setNotfallpassShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [expandedOwners, setExpandedOwners] = useState(() => new Set());

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    let docs, sh, dsh, np, us, mb, nps;
    try {
      [docs, sh, dsh, np, us, mb, nps] = await Promise.all([
        supabase.from("vorsorge_documents").select("*").order("created_at", { ascending: false }),
        supabase.from("vorsorge_shares").select("*"),
        supabase.from("vorsorge_document_shares").select("*"),
        supabase.from("vorsorge_notfallpass").select("*"),
        supabase.rpc("list_all_users"),
        supabase.from("members").select("user_id, vorname, nachname"),
        supabase.from("vorsorge_notfallpass_shares").select("*"),
      ]);
    } catch (e) {
      console.error("Vorsorge loadAll fehlgeschlagen (Netzwerk/Exception):", e);
      alert(`Laden fehlgeschlagen: ${e?.message || JSON.stringify(e)}`);
      setLoading(false);
      return;
    }
    const errors = [
      ["Dokumente", docs.error],
      ["Vertrauenspersonen", sh.error],
      ["Dokument-Freigaben", dsh.error],
      ["Notfallpass", np.error],
      ["Mitgliederliste", us.error],
      ["Notfallpass-Freigaben", nps?.error],
    ].filter(([, err]) => !!err);
    if (errors.length > 0) {
      console.error("Vorsorge loadAll Fehler:", errors);
      alert(
        "Beim Laden ist etwas schiefgelaufen:\n" +
          errors.map(([label, err]) => `- ${label}: ${err.message || JSON.stringify(err)}`).join("\n")
      );
    }
    setDocuments(docs.data || []);
    setShares(sh.data || []);
    setDocShares(dsh.data || []);
    setNotfallpassList(np.data || []);
    setAllUsers(us.data || []);
    setMembers(mb?.data || []);
    setNotfallpassShares(nps?.data || []);
    setLoading(false);
  }

  function notfallpassFor(ownerId) {
    return notfallpassList.find((n) => n.owner_user_id === ownerId) || null;
  }

  function fullNameFor(userId) {
    const m = members.find((x) => x.user_id === userId);
    const memberName = m ? [m.vorname, m.nachname].filter(Boolean).join(" ").trim() : "";
    if (memberName) return memberName;
    const u = allUsers.find((x) => x.id === userId);
    return u?.name || u?.email || "Unbekannt";
  }

  function nameFor(userId) {
    if (userId === user.id) return `${fullNameFor(userId)} (Du)`;
    return fullNameFor(userId);
  }

  function toggleOwnerExpanded(ownerId) {
    setExpandedOwners((prev) => {
      const next = new Set(prev);
      if (next.has(ownerId)) next.delete(ownerId); else next.add(ownerId);
      return next;
    });
  }

  const myDocuments = useMemo(
    () => documents.filter((d) => d.owner_user_id === user.id),
    [documents, user.id]
  );
  const myTrustedPeople = useMemo(() => shares.filter((s) => s.owner_user_id === user.id), [shares, user.id]);
  const trustedByMeIds = useMemo(() => new Set(myTrustedPeople.map((s) => s.trusted_user_id)), [myTrustedPeople]);

  function docSharesFor(documentId) {
    return docShares.filter((ds) => ds.document_id === documentId);
  }

  // Leute, die mir einzelne Dokumente und/oder den Notfallpass gezielt
  // freigegeben haben (Zugriff wird ausschliesslich ueber die Freigaben-Matrix
  // gesteuert, nicht mehr automatisch durch "Vertrauensperson" allein).
  const myDocShares = useMemo(() => docShares.filter((ds) => ds.trusted_user_id === user.id), [docShares, user.id]);
  const myNotfallpassShares = useMemo(() => notfallpassShares.filter((s) => s.trusted_user_id === user.id), [notfallpassShares, user.id]);

  // ownerId -> { docIds: Set, notfallpass: boolean }
  const sharedWithMeGroups = useMemo(() => {
    const groups = {};
    myDocShares.forEach((ds) => {
      const doc = documents.find((d) => d.id === ds.document_id);
      if (!doc) return;
      groups[doc.owner_user_id] = groups[doc.owner_user_id] || { docIds: new Set(), notfallpass: false };
      groups[doc.owner_user_id].docIds.add(doc.id);
    });
    myNotfallpassShares.forEach((s) => {
      groups[s.owner_user_id] = groups[s.owner_user_id] || { docIds: new Set(), notfallpass: false };
      groups[s.owner_user_id].notfallpass = true;
    });
    return groups;
  }, [myDocShares, myNotfallpassShares, documents]);

  const sharedWithMeOwnerIds = useMemo(() => Object.keys(sharedWithMeGroups), [sharedWithMeGroups]);

  function docsForSharedOwner(ownerId) {
    const g = sharedWithMeGroups[ownerId];
    if (!g) return [];
    return documents.filter((d) => g.docIds.has(d.id));
  }

  // Fuer die Superadmin-Uebersicht: alle Besitzer mit mind. 1 Dokument oder mind.
  // 1 Vertrauensperson, unabhaengig davon ob ich selbst als Vertrauensperson
  // eingetragen bin.
  const allOwnerIds = useMemo(() => {
    const ids = new Set();
    documents.forEach((d) => ids.add(d.owner_user_id));
    shares.forEach((s) => ids.add(s.owner_user_id));
    notfallpassList.forEach((n) => ids.add(n.owner_user_id));
    return [...ids];
  }, [documents, shares, notfallpassList]);

  // --- Hochladen ---
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [formCategory, setFormCategory] = useState("testament");
  const [formCustomCategory, setFormCustomCategory] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formFile, setFormFile] = useState(null);
  const [formReminderEnabled, setFormReminderEnabled] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function resetUploadForm() {
    setFormCategory("testament");
    setFormCustomCategory("");
    setFormTitle("");
    setFormNote("");
    setFormFile(null);
    setFormReminderEnabled(false);
    setFormError("");
  }

  async function handleUpload() {
    setFormError("");
    if (!formTitle.trim()) return setFormError("Bitte einen Titel angeben.");
    if (formCategory === "eigene" && !formCustomCategory.trim()) return setFormError("Bitte einen Namen für die eigene Kategorie angeben.");
    if (!formFile) return setFormError("Bitte eine Datei auswählen.");
    setSaving(true);
    try {
      const path = await uploadDocumentFile(formFile, user.id);
      const { error } = await supabase.from("vorsorge_documents").insert({
        owner_user_id: user.id,
        category: formCategory,
        custom_category: formCategory === "eigene" ? formCustomCategory.trim() : null,
        title: formTitle.trim(),
        note: formNote.trim() || null,
        file_path: path,
        file_name: formFile.name,
        reminder_enabled: formReminderEnabled,
      });
      if (error) throw error;
      setShowUploadForm(false);
      resetUploadForm();
      await loadAll();
    } catch (e) {
      console.error("Vorsorge-Upload fehlgeschlagen:", e);
      const msg = e?.message || e?.error_description || JSON.stringify(e) || "Hochladen fehlgeschlagen.";
      setFormError(msg);
      alert(`Hochladen fehlgeschlagen: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  // --- Bearbeiten ---
  const [editingDoc, setEditingDoc] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editCategory, setEditCategory] = useState("testament");
  const [editCustomCategory, setEditCustomCategory] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [editReminderEnabled, setEditReminderEnabled] = useState(false);
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function openEdit(doc) {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditNote(doc.note || "");
    setEditCategory(doc.category);
    setEditCustomCategory(doc.custom_category || "");
    setEditFile(null);
    setEditReminderEnabled(doc.reminder_enabled === true);
    setEditError("");
  }

  async function handleSaveEdit() {
    if (!editingDoc) return;
    setEditError("");
    if (!editTitle.trim()) return setEditError("Bitte einen Titel angeben.");
    if (editCategory === "eigene" && !editCustomCategory.trim()) return setEditError("Bitte einen Namen für die eigene Kategorie angeben.");
    setSavingEdit(true);
    try {
      const oldPath = editingDoc.file_path;
      let filePath = editingDoc.file_path;
      let fileName = editingDoc.file_name;
      if (editFile) {
        filePath = await uploadDocumentFile(editFile, editingDoc.owner_user_id);
        fileName = editFile.name;
      }
      const { error } = await supabase.from("vorsorge_documents").update({
        title: editTitle.trim(),
        note: editNote.trim() || null,
        category: editCategory,
        custom_category: editCategory === "eigene" ? editCustomCategory.trim() : null,
        file_path: filePath,
        file_name: fileName,
        reminder_enabled: editReminderEnabled,
        updated_at: new Date().toISOString(),
      }).eq("id", editingDoc.id);
      if (error) throw error;
      if (editFile && filePath !== oldPath) {
        await supabase.storage.from(VORSORGE_BUCKET).remove([oldPath]).catch(() => {});
      }
      setEditingDoc(null);
      setEditFile(null);
      await loadAll();
    } catch (e) {
      console.error("Vorsorge-Bearbeiten fehlgeschlagen:", e);
      const msg = e?.message || e?.error_description || JSON.stringify(e) || "Konnte nicht gespeichert werden.";
      setEditError(msg);
      alert(`Speichern fehlgeschlagen: ${msg}`);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteDoc(doc) {
    if (!window.confirm(`"${doc.title}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    try {
      await supabase.storage.from(VORSORGE_BUCKET).remove([doc.file_path]);
      const { error } = await supabase.from("vorsorge_documents").delete().eq("id", doc.id);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message || "Löschen fehlgeschlagen.");
    }
  }

  async function handleDownload(doc) {
    setDownloadingId(doc.id);
    try {
      await openSignedFile(doc.file_path);
    } catch (e) {
      alert("Datei konnte nicht geöffnet werden.");
    } finally {
      setDownloadingId(null);
    }
  }

  // --- Vertrauenspersonen ---
  const [showAddTrusted, setShowAddTrusted] = useState(false);
  const [addTrustedUserId, setAddTrustedUserId] = useState("");
  const [trustedError, setTrustedError] = useState("");
  const [savingTrusted, setSavingTrusted] = useState(false);

  async function handleAddTrusted() {
    setTrustedError("");
    if (!addTrustedUserId) return;
    setSavingTrusted(true);
    try {
      const { error } = await supabase.from("vorsorge_shares").insert({ owner_user_id: user.id, trusted_user_id: addTrustedUserId });
      if (error) throw error;
      setShowAddTrusted(false);
      setAddTrustedUserId("");
      await loadAll();
    } catch (e) {
      setTrustedError(e.message || "Konnte nicht hinzugefügt werden.");
    } finally {
      setSavingTrusted(false);
    }
  }

  async function handleRemoveTrusted(shareId, trustedUserId) {
    if (!window.confirm("Person aus dem Kreis entfernen? Damit verliert sie auch den Zugriff auf alle bisher einzeln freigegebenen Dokumente und den Notfallpass.")) return;
    try {
      const { error } = await supabase.from("vorsorge_shares").delete().eq("id", shareId);
      if (error) throw error;
      // Zugehoerige Einzel-Freigaben fuer diese Person ebenfalls entfernen, damit
      // niemand ausserhalb des sichtbaren Kreises weiterhin Zugriff behaelt.
      const myDocIds = documents.filter((d) => d.owner_user_id === user.id).map((d) => d.id);
      if (myDocIds.length > 0) {
        await supabase.from("vorsorge_document_shares").delete().eq("trusted_user_id", trustedUserId).in("document_id", myDocIds);
      }
      await supabase.from("vorsorge_notfallpass_shares").delete().eq("owner_user_id", user.id).eq("trusted_user_id", trustedUserId);
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht entfernt werden.");
    }
  }

  // --- Freigaben-Matrix: pro Vertrauensperson gezielt festlegen, welche Dokumente
  // und/oder der Notfallpass sichtbar sind. Ersetzt die fruehere automatische
  // Vollfreigabe fuer alle Vertrauenspersonen. ---
  const [togglingShareCell, setTogglingShareCell] = useState(null);

  async function handleToggleDocShare(documentId, trustedUserId) {
    const cellKey = `doc:${documentId}:${trustedUserId}`;
    setTogglingShareCell(cellKey);
    try {
      const existing = docShares.find((ds) => ds.document_id === documentId && ds.trusted_user_id === trustedUserId);
      if (existing) {
        const { error } = await supabase.from("vorsorge_document_shares").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vorsorge_document_shares").insert({ document_id: documentId, trusted_user_id: trustedUserId });
        if (error) throw error;
      }
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht geändert werden.");
    } finally {
      setTogglingShareCell(null);
    }
  }

  async function handleToggleNotfallpassShare(trustedUserId) {
    const cellKey = `np:${trustedUserId}`;
    setTogglingShareCell(cellKey);
    try {
      const existing = notfallpassShares.find((s) => s.owner_user_id === user.id && s.trusted_user_id === trustedUserId);
      if (existing) {
        const { error } = await supabase.from("vorsorge_notfallpass_shares").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("vorsorge_notfallpass_shares").insert({ owner_user_id: user.id, trusted_user_id: trustedUserId });
        if (error) throw error;
      }
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht geändert werden.");
    } finally {
      setTogglingShareCell(null);
    }
  }

  // --- Notfallpass: ein Formular pro Person, getrennt von den hochgeladenen
  // Dokumenten. Sichtbar fuer volle Vertrauenspersonen und den Superadmin.
  const [showNotfallpassForm, setShowNotfallpassForm] = useState(false);
  const [npForm, setNpForm] = useState(NOTFALLPASS_BLANK);
  const [savingNp, setSavingNp] = useState(false);
  const [npError, setNpError] = useState("");
  const [viewingNotfallpassOwnerId, setViewingNotfallpassOwnerId] = useState(null);

  const myNotfallpass = notfallpassFor(user.id);
  const viewingNp = viewingNotfallpassOwnerId ? notfallpassFor(viewingNotfallpassOwnerId) : null;

  function updateNpField(key, value) {
    setNpForm((prev) => ({ ...prev, [key]: value }));
  }

  function openNotfallpassForm() {
    setNpForm(myNotfallpass ? { ...NOTFALLPASS_BLANK, ...myNotfallpass } : NOTFALLPASS_BLANK);
    setNpError("");
    setShowNotfallpassForm(true);
  }

  async function handleSaveNotfallpass() {
    setNpError("");
    setSavingNp(true);
    try {
      const payload = {
        owner_user_id: user.id,
        ...npForm,
        geburtsdatum: npForm.geburtsdatum || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("vorsorge_notfallpass").upsert(payload, { onConflict: "owner_user_id" });
      if (error) throw error;
      setShowNotfallpassForm(false);
      await loadAll();
    } catch (e) {
      setNpError(e.message || "Konnte nicht gespeichert werden.");
    } finally {
      setSavingNp(false);
    }
  }

  // --- Konto (identisch zum Muster in den anderen Apps) ---
  const [showAccount, setShowAccount] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={24} style={{ color: INK_SOFT }} /></div>;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAPER, color: INK }}>
      <div className="max-w-3xl mx-auto lg:max-w-none lg:w-2/3 lg:mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between mb-5">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/vorsorge/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
            <h1 className="font-bold text-lg lg:text-2xl">Vorsorge</h1>
          </a>
          <div className="flex items-center gap-2">
            <span className="text-xs lg:text-sm font-bold truncate max-w-[110px] lg:max-w-[180px]" style={{ color: INK_SOFT }}>Hallo {userName}</span>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>{ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}</button>
            <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
          </div>
        </div>

        <p className="text-xs mb-1.5 flex items-center gap-1.5" style={{ color: INK_SOFT }}>
          <Lock size={12} className="flex-shrink-0" /> Nur du und deine Vertrauenspersonen sehen deine Dokumente.
        </p>
        <p className="text-xs mb-4" style={{ color: INK_SOFT }}>
          Diese App ist ein sicherer Ablageort für deine Unterlagen – sie ersetzt keine rechtliche Beratung, z. B. durch Notar oder Fachanwalt für Erbrecht.
        </p>

        <div className="flex items-center gap-1.5 mb-5 p-1 rounded-full w-fit flex-wrap" style={{ backgroundColor: "#E4E1D3" }}>
          <button onClick={() => setActiveTab("meine")} className="px-4 py-2 rounded-full text-sm font-semibold" style={activeTab === "meine" ? { backgroundColor: "#fff", color: INK, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } : { color: INK_SOFT }}>Meine Dokumente</button>
          <button onClick={() => setActiveTab("freigegeben")} className="px-4 py-2 rounded-full text-sm font-semibold" style={activeTab === "freigegeben" ? { backgroundColor: "#fff", color: INK, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } : { color: INK_SOFT }}>Für mich freigegeben</button>
          {isSuperAdmin && (
            <button onClick={() => setActiveTab("alle")} className="px-4 py-2 rounded-full text-sm font-semibold" style={activeTab === "alle" ? { backgroundColor: "#fff", color: INK, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } : { color: INK_SOFT }}>Alle Mitglieder</button>
          )}
        </div>

        {activeTab === "meine" && (
          <>
            <button
              onClick={() => { if (myNotfallpass) { setViewingNotfallpassOwnerId(user.id); } else { openNotfallpassForm(); } }}
              className="w-full flex items-center gap-3 p-4 rounded-xl mb-6 text-left"
              style={{ backgroundColor: "#FF9292", color: "#fff" }}
            >
              <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.25)" }}>
                <Siren size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold">Notfallpass</div>
                <div className="text-xs opacity-90">{myNotfallpass ? "Ausgefüllt – hier ansehen" : "Noch nicht ausgefüllt – jetzt anlegen"}</div>
              </div>
            </button>

            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Meine Dokumente</h2>
              <button onClick={() => { resetUploadForm(); setShowUploadForm(true); }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                <Plus size={14} /> Dokument hochladen
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: INK_SOFT }}>
              Lade hier deine Dokumente hoch. Wem du sie zeigst, legst du weiter unten in der Freigaben-Tabelle fest.
            </p>

            {myDocuments.length === 0 ? (
              <div className="text-center py-10 rounded-xl mb-6" style={{ backgroundColor: "#fff" }}>
                <FileText className="mx-auto mb-2" size={22} style={{ color: INK_SOFT }} />
                <p className="text-sm" style={{ color: INK_SOFT }}>Noch keine Dokumente hochgeladen.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mb-6">
                {myDocuments.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} onDownload={() => handleDownload(doc)} downloading={downloadingId === doc.id} onEdit={() => openEdit(doc)} onDelete={() => handleDeleteDoc(doc)} shareCount={docSharesFor(doc.id).length} canManage />
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Vertrauenspersonen</h2>
              <button onClick={() => { setShowAddTrusted(true); setTrustedError(""); }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                <UserPlus size={14} /> Hinzufügen
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: INK_SOFT }}>Lege hier den Kreis der Personen fest, denen du in der Tabelle darunter gezielt Dokumente und/oder den Notfallpass zeigen kannst. Automatisch sieht hier niemand etwas.</p>
            {myTrustedPeople.length === 0 ? (
              <p className="text-sm mb-6" style={{ color: INK_SOFT }}>Noch niemand eingetragen.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-6">
                {myTrustedPeople.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3.5 rounded-xl" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                    <div className="flex items-center gap-2.5 text-sm font-semibold"><Users size={15} style={{ color: INK_SOFT }} /> {nameFor(s.trusted_user_id)}</div>
                    <button onClick={() => handleRemoveTrusted(s.id, s.trusted_user_id)} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: "#A13D3D" }}>Entfernen</button>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Freigaben</h2>
            {myTrustedPeople.length === 0 ? (
              <p className="text-sm mb-6" style={{ color: INK_SOFT }}>Füge zuerst oben eine Vertrauensperson hinzu, um ihr Dokumente oder den Notfallpass zuzuweisen.</p>
            ) : (
              <>
                <p className="text-xs mb-3" style={{ color: INK_SOFT }}>Häkchen setzen, um ein Dokument oder den Notfallpass für eine Person freizugeben. Wirkt sofort.</p>
                <div className="overflow-x-auto rounded-xl mb-6" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                  <table className="text-xs border-collapse" style={{ minWidth: 420 }}>
                    <thead>
                      <tr>
                        <th className="text-left px-3 py-2.5 sticky left-0" style={{ backgroundColor: "#fff", borderBottom: `1.5px solid ${BORDER_SOFT}` }}>Vertrauensperson</th>
                        {myDocuments.map((doc) => (
                          <th key={doc.id} title={doc.title} className="px-2 py-2.5 text-center font-semibold whitespace-nowrap max-w-[90px] truncate" style={{ color: INK_SOFT, borderBottom: `1.5px solid ${BORDER_SOFT}` }}>
                            {doc.title}
                          </th>
                        ))}
                        <th className="px-2 py-2.5 text-center font-semibold whitespace-nowrap" style={{ color: "#C0453F", borderBottom: `1.5px solid ${BORDER_SOFT}` }}>Notfallpass</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myTrustedPeople.map((s) => (
                        <tr key={s.id} style={{ borderBottom: `1px solid ${BORDER_SOFT}` }}>
                          <td className="px-3 py-2 sticky left-0 font-semibold truncate" style={{ backgroundColor: "#fff" }}>{nameFor(s.trusted_user_id)}</td>
                          {myDocuments.map((doc) => (
                            <td key={doc.id} className="text-center px-2 py-2">
                              <input
                                type="checkbox"
                                checked={docSharesFor(doc.id).some((ds) => ds.trusted_user_id === s.trusted_user_id)}
                                disabled={togglingShareCell === `doc:${doc.id}:${s.trusted_user_id}`}
                                onChange={() => handleToggleDocShare(doc.id, s.trusted_user_id)}
                              />
                            </td>
                          ))}
                          <td className="text-center px-2 py-2">
                            <input
                              type="checkbox"
                              checked={notfallpassShares.some((ns) => ns.owner_user_id === user.id && ns.trusted_user_id === s.trusted_user_id)}
                              disabled={togglingShareCell === `np:${s.trusted_user_id}`}
                              onChange={() => handleToggleNotfallpassShare(s.trusted_user_id)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {activeTab === "freigegeben" && (
          <>
            {sharedWithMeOwnerIds.length === 0 ? (
              <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#fff" }}>
                <ShieldCheck className="mx-auto mb-2" size={22} style={{ color: INK_SOFT }} />
                <p className="text-sm" style={{ color: INK_SOFT }}>Bisher hat dich niemand als Vertrauensperson eingetragen oder dir ein Dokument freigegeben.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {sharedWithMeOwnerIds.map((ownerId) => {
                  const docs = docsForSharedOwner(ownerId);
                  const expanded = expandedOwners.has(ownerId);
                  const ownerNp = sharedWithMeGroups[ownerId]?.notfallpass ? notfallpassFor(ownerId) : null;
                  return (
                    <div key={ownerId} className="rounded-xl overflow-hidden" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <button onClick={() => toggleOwnerExpanded(ownerId)} className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          {expanded ? <ChevronDown size={14} style={{ color: INK }} className="flex-shrink-0" /> : <ChevronRight size={14} style={{ color: INK }} className="flex-shrink-0" />}
                          <span className="text-sm font-semibold truncate">{nameFor(ownerId)}</span>
                        </div>
                        <span className="flex items-center gap-1.5 flex-shrink-0">
                          {ownerNp && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#FF92921A", color: "#C0453F" }}>Notfallpass</span>
                          )}
                          <span className="text-xs" style={{ color: INK_SOFT }}>{docs.length} Dokument{docs.length === 1 ? "" : "e"}</span>
                        </span>
                      </button>
                      {expanded && (
                        <div className="px-3.5 pb-3.5">
                          {ownerNp && (
                            <button
                              onClick={() => setViewingNotfallpassOwnerId(ownerId)}
                              className="w-full flex items-center gap-2 p-2.5 rounded-lg mb-2.5 text-left text-sm font-semibold"
                              style={{ backgroundColor: "#FF92921A", color: "#C0453F" }}
                            >
                              <Siren size={14} /> Notfallpass ansehen
                            </button>
                          )}
                          {docs.length === 0 ? (
                            <p className="text-sm" style={{ color: INK_SOFT }}>Noch keine Dokumente hochgeladen.</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {docs.map((doc) => (
                                <DocumentRow key={doc.id} doc={doc} onDownload={() => handleDownload(doc)} downloading={downloadingId === doc.id} canManage={false} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === "alle" && isSuperAdmin && (
          <>
            <p className="text-xs mb-4" style={{ color: INK_SOFT }}>Als Superadmin siehst du hier alle Mitglieder mit Vorsorge-Dokumenten, unabhängig davon, ob du als Vertrauensperson eingetragen bist.</p>
            {allOwnerIds.length === 0 ? (
              <p className="text-sm" style={{ color: INK_SOFT }}>Noch niemand hat Dokumente hochgeladen.</p>
            ) : (
              allOwnerIds.map((ownerId) => {
                const docs = documents.filter((d) => d.owner_user_id === ownerId);
                const trustedFor = shares.filter((s) => s.owner_user_id === ownerId);
                const ownerNp = notfallpassFor(ownerId);
                return (
                  <div key={ownerId} className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>{nameFor(ownerId)}</h2>
                    <p className="text-xs mb-2" style={{ color: INK_SOFT }}>
                      {docs.length} Dokument{docs.length === 1 ? "" : "e"} · Vertrauenspersonen: {trustedFor.length === 0 ? "keine" : trustedFor.map((s) => nameFor(s.trusted_user_id)).join(", ")}
                    </p>
                    {ownerNp && (
                      <button
                        onClick={() => setViewingNotfallpassOwnerId(ownerId)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg mb-2.5 text-sm font-semibold"
                        style={{ backgroundColor: "#FF92921A", color: "#C0453F" }}
                      >
                        <Siren size={14} /> Notfallpass ansehen
                      </button>
                    )}
                    {docs.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {docs.map((doc) => (
                          <DocumentRow key={doc.id} doc={doc} onDownload={() => handleDownload(doc)} downloading={downloadingId === doc.id} canManage={false} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {showUploadForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowUploadForm(false); } }}>
          <div className="w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Dokument hochladen</h2><button onClick={() => setShowUploadForm(false)}><X size={20} /></button></div>

            <label className="text-xs font-medium block mb-1">Kategorie</label>
            <select value={formCategory} onChange={(e) => setFormCategory(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
              {CATEGORY_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {CATEGORIES.filter((c) => c.group === g).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </optgroup>
              ))}
              <option value="eigene">Eigene Kategorie…</option>
            </select>
            {formCategory === "eigene" && (
              <input value={formCustomCategory} onChange={(e) => setFormCustomCategory(e.target.value)} placeholder="Name der Kategorie" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
            )}

            <label className="text-xs font-medium block mb-1">Titel</label>
            <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="z.B. Testament 2024" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Notiz (optional)</label>
            <textarea value={formNote} onChange={(e) => setFormNote(e.target.value)} rows={3} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border resize-none" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Datei</label>
            <input type="file" onChange={(e) => setFormFile(e.target.files[0] || null)} className="w-full text-sm mb-3" />

            <label className="flex items-center gap-2 text-xs font-medium mb-3">
              <input type="checkbox" checked={formReminderEnabled} onChange={(e) => setFormReminderEnabled(e.target.checked)} />
              Alle 6 Monate per Email an mich erinnern, dieses Dokument zu aktualisieren
            </label>

            {formError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{formError}</p>}
            <button onClick={handleUpload} disabled={saving} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: GREEN, opacity: saving ? 0.7 : 1 }}>
              {saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Wird hochgeladen…" : "Hochladen"}
            </button>
          </div>
        </div>
      )}

      {editingDoc && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setEditingDoc(null); } }}>
          <div className="w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Dokument bearbeiten</h2><button onClick={() => setEditingDoc(null)}><X size={20} /></button></div>

            <label className="text-xs font-medium block mb-1">Kategorie</label>
            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
              {CATEGORY_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {CATEGORIES.filter((c) => c.group === g).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </optgroup>
              ))}
              <option value="eigene">Eigene Kategorie…</option>
            </select>
            {editCategory === "eigene" && (
              <input value={editCustomCategory} onChange={(e) => setEditCustomCategory(e.target.value)} placeholder="Name der Kategorie" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
            )}

            <label className="text-xs font-medium block mb-1">Titel</label>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Notiz (optional)</label>
            <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={3} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border resize-none" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Datei</label>
            <p className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Aktuell: {editingDoc.file_name}</p>
            <input type="file" onChange={(e) => setEditFile(e.target.files[0] || null)} className="w-full text-sm mb-3" />
            <p className="text-xs mb-3" style={{ color: INK_SOFT }}>Leer lassen, um die aktuelle Datei zu behalten.</p>

            <label className="flex items-center gap-2 text-xs font-medium mb-3">
              <input type="checkbox" checked={editReminderEnabled} onChange={(e) => setEditReminderEnabled(e.target.checked)} />
              Alle 6 Monate per Email an mich erinnern, dieses Dokument zu aktualisieren
            </label>

            {editError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{editError}</p>}
            <button onClick={handleSaveEdit} disabled={savingEdit} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: GREEN, opacity: savingEdit ? 0.7 : 1 }}>
              {savingEdit && <Loader2 size={15} className="animate-spin" />} {savingEdit ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      )}

      {showAddTrusted && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowAddTrusted(false); } }}>
          <div className="w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Vertrauensperson hinzufügen</h2><button onClick={() => setShowAddTrusted(false)}><X size={20} /></button></div>
            <select value={addTrustedUserId} onChange={(e) => setAddTrustedUserId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
              <option value="">Bitte wählen…</option>
              {allUsers.filter((u) => u.id !== user.id && !trustedByMeIds.has(u.id)).map((u) => (
                <option key={u.id} value={u.id}>{fullNameFor(u.id)}</option>
              ))}
            </select>
            {trustedError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{trustedError}</p>}
            <button onClick={handleAddTrusted} disabled={savingTrusted || !addTrustedUserId} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: GREEN, opacity: savingTrusted || !addTrustedUserId ? 0.6 : 1 }}>
              {savingTrusted && <Loader2 size={15} className="animate-spin" />} {savingTrusted ? "Speichern…" : "Hinzufügen"}
            </button>
          </div>
        </div>
      )}

      {showNotfallpassForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowNotfallpassForm(false); } }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Notfallpass</h2><button onClick={() => setShowNotfallpassForm(false)}><X size={20} /></button></div>
            <p className="text-xs mb-4" style={{ color: INK_SOFT }}>Wichtige Angaben für den medizinischen Ernstfall. Sichtbar für dich, deine Vertrauenspersonen und den Superadmin.</p>

            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: GREEN }}>Persönliche Daten</div>
            <NpTextInput label="Name" value={npForm.name} onChange={(v) => updateNpField("name", v)} />
            <NpTextInput label="Geburtsdatum" type="date" value={npForm.geburtsdatum} onChange={(v) => updateNpField("geburtsdatum", v)} />
            <NpTextInput label="Adresse" value={npForm.adresse} onChange={(v) => updateNpField("adresse", v)} />
            <NpTextInput label="Blutgruppe" value={npForm.blutgruppe} onChange={(v) => updateNpField("blutgruppe", v)} placeholder="z.B. A positiv" />

            <div className="text-xs font-bold uppercase tracking-wide mb-2 mt-2" style={{ color: GREEN }}>Medizinische Angaben</div>
            <NpTextArea label="Bekannte Vorerkrankungen" value={npForm.vorerkrankungen} onChange={(v) => updateNpField("vorerkrankungen", v)} placeholder="z.B. Diabetes, Herzerkrankung, Epilepsie" />
            <NpTextArea label="Allergien / Unverträglichkeiten" value={npForm.allergien} onChange={(v) => updateNpField("allergien", v)} placeholder="besonders Medikamentenallergien" />
            <NpMedicationList value={npForm.medikamente_liste} onChange={(v) => updateNpField("medikamente_liste", v)} />
            <NpTextArea label="Implantate / Geräte" value={npForm.implantate} onChange={(v) => updateNpField("implantate", v)} placeholder="z.B. Herzschrittmacher, künstliches Gelenk, Insulinpumpe" rows={2} />
            <NpTextArea label="Frühere Operationen (falls relevant)" value={npForm.operationen} onChange={(v) => updateNpField("operationen", v)} rows={2} />

            <div className="text-xs font-bold uppercase tracking-wide mb-2 mt-2" style={{ color: GREEN }}>Notfallkontakte</div>
            <NpTextInput label="Notfallkontakt 1 – Name" value={npForm.kontakt1_name} onChange={(v) => updateNpField("kontakt1_name", v)} />
            <NpTextInput label="Notfallkontakt 1 – Telefon" value={npForm.kontakt1_telefon} onChange={(v) => updateNpField("kontakt1_telefon", v)} />
            <NpTextInput label="Notfallkontakt 2 – Name (optional)" value={npForm.kontakt2_name} onChange={(v) => updateNpField("kontakt2_name", v)} />
            <NpTextInput label="Notfallkontakt 2 – Telefon (optional)" value={npForm.kontakt2_telefon} onChange={(v) => updateNpField("kontakt2_telefon", v)} />

            <div className="text-xs font-bold uppercase tracking-wide mb-2 mt-2" style={{ color: GREEN }}>Behandelnde Ärzte</div>
            <NpTextInput label="Hausarzt – Name" value={npForm.hausarzt_name} onChange={(v) => updateNpField("hausarzt_name", v)} />
            <NpTextInput label="Hausarzt – Telefon" value={npForm.hausarzt_telefon} onChange={(v) => updateNpField("hausarzt_telefon", v)} />
            <NpTextInput label="Facharzt – Name (optional)" value={npForm.facharzt_name} onChange={(v) => updateNpField("facharzt_name", v)} />
            <NpTextInput label="Facharzt – Telefon (optional)" value={npForm.facharzt_telefon} onChange={(v) => updateNpField("facharzt_telefon", v)} />

            <div className="text-xs font-bold uppercase tracking-wide mb-2 mt-2" style={{ color: GREEN }}>Versicherung</div>
            <NpTextInput label="Krankenkasse" value={npForm.krankenkasse} onChange={(v) => updateNpField("krankenkasse", v)} />
            <NpTextInput label="Versichertennummer" value={npForm.versichertennummer} onChange={(v) => updateNpField("versichertennummer", v)} />

            <div className="text-xs font-bold uppercase tracking-wide mb-2 mt-2" style={{ color: GREEN }}>Verweise auf Vorsorgedokumente</div>
            <NpTextArea label="Patientenverfügung / Vorsorgevollmacht – Aufbewahrungsort & Kontakt der bevollmächtigten Person" value={npForm.vorsorge_hinweis} onChange={(v) => updateNpField("vorsorge_hinweis", v)} placeholder="Das Dokument selbst gehört nicht hierher, nur der Hinweis darauf" rows={2} />

            <div className="text-xs font-bold uppercase tracking-wide mb-2 mt-2" style={{ color: GREEN }}>Optional</div>
            <label className="flex items-center gap-2 text-xs font-medium mb-3">
              <input type="checkbox" checked={npForm.organspendeausweis} onChange={(e) => updateNpField("organspendeausweis", e.target.checked)} />
              Hat einen Organspendeausweis
            </label>
            <NpTextArea label="Patientenverfügung (Kurzform)" value={npForm.patientenverfuegung_kurzform} onChange={(v) => updateNpField("patientenverfuegung_kurzform", v)} rows={3} />
            <NpTextArea label="Besondere Hinweise" value={npForm.besondere_hinweise} onChange={(v) => updateNpField("besondere_hinweise", v)} placeholder="z.B. Schwangerschaft, Sprachbarriere, Behinderung" rows={2} />

            {npError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{npError}</p>}
            <button onClick={handleSaveNotfallpass} disabled={savingNp} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: GREEN, opacity: savingNp ? 0.7 : 1 }}>
              {savingNp && <Loader2 size={15} className="animate-spin" />} {savingNp ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      )}

      {viewingNotfallpassOwnerId && viewingNp && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setViewingNotfallpassOwnerId(null); } }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{viewingNotfallpassOwnerId === user.id ? "Mein Notfallpass" : `Notfallpass – ${nameFor(viewingNotfallpassOwnerId)}`}</h2>
              <button onClick={() => setViewingNotfallpassOwnerId(null)}><X size={20} /></button>
            </div>
            {viewingNotfallpassOwnerId === user.id && (
              <button
                onClick={() => { setViewingNotfallpassOwnerId(null); openNotfallpassForm(); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold mb-4"
                style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK }}
              >
                <Pencil size={14} /> Bearbeiten
              </button>
            )}
            <NotfallpassReadonly record={viewingNp} />
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
