import React, { useState, useEffect, useMemo } from "react";
import {
  Home, Plus, X, AlertCircle, Loader2, Lock, FileText, Download, Trash2, Pencil,
  Users, UserPlus, ShieldCheck, ChevronDown, ChevronRight, Share2,
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

  // Zusaetzliche Passwortabfrage beim Oeffnen dieser einen App (auch wenn schon
  // eingeloggt) - einmal pro Browser-Tab-Sitzung, nicht bei jedem Klick innerhalb
  // der App.
  useEffect(() => {
    if (session && sessionStorage.getItem("vorsorge_pw_ok") === "1") setPwConfirmed(true);
  }, [session]);

  async function handleConfirmPassword() {
    setPwError("");
    if (!pwInput) return;
    setPwChecking(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: session.user.email, password: pwInput });
      if (error) throw error;
      sessionStorage.setItem("vorsorge_pw_ok", "1");
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

function DocumentRow({ doc, onDownload, downloading, onEdit, onDelete, onShare, shareCount, canManage }) {
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
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onDownload} disabled={downloading} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}>
            {downloading ? <Loader2 size={14} className="animate-spin" style={{ color: INK_SOFT }} /> : <Download size={14} style={{ color: INK_SOFT }} />}
          </button>
          {canManage && (
            <>
              <button onClick={onShare} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Share2 size={13} style={{ color: INK_SOFT }} /></button>
              <button onClick={onEdit} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Pencil size={13} style={{ color: INK_SOFT }} /></button>
              <button onClick={onDelete} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Trash2 size={13} style={{ color: "#A13D3D" }} /></button>
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
  const isAdmin = user.user_metadata?.is_admin === true;
  const isSuperAdmin = user.user_metadata?.is_superadmin === true;

  const [ownMemberId, setOwnMemberId] = useState(null);
  const [ownFotoUrl, setOwnFotoUrl] = useState(null);
  useEffect(() => {
    supabase.from("members").select("id, foto_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setOwnMemberId(data?.id || null);
      setOwnFotoUrl(data?.foto_url || null);
    });
  }, [user.id]);

  const [activeTab, setActiveTab] = useState("meine"); // "meine" | "freigegeben" | "alle"
  const [documents, setDocuments] = useState([]);
  const [shares, setShares] = useState([]);
  const [docShares, setDocShares] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [expandedOwners, setExpandedOwners] = useState(() => new Set());

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [docs, sh, dsh, us] = await Promise.all([
      supabase.from("vorsorge_documents").select("*").order("created_at", { ascending: false }),
      supabase.from("vorsorge_shares").select("*"),
      supabase.from("vorsorge_document_shares").select("*"),
      supabase.rpc("list_all_users"),
    ]);
    setDocuments(docs.data || []);
    setShares(sh.data || []);
    setDocShares(dsh.data || []);
    setAllUsers(us.data || []);
    setLoading(false);
  }

  function nameFor(userId) {
    if (userId === user.id) return `${userName} (Du)`;
    const u = allUsers.find((x) => x.id === userId);
    return u?.name || u?.email || "Unbekannt";
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

  // Leute, die MICH als Vertrauensperson eingetragen haben (voller Zugriff auf alles),
  // ODER mir einzelne Dokumente gezielt freigegeben haben.
  const trustingMe = useMemo(() => shares.filter((s) => s.trusted_user_id === user.id), [shares, user.id]);
  const myDocShares = useMemo(() => docShares.filter((ds) => ds.trusted_user_id === user.id), [docShares, user.id]);

  // ownerId -> { full: boolean, docIds: Set } - "full" heisst komplette Freigabe,
  // sonst nur die in docIds gelisteten einzelnen Dokumente.
  const sharedWithMeGroups = useMemo(() => {
    const groups = {};
    trustingMe.forEach((s) => {
      groups[s.owner_user_id] = groups[s.owner_user_id] || { full: false, docIds: new Set() };
      groups[s.owner_user_id].full = true;
    });
    myDocShares.forEach((ds) => {
      const doc = documents.find((d) => d.id === ds.document_id);
      if (!doc) return;
      groups[doc.owner_user_id] = groups[doc.owner_user_id] || { full: false, docIds: new Set() };
      groups[doc.owner_user_id].docIds.add(doc.id);
    });
    return groups;
  }, [trustingMe, myDocShares, documents]);

  const sharedWithMeOwnerIds = useMemo(() => Object.keys(sharedWithMeGroups), [sharedWithMeGroups]);

  function docsForSharedOwner(ownerId) {
    const g = sharedWithMeGroups[ownerId];
    if (!g) return [];
    if (g.full) return documents.filter((d) => d.owner_user_id === ownerId);
    return documents.filter((d) => g.docIds.has(d.id));
  }

  // Fuer die Superadmin-Uebersicht: alle Besitzer mit mind. 1 Dokument oder mind.
  // 1 Vertrauensperson, unabhaengig davon ob ich selbst als Vertrauensperson
  // eingetragen bin.
  const allOwnerIds = useMemo(() => {
    const ids = new Set();
    documents.forEach((d) => ids.add(d.owner_user_id));
    shares.forEach((s) => ids.add(s.owner_user_id));
    return [...ids];
  }, [documents, shares]);

  // --- Hochladen ---
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [formCategory, setFormCategory] = useState("testament");
  const [formCustomCategory, setFormCustomCategory] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formFile, setFormFile] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  function resetUploadForm() {
    setFormCategory("testament");
    setFormCustomCategory("");
    setFormTitle("");
    setFormNote("");
    setFormFile(null);
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
      });
      if (error) throw error;
      setShowUploadForm(false);
      resetUploadForm();
      await loadAll();
    } catch (e) {
      setFormError(e.message || "Hochladen fehlgeschlagen.");
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
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function openEdit(doc) {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditNote(doc.note || "");
    setEditCategory(doc.category);
    setEditCustomCategory(doc.custom_category || "");
    setEditFile(null);
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
      setEditError(e.message || "Konnte nicht gespeichert werden.");
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

  async function handleRemoveTrusted(shareId) {
    if (!window.confirm("Zugriff für diese Person wirklich entfernen?")) return;
    try {
      const { error } = await supabase.from("vorsorge_shares").delete().eq("id", shareId);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht entfernt werden.");
    }
  }

  // --- Einzelne Dokumente gezielt an eine Person freigeben (zusaetzlich zur vollen
  // Freigabe oben - z.B. nur die Bankvollmacht an eine bestimmte Person, ohne ihr
  // Zugriff auf alles zu geben). ---
  const [sharingDoc, setSharingDoc] = useState(null);
  const [addDocShareUserId, setAddDocShareUserId] = useState("");
  const [docShareError, setDocShareError] = useState("");
  const [savingDocShare, setSavingDocShare] = useState(false);

  function openShareDoc(doc) {
    setSharingDoc(doc);
    setAddDocShareUserId("");
    setDocShareError("");
  }

  async function handleAddDocShare() {
    if (!sharingDoc || !addDocShareUserId) return;
    setDocShareError("");
    setSavingDocShare(true);
    try {
      const { error } = await supabase.from("vorsorge_document_shares").insert({ document_id: sharingDoc.id, trusted_user_id: addDocShareUserId });
      if (error) throw error;
      setAddDocShareUserId("");
      await loadAll();
    } catch (e) {
      setDocShareError(e.message || "Konnte nicht freigegeben werden.");
    } finally {
      setSavingDocShare(false);
    }
  }

  async function handleRemoveDocShare(shareId) {
    try {
      const { error } = await supabase.from("vorsorge_document_shares").delete().eq("id", shareId);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht entfernt werden.");
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
          <div className="flex items-center gap-2.5">
            <img src="/vorsorge/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
            <h1 className="font-bold text-lg lg:text-2xl">Vorsorge</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>{ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}</button>
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Meine Dokumente</h2>
              <button onClick={() => { resetUploadForm(); setShowUploadForm(true); }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                <Plus size={14} /> Dokument hochladen
              </button>
            </div>

            {myDocuments.length === 0 ? (
              <div className="text-center py-10 rounded-xl mb-6" style={{ backgroundColor: "#fff" }}>
                <FileText className="mx-auto mb-2" size={22} style={{ color: INK_SOFT }} />
                <p className="text-sm" style={{ color: INK_SOFT }}>Noch keine Dokumente hochgeladen.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 mb-6">
                {myDocuments.map((doc) => (
                  <DocumentRow key={doc.id} doc={doc} onDownload={() => handleDownload(doc)} downloading={downloadingId === doc.id} onEdit={() => openEdit(doc)} onDelete={() => handleDeleteDoc(doc)} onShare={() => openShareDoc(doc)} shareCount={docSharesFor(doc.id).length} canManage />
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Vertrauenspersonen</h2>
              <button onClick={() => { setShowAddTrusted(true); setTrustedError(""); }} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                <UserPlus size={14} /> Hinzufügen
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: INK_SOFT }}>Diese Personen können jederzeit alle deine Dokumente einsehen und herunterladen.</p>
            {myTrustedPeople.length === 0 ? (
              <p className="text-sm mb-6" style={{ color: INK_SOFT }}>Noch niemand eingetragen.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-6">
                {myTrustedPeople.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3.5 rounded-xl" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                    <div className="flex items-center gap-2.5 text-sm font-semibold"><Users size={15} style={{ color: INK_SOFT }} /> {nameFor(s.trusted_user_id)}</div>
                    <button onClick={() => handleRemoveTrusted(s.id)} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: "#A13D3D" }}>Entfernen</button>
                  </div>
                ))}
              </div>
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
                  return (
                    <div key={ownerId} className="rounded-xl overflow-hidden" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <button onClick={() => toggleOwnerExpanded(ownerId)} className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left">
                        <div className="flex items-center gap-2 min-w-0">
                          {expanded ? <ChevronDown size={14} style={{ color: INK }} className="flex-shrink-0" /> : <ChevronRight size={14} style={{ color: INK }} className="flex-shrink-0" />}
                          <span className="text-sm font-semibold truncate">{nameFor(ownerId)}</span>
                        </div>
                        <span className="text-xs flex-shrink-0" style={{ color: INK_SOFT }}>{docs.length} Dokument{docs.length === 1 ? "" : "e"}</span>
                      </button>
                      {expanded && (
                        <div className="px-3.5 pb-3.5">
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
                return (
                  <div key={ownerId} className="mb-6">
                    <h2 className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>{nameFor(ownerId)}</h2>
                    <p className="text-xs mb-2" style={{ color: INK_SOFT }}>
                      {docs.length} Dokument{docs.length === 1 ? "" : "e"} · Vertrauenspersonen: {trustedFor.length === 0 ? "keine" : trustedFor.map((s) => nameFor(s.trusted_user_id)).join(", ")}
                    </p>
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

            {editError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{editError}</p>}
            <button onClick={handleSaveEdit} disabled={savingEdit} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: GREEN, opacity: savingEdit ? 0.7 : 1 }}>
              {savingEdit && <Loader2 size={15} className="animate-spin" />} {savingEdit ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </div>
      )}

      {sharingDoc && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setSharingDoc(null); } }}>
          <div className="w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Dokument freigeben</h2><button onClick={() => setSharingDoc(null)}><X size={20} /></button></div>
            <p className="text-xs mb-3" style={{ color: INK_SOFT }}>"{sharingDoc.title}" gezielt an einzelne Personen freigeben - unabhängig von deinen Vertrauenspersonen, die ohnehin bereits alles sehen.</p>

            {docSharesFor(sharingDoc.id).length === 0 ? (
              <p className="text-sm mb-3" style={{ color: INK_SOFT }}>Noch niemand einzeln freigeschaltet.</p>
            ) : (
              <div className="flex flex-col gap-2 mb-3">
                {docSharesFor(sharingDoc.id).map((ds) => (
                  <div key={ds.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ backgroundColor: "#fff" }}>
                    <div className="flex items-center gap-2 text-sm font-semibold"><Share2 size={13} style={{ color: INK_SOFT }} /> {nameFor(ds.trusted_user_id)}</div>
                    <button onClick={() => handleRemoveDocShare(ds.id)} className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: "#A13D3D" }}>Entfernen</button>
                  </div>
                ))}
              </div>
            )}

            <label className="text-xs font-medium block mb-1">Person hinzufügen</label>
            <select value={addDocShareUserId} onChange={(e) => setAddDocShareUserId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
              <option value="">Bitte wählen…</option>
              {allUsers
                .filter((u) => u.id !== user.id && !trustedByMeIds.has(u.id) && !docSharesFor(sharingDoc.id).some((ds) => ds.trusted_user_id === u.id))
                .map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
            {docShareError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{docShareError}</p>}
            <button onClick={handleAddDocShare} disabled={savingDocShare || !addDocShareUserId} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: GREEN, opacity: savingDocShare || !addDocShareUserId ? 0.6 : 1 }}>
              {savingDocShare && <Loader2 size={15} className="animate-spin" />} {savingDocShare ? "Speichern…" : "Freigeben"}
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
                <option key={u.id} value={u.id}>{u.name || u.email}</option>
              ))}
            </select>
            {trustedError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{trustedError}</p>}
            <button onClick={handleAddTrusted} disabled={savingTrusted || !addTrustedUserId} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2" style={{ backgroundColor: GREEN, opacity: savingTrusted || !addTrustedUserId ? 0.6 : 1 }}>
              {savingTrusted && <Loader2 size={15} className="animate-spin" />} {savingTrusted ? "Speichern…" : "Hinzufügen"}
            </button>
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
