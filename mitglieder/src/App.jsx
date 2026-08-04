import React, { useState, useEffect, useMemo } from "react";
import {
  User, Users, Phone, Smartphone, Mail, MapPin, Building2, Calendar,
  Download, Search, Plus, X, Pencil, Trash2, Loader2, AlertCircle, Home,
  LayoutGrid, Image as ImageIcon, Camera, ChevronDown, ChevronLeft, ChevronRight, Tag,
} from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";
import { PAPER, INK, INK_SOFT, BORDER, BORDER_SOFT } from "./theme";

const BLUE = "#2E86AB";

function mitgliedstypInfo(typ) {
  if (typ === "gast") return { label: "Gast", color: "#C9752F" };
  if (typ === "bewohner") return { label: "Bewohner", color: "#6C63A6" };
  return { label: "Genossenschaftsmitglied", shortLabel: "Mitglied", color: BLUE };
}

// Zeigt die neuen, getrennten Adressfelder formatiert an; faellt auf die alte
// "anschrift"-Spalte zurueck, solange ein Mitglied seine Adresse noch nicht neu
// eingetragen hat (die alten Daten gehen dabei nicht verloren).
function formatAddress(m) {
  const line1 = [m.strasse, m.hausnummer].filter(Boolean).join(" ");
  const line2 = [m.plz, m.wohnort].filter(Boolean).join(" ");
  const combined = [line1, line2].filter(Boolean).join(", ");
  return combined || m.anschrift || "";
}

// Gruppen (frueher "Bereiche") kommen jetzt aus der Datenbank (Tabelle "bereiche"),
// damit Admins jederzeit neue Gruppen anlegen koennen. Farben werden beim Anlegen
// rotierend aus dieser Palette vergeben.
const GROUP_COLOR_PALETTE = ["#2E86AB", "#6C63A6", "#B54A45", "#C9A227", "#1F6F5C", "#C9752F", "#3E8E7E", "#A13D3D"];

function slugifyGroupKey(label, existingKeys) {
  const base = label
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "gruppe";
  let key = base;
  let i = 2;
  while (existingKeys.includes(key)) {
    key = `${base}_${i}`;
    i += 1;
  }
  return key;
}

function fmtBirthday(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildVCard(m) {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`N:${m.nachname};${m.vorname};;;`);
  lines.push(`FN:${m.vorname} ${m.nachname}`);
  if (m.strasse || m.hausnummer || m.plz || m.wohnort || m.anschrift) {
    const street = [m.strasse, m.hausnummer].filter(Boolean).join(" ") || (m.anschrift ? m.anschrift.replace(/\n/g, ", ") : "");
    lines.push(`ADR;TYPE=HOME:;;${street};${m.wohnort || ""};;${m.plz || ""};`);
  }
  if (m.telefon) lines.push(`TEL;TYPE=HOME,VOICE:${m.telefon}`);
  if (m.handy) lines.push(`TEL;TYPE=CELL:${m.handy}`);
  if (m.email) lines.push(`EMAIL;TYPE=INTERNET:${m.email}`);
  if (m.geburtstag) lines.push(`BDAY:${m.geburtstag}`);
  if (m.wohneinheit) lines.push(`NOTE:Wohneinheit ${m.wohneinheit} · NaWoDo eG`);
  else lines.push("NOTE:NaWoDo eG");
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function uploadFile(file, pathPrefix) {
  const ext = file.name.split(".").pop();
  const path = `${pathPrefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function resizeImage(file, maxDim = 600, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Bild konnte nicht verarbeitet werden."));
        resolve(new File([blob], "profilbild.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Bild konnte nicht gelesen werden.")); };
    img.src = url;
  });
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
      .eq("app_key", "mitglieder")
      .maybeSingle()
      .then(({ data }) => setAccess(!data || data.allowed !== false))
      .catch(() => setAccess(true));
  }, [session]);

  useEffect(() => {
    // Suite-weiter Ein/Aus-Schalter (app_settings.app_enabled_mitglieder), fehlt die Zeile ist die App an.
    if (!session) return;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_enabled_mitglieder")
      .maybeSingle()
      .then(({ data }) => setAppEnabled(!data || data.value !== false))
      .catch(() => setAppEnabled(true));
  }, [session]);

  if (session === undefined || session === null || access === undefined || appEnabled === undefined) {
    return <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={28} style={{ color: INK_SOFT }} /></div>;
  }

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

  return <MitgliederApp session={session} />;
}

function MitgliederApp({ session }) {
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
  const isSuperAdmin = user.user_metadata?.is_superadmin === true; // darf zusaetzlich Accounts anlegen/loeschen
  const initial = userName.charAt(0).toUpperCase();

  // Popups per ESC-Taste schliessbar machen.
  useEffect(() => {
    function handleEscape(e) {
      if (e.key !== "Escape") return;
      setShowAddGroup(false);
      setGroupAssignFor(null);
      setProfileMember(null);
      setShowForm(false);
      setShowAccount(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const [members, setMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [bereicheAssign, setBereicheAssign] = useState([]);
  const [bereiche, setBereiche] = useState([]);
  const [appModerators, setAppModerators] = useState([]);
  // Moderator = Admin-Rechte, aber nur fuer einzelne Apps (siehe app_moderators). Ein globaler
  // Admin/Superadmin hat diese Rechte automatisch ueberall; Moderatoren nur fuer die ihnen
  // zugewiesenen Apps.
  const myModApps = useMemo(
    () => appModerators.filter((r) => r.user_id === user.id).map((r) => r.app_key),
    [appModerators, user.id]
  );
  const isElevatedForMitglieder = isSuperAdmin || isAdmin || myModApps.includes("mitglieder");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeBereich, setActiveBereich] = useState(null);
  const [typeFilter, setTypeFilter] = useState("alle"); // "mitglieder" | "gast" | "bewohner" | "kinder" | "alle"
  // Alle vier Kategorien sind Opt-in: nur sichtbar, wenn der Superadmin sie fuer dieses
  // Mitglied ueber die Settings-App freigeschaltet hat (member_permissions). "Alle" zeigt
  // dann nur die Vereinigung der freigeschalteten Kategorien, nicht wirklich alle.
  const [canFilterGenossenschaft, setCanFilterGenossenschaft] = useState(false);
  const [canFilterGast, setCanFilterGast] = useState(false);
  const [canFilterBewohner, setCanFilterBewohner] = useState(false);
  const [canFilterKinder, setCanFilterKinder] = useState(false);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [profileMember, setProfileMember] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [targetSelfUserId, setTargetSelfUserId] = useState(null);
  const [formIsChild, setFormIsChild] = useState(false);
  const [formNachname, setFormNachname] = useState("");
  const [formVorname, setFormVorname] = useState("");
  const [formSpitzname, setFormSpitzname] = useState("");
  const [formStrasse, setFormStrasse] = useState("");
  const [formHausnummer, setFormHausnummer] = useState("");
  const [formPlz, setFormPlz] = useState("");
  const [formWohnort, setFormWohnort] = useState("");
  const [formWohneinheit, setFormWohneinheit] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTelefon, setFormTelefon] = useState("");
  const [formHandy, setFormHandy] = useState("");
  const [formGeburtstag, setFormGeburtstag] = useState("");
  const [formGeburtstagVersteckt, setFormGeburtstagVersteckt] = useState(false);
  const [formFotoFile, setFormFotoFile] = useState(null);
  const [formFotoPreview, setFormFotoPreview] = useState(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [groupAssignFor, setGroupAssignFor] = useState(null);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [newGroupEmail, setNewGroupEmail] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupRenameKey, setGroupRenameKey] = useState(null);
  const [groupRenameLabel, setGroupRenameLabel] = useState("");
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
    const [m, bu, ba, gr, mods, filterPerms] = await Promise.all([
      supabase.from("members").select("*"),
      supabase.rpc("list_all_users"),
      supabase.from("member_bereiche").select("*"),
      supabase.from("bereiche").select("*"),
      supabase.from("app_moderators").select("*"),
      supabase.from("member_permissions").select("app_key,allowed").eq("user_id", user.id).in("app_key", ["mitglieder_genossenschaft", "mitglieder_gaeste", "mitglieder_bewohner", "mitglieder_kinder"]),
    ]);
    setMembers(m.data || []);
    setAllUsers(bu.data || []);
    setBereicheAssign(ba.data || []);
    setBereiche(gr.data || []);
    setAppModerators(mods.data || []);
    const fp = filterPerms.data || [];
    setCanFilterGenossenschaft(fp.some((r) => r.app_key === "mitglieder_genossenschaft" && r.allowed === true));
    setCanFilterGast(fp.some((r) => r.app_key === "mitglieder_gaeste" && r.allowed === true));
    setCanFilterBewohner(fp.some((r) => r.app_key === "mitglieder_bewohner" && r.allowed === true));
    setCanFilterKinder(fp.some((r) => r.app_key === "mitglieder_kinder" && r.allowed === true));
    setLoading(false);
  }

  // Vorbelegte Gesamtliste: jeder registrierte Account erscheint schon, auch wenn er sein
  // Profil noch nicht ausgefüllt hat (dann als "Platzhalter" mit Namen aus dem Account).
  const roster = useMemo(() => {
    const anyMemberByUserId = {};
    members.forEach((m) => { if (m.user_id) anyMemberByUserId[m.user_id] = m; });
    const selfByUserId = {};
    members.forEach((m) => { if (!m.is_child && m.user_id) selfByUserId[m.user_id] = m; });
    // Nutzer, deren einziger Eintrag ein Kind-Profil mit eigenem Login ist, tauchen nur
    // ueber "children" unten auf - sonst gaebe es sie doppelt (einmal als Platzhalter-Erwachsener).
    const adults = allUsers
      .filter((u) => !(anyMemberByUserId[u.id] && anyMemberByUserId[u.id].is_child))
      .map((u) => {
        const existing = selfByUserId[u.id];
        if (existing) return { ...existing, isPlaceholder: false };
        return {
          id: null, user_id: u.id, created_by: null, is_child: false, isPlaceholder: true,
          vorname: u.name, nachname: "", anschrift: null, strasse: null, hausnummer: null, plz: null, wohnort: null, wohneinheit: null,
          email: u.email, telefon: null, handy: null, geburtstag: null, foto_url: null,
          parent1_user_id: null, parent2_user_id: null, related_user_id: null,
        };
      });
    const children = members.filter((m) => m.is_child);
    return [...adults, ...children].sort((a, b) => {
      const av = (a.vorname || "").trim();
      const an = (a.nachname || "").trim();
      const bv = (b.vorname || "").trim();
      const bn = (b.nachname || "").trim();
      return (
        av.localeCompare(bv, "de", { sensitivity: "base" }) ||
        an.localeCompare(bn, "de", { sensitivity: "base" })
      );
    });
  }, [members, allUsers]);

  function memberByUserId(id) { return members.find((m) => m.user_id === id && !m.is_child); }
  function parentNames(m) {
    const names = [];
    if (m.parent1_user_id) { const p = memberByUserId(m.parent1_user_id); if (p) names.push(`${p.vorname} ${p.nachname}`); }
    if (m.parent2_user_id) { const p = memberByUserId(m.parent2_user_id); if (p) names.push(`${p.vorname} ${p.nachname}`); }
    return names;
  }
  function parentMembers(m) {
    const list = [];
    if (m.parent1_user_id) { const p = memberByUserId(m.parent1_user_id); if (p) list.push(p); }
    if (m.parent2_user_id) { const p = memberByUserId(m.parent2_user_id); if (p) list.push(p); }
    return list;
  }
  function childrenOf(m) {
    if (!m.user_id) return [];
    return members.filter((c) => c.is_child && (c.parent1_user_id === m.user_id || c.parent2_user_id === m.user_id));
  }
  function relatedMemberOf(m) {
    if (!m.related_user_id) return null;
    return memberByUserId(m.related_user_id) || null;
  }
  function bereicheForMember(memberId) {
    if (!memberId) return [];
    return bereicheAssign.filter((b) => b.member_id === memberId).map((b) => b.bereich_key);
  }
  function countForBereich(key) {
    return roster.filter((m) => m.id && bereicheForMember(m.id).includes(key)).length;
  }
  function bereichInfo(key) { return bereiche.find((b) => b.key === key); }
  function toggleExpand(key) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  const sortedBereiche = useMemo(
    () => [...bereiche].sort((a, b) => a.label.localeCompare(b.label, "de")),
    [bereiche]
  );

  async function handleAddGroup() {
    if (!newGroupLabel.trim()) return;
    setSavingGroup(true);
    try {
      const key = slugifyGroupKey(newGroupLabel.trim(), bereiche.map((b) => b.key));
      const color = GROUP_COLOR_PALETTE[bereiche.length % GROUP_COLOR_PALETTE.length];
      const { error } = await supabase
        .from("bereiche")
        .insert({ key, label: newGroupLabel.trim(), email: newGroupEmail.trim() || null, color });
      if (error) throw error;
      setNewGroupLabel("");
      setNewGroupEmail("");
      await loadAll();
    } catch (e) {
      alert(e.message || "Gruppe konnte nicht angelegt werden.");
    } finally {
      setSavingGroup(false);
    }
  }

  async function handleRenameGroup(key) {
    if (!groupRenameLabel.trim()) return;
    try {
      const { error } = await supabase.from("bereiche").update({ label: groupRenameLabel.trim() }).eq("key", key);
      if (error) throw error;
      setGroupRenameKey(null);
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht umbenannt werden.");
    }
  }

  async function handleDeleteGroup(key, label) {
    if (!window.confirm(`Gruppe "${label}" wirklich löschen? Die Zuordnung aller Mitglieder zu dieser Gruppe geht dabei verloren. Das kann nicht rückgängig gemacht werden.`)) return;
    try {
      const { error } = await supabase.from("bereiche").delete().eq("key", key);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht gelöscht werden.");
    }
  }

  async function handleToggleMemberGroup(memberId, bereichKey, nextValue) {
    try {
      if (nextValue) {
        const { error } = await supabase.from("member_bereiche").insert({ member_id: memberId, bereich_key: bereichKey });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("member_bereiche").delete().eq("member_id", memberId).eq("bereich_key", bereichKey);
        if (error) throw error;
      }
      await loadAll();
    } catch (e) {
      alert(e.message || "Gruppe konnte nicht geändert werden.");
    }
  }


  const q = search.trim().toLowerCase();
  // Erste Stufe: nur Kategorien zeigen, fuer die diese/r Betrachter:in freigeschaltet ist
  // (Moderatoren/Admins/Superadmin sehen immer alles). Die eigene Karte ist davon ausgenommen,
  // damit man sich immer selbst findet und bearbeiten kann.
  function categoryAllowed(m) {
    if (isElevatedForMitglieder) return true;
    if (m.user_id && m.user_id === user.id) return true;
    if (m.is_child) return canFilterKinder;
    if (m.mitgliedstyp === "gast") return canFilterGast;
    if (m.mitgliedstyp === "bewohner") return canFilterBewohner;
    return canFilterGenossenschaft;
  }

  const visibleMembers = useMemo(() => {
    return roster
      .filter(categoryAllowed)
      .filter((m) => {
        if (typeFilter === "alle") return true;
        if (typeFilter === "kinder") return m.is_child;
        if (typeFilter === "gast") return !m.is_child && m.mitgliedstyp === "gast";
        if (typeFilter === "bewohner") return !m.is_child && m.mitgliedstyp === "bewohner";
        return !m.is_child && (m.mitgliedstyp || "mitglied") === "mitglied";
      })
      .filter((m) => !activeBereich || (m.id && bereicheForMember(m.id).includes(activeBereich)))
      .filter((m) => !q || `${m.vorname} ${m.nachname} ${formatAddress(m)} ${m.wohneinheit || ""} ${m.email || ""}`.toLowerCase().includes(q));
  }, [roster, activeBereich, q, bereicheAssign, typeFilter, isElevatedForMitglieder, canFilterGenossenschaft, canFilterGast, canFilterBewohner, canFilterKinder, user.id]);

  function resetForm() {
    setFormIsChild(false);
    setFormNachname("");
    setFormVorname("");
    setFormSpitzname("");
    setFormStrasse("");
    setFormHausnummer("");
    setFormPlz("");
    setFormWohnort("");
    setFormWohneinheit("");
    setFormEmail("");
    setFormTelefon("");
    setFormHandy("");
    setFormGeburtstag("");
    setFormGeburtstagVersteckt(false);
    setFormParent2("");
    setFormFotoFile(null);
    setFormFotoPreview(null);
    setFormError("");
  }

  // Admin (oder man selbst) kann den Platzhalter-Eintrag eines registrierten Accounts ausfüllen.
  function openFillPlaceholder(row) {
    resetForm();
    setEditingMember(null);
    setTargetSelfUserId(row.user_id);
    setFormIsChild(false);
    setFormVorname(row.vorname || "");
    // Die Login-Email steht schon fest (der Account existiert ja bereits) - deshalb hier
    // direkt vorbelegen, statt das Feld leer zu lassen und erneutes Eintippen zu verlangen.
    setFormEmail(row.email || "");
    setShowForm(true);
  }

  // Fuer den Button "Eintrag bearbeiten" im Konto-Popup: eigenen bestehenden
  // Eintrag oeffnen, oder falls noch keiner existiert, den Platzhalter-Fluss.
  function openOwnEntry() {
    const own = members.find((m) => m.user_id === user.id && !m.is_child);
    if (own) {
      openEditForm(own);
    } else {
      openFillPlaceholder({ user_id: user.id, vorname: userName, email: user.email });
    }
  }

  function openEditForm(m) {
    setEditingMember(m);
    setTargetSelfUserId(m.user_id || null);
    setFormIsChild(m.is_child);
    setFormNachname(m.nachname);
    setFormVorname(m.vorname);
    setFormSpitzname(m.spitzname || "");
    setFormStrasse(m.strasse || "");
    setFormHausnummer(m.hausnummer || "");
    setFormPlz(m.plz || "");
    setFormWohnort(m.wohnort || "");
    setFormWohneinheit(m.wohneinheit || "");
    setFormEmail(m.email || "");
    setFormTelefon(m.telefon || "");
    setFormHandy(m.handy || "");
    setFormGeburtstag(m.geburtstag || "");
    setFormGeburtstagVersteckt(m.geburtstag_versteckt === true);
    setFormFotoFile(null);
    setFormFotoPreview(m.foto_url || null);
    setFormError("");
    setShowForm(true);
  }

  async function onFotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormFotoPreview(URL.createObjectURL(file));
    try {
      const resized = await resizeImage(file);
      setFormFotoFile(resized);
    } catch {
      setFormFotoFile(file);
    }
  }

  // Die Login-Email (auth.users) und die hier gepflegte Kontakt-Email (members.email)
  // sollen immer identisch sein. Aendert sich die Email eines Eintrags mit eigenem
  // Login, wird zusaetzlich zur members-Zeile auch der Login ueber die Edge Function
  // aktualisiert (direkt, ohne Bestaetigungsmail - auf dieser Instanz ist kein
  // Mailversand eingerichtet). Das darf man fuer sich selbst, und der Superadmin fuer
  // jeden.
  async function syncLoginEmail(targetUserId, email) {
    const resp = await fetch(`${window.__SUPABASE_URL__}/functions/v1/admin-create-account`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type: "set_email", target_user_id: targetUserId, email }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || "Login-Email konnte nicht mit geändert werden.");
  }

  async function handleSave() {
    setFormError("");
    if (!formVorname.trim()) return setFormError("Bitte einen Vornamen eintragen.");
    if (!formIsChild && !formEmail.trim()) return setFormError("Bitte eine E-Mail-Adresse eintragen.");
    const newEmailCheck = formEmail.trim().toLowerCase() || null;
    if (newEmailCheck && (!editingMember || (editingMember.email || "").toLowerCase() !== newEmailCheck)) {
      const { data: dupe } = await supabase.from("members").select("id").ilike("email", newEmailCheck).neq("id", editingMember?.id || "00000000-0000-0000-0000-000000000000").maybeSingle();
      if (dupe) return setFormError("Diese E-Mail-Adresse wird bereits von einem anderen Mitglied verwendet.");
    }
    setSaving(true);
    try {
      let fotoUrl = editingMember ? editingMember.foto_url : null;
      if (formFotoFile) fotoUrl = await uploadFile(formFotoFile, "mitglied-foto");

      const newEmail = formEmail.trim() || null;
      const payload = {
        nachname: formNachname.trim(),
        vorname: formVorname.trim(),
        spitzname: formSpitzname.trim() || null,
        strasse: formStrasse.trim() || null,
        hausnummer: formHausnummer.trim() || null,
        plz: formPlz.trim() || null,
        wohnort: formWohnort.trim() || null,
        wohneinheit: formWohneinheit.trim() || null,
        email: newEmail,
        telefon: formTelefon.trim() || null,
        handy: formHandy.trim() || null,
        geburtstag: formGeburtstag || null,
        geburtstag_versteckt: formGeburtstagVersteckt,
        foto_url: fotoUrl,
      };
      let savedId = editingMember?.id || null;
      // Fuer wen (falls vorhanden) muss ggf. die Login-Email mit synchronisiert werden.
      const loginUserId = editingMember ? editingMember.user_id : (targetSelfUserId || user.id);
      const emailChanged = editingMember ? (editingMember.email || null) !== newEmail : !!newEmail;

      if (editingMember) {
        const { error } = await supabase.from("members").update(payload).eq("id", editingMember.id);
        if (error) throw error;
      } else {
        const uid = targetSelfUserId || user.id;
        payload.is_child = false;
        payload.created_by = user.id;
        payload.user_id = uid;
        const { data, error } = await supabase.from("members").insert(payload).select().single();
        if (error) throw error;
        savedId = data.id;
      }

      if (loginUserId && emailChanged && newEmail) {
        try {
          await syncLoginEmail(loginUserId, newEmail);
        } catch (e) {
          // Profil ist schon gespeichert - Formular trotzdem schliessen (siehe unten),
          // nur zusaetzlich per alert() auf das Problem mit der Login-Email hinweisen.
          alert(`Profil gespeichert, aber Login-Email konnte nicht mit geändert werden: ${e.message}`);
        }
      }

      setShowForm(false);
      setEditingMember(null);
      await loadAll();
    } catch (e) {
      setFormError(e.message || "Speichern hat nicht geklappt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m) {
    if (!window.confirm(`Eintrag von ${m.vorname} ${m.nachname} wirklich löschen?`)) return;
    try {
      await supabase.from("members").delete().eq("id", m.id);
      await loadAll();
    } catch {}
  }

  function exportVCard(m) {
    downloadBlob(buildVCard(m), `${m.vorname}-${m.nachname || ""}.vcf`, "text/vcard;charset=utf-8");
  }

  function exportAllCSV() {
    const header = ["Nachname", "Vorname", "Spitzname", "Straße", "Hausnummer", "PLZ", "Wohnort", "Wohneinheit", "Email", "Telefon", "Handy", "Geburtstag", "Typ", "Mitgliedstyp", "Eltern", "Gruppen"];
    const rows = roster.map((m) => [
      m.nachname, m.vorname, m.spitzname || "", m.strasse || "", m.hausnummer || "", m.plz || "", m.wohnort || "", m.wohneinheit || "", m.email || "", m.telefon || "", m.handy || "",
      m.geburtstag || "", m.is_child ? "Kind" : "Erwachsen", mitgliedstypInfo(m.mitgliedstyp).label, parentNames(m).join(" / "),
      m.id ? bereicheForMember(m.id).map((k) => bereichInfo(k)?.label || k).join(" / ") : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(";")).join("\r\n");
    downloadBlob("﻿" + csv, "nawodo-mitglieder.csv", "text/csv;charset=utf-8");
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

  if (loading) {
    return <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={28} style={{ color: INK_SOFT }} /></div>;
  }

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-3xl mx-auto lg:max-w-none lg:w-2/3 lg:mx-auto">
        <div className="px-5 pt-6 pb-3 flex items-center justify-between sticky top-0 z-30" style={{ backgroundColor: PAPER }}>
          <a href="/" className="flex items-center gap-2.5">
            <img src="/mitglieder/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
            <h1 className="font-bold text-lg lg:text-2xl">Mitglieder</h1>
          </a>
          <div className="flex items-center gap-2">
            <span className="text-xs lg:text-sm font-bold truncate max-w-[110px] lg:max-w-[180px]" style={{ color: INK_SOFT }}>Hallo {(members.find((m) => m.user_id === user.id && !m.is_child)?.spitzname) || (members.find((m) => m.user_id === user.id && !m.is_child)?.vorname) || userName}</span>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>{ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}</button>
            <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
          </div>
        </div>

        <div className="flex items-start gap-3 px-5 relative">
          {/* Mobiler Aufklapp-Pfeil für die Gruppen-Navigation */}
          <button
            onClick={() => setShowMobileNav((v) => !v)}
            className="sm:hidden fixed left-0 top-1/2 -translate-y-1/2 z-50 w-7 h-10 rounded-r-full flex items-center justify-center shadow"
            style={{ backgroundColor: INK, color: "#fff" }}
          >
            {showMobileNav ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
          </button>
          {showMobileNav && (
            <div
              className="sm:hidden fixed inset-0 z-40"
              style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }}
              onClick={() => setShowMobileNav(false)}
            />
          )}

          {/* Navigation links: Gruppen als Filter, oben "Alle Mitglieder". Auf Mobil ein
              einschiebbares Seitenmenü, auf Desktop immer sichtbar. */}
          <div
            className={`flex flex-col gap-1 flex-shrink-0 w-64 sm:w-48 sm:sticky sm:top-3 max-h-[85vh] overflow-y-auto pb-4 fixed sm:static inset-y-0 left-0 z-50 sm:z-auto p-4 sm:p-0 transition-transform duration-200 ${showMobileNav ? "translate-x-0" : "-translate-x-full"} sm:translate-x-0`}
            style={{ backgroundColor: PAPER }}
          >
            <button
              onClick={() => { setActiveBereich(null); setShowMobileNav(false); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-left"
              style={{ backgroundColor: activeBereich === null ? INK : "transparent", color: activeBereich === null ? "#fff" : INK }}
            >
              <LayoutGrid size={13} /> Alle Mitglieder
            </button>
            <div className="text-[10px] font-bold uppercase tracking-wide px-3 mt-2 mb-0.5" style={{ color: INK_SOFT }}>Gruppen</div>
            {sortedBereiche.map((b) => {
              const active = activeBereich === b.key;
              const count = countForBereich(b.key);
              return (
                <button
                  key={b.key}
                  onClick={() => { setActiveBereich(b.key); setShowMobileNav(false); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left"
                  style={{ backgroundColor: active ? `${b.color}22` : "transparent", color: active ? b.color : INK_SOFT }}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                  <span className="flex-1 min-w-0">{b.label}</span>
                  {count > 0 && <span className="text-[10px] flex-shrink-0" style={{ color: INK_SOFT }}>{count}</span>}
                </button>
              );
            })}
            {isElevatedForMitglieder && (
              <button
                onClick={() => setShowAddGroup(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold mt-2 w-fit"
                style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
              >
                <Plus size={12} /> Neue Gruppe
              </button>
            )}
          </div>

          {/* Mitgliederliste */}
          <div className="flex-1 min-w-0">
            <div className="mb-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: INK_SOFT }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Mitglieder durchsuchen…"
                  className="w-full rounded-full pl-9 pr-3 py-2.5 text-sm border"
                  style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}
                />
              </div>
            </div>

            <div className="mb-3 flex items-center gap-1 p-1 rounded-full w-fit flex-wrap sticky z-20" style={{ backgroundColor: "#E4E1D3", top: "4.5rem" }}>
              {[
                ...(isElevatedForMitglieder || canFilterGenossenschaft ? [["mitglieder", "Genossenschaftsmitglieder"]] : []),
                ...(isElevatedForMitglieder || canFilterGast ? [["gast", "Gäste"]] : []),
                ...(isElevatedForMitglieder || canFilterBewohner ? [["bewohner", "Bewohner"]] : []),
                ...(isElevatedForMitglieder || canFilterKinder ? [["kinder", "Kinder"]] : []),
                ["alle", "Alle"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTypeFilter(key)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: typeFilter === key ? "#fff" : "transparent", color: typeFilter === key ? INK : INK_SOFT }}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeBereich && (
              <div className="mb-3 text-xs" style={{ color: INK_SOFT }}>
                {bereichInfo(activeBereich)?.email ? <>Kontakt: <a href={`mailto:${bereichInfo(activeBereich).email}`} className="font-semibold" style={{ color: bereichInfo(activeBereich).color }}>{bereichInfo(activeBereich).email}</a></> : "Kein E-Mail-Verteiler für diese Gruppe hinterlegt."}
              </div>
            )}

            <div className="flex flex-col gap-3">
              {visibleMembers.length === 0 && (
                <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}>
                  <p className="text-sm" style={{ color: INK_SOFT }}>Keine Einträge.</p>
                </div>
              )}
              {visibleMembers.map((m) => {
                const canManage = !m.isPlaceholder && (isSuperAdmin || m.user_id === user.id || m.created_by === user.id || (m.is_child && (m.parent1_user_id === user.id || m.parent2_user_id === user.id)));
                const canFill = m.isPlaceholder && (isSuperAdmin || m.user_id === user.id);
                const parents = m.is_child ? parentNames(m) : [];
                const myBereiche = m.id ? bereicheForMember(m.id) : [];
                const cardKey = m.id || `placeholder-${m.user_id}`;
                const isExpanded = expandedIds.has(cardKey);
                return (
                  <div key={cardKey} className="rounded-xl p-4" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", opacity: m.isPlaceholder ? 0.75 : 1 }}>
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(cardKey)} onDoubleClick={() => setProfileMember(m)} title="Doppelklick für vollständiges Profil">
                        {m.foto_url ? (
                          <img src={m.foto_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: m.is_child ? "#6C63A61A" : "#2E86AB1A", color: m.is_child ? "#6C63A6" : BLUE }}>
                            {m.is_child ? <Users size={16} /> : <User size={16} />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate flex items-center gap-1.5">
                            {m.vorname}{m.spitzname ? ` „${m.spitzname}“` : ""} {m.nachname}
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${mitgliedstypInfo(m.mitgliedstyp).color}1A`, color: mitgliedstypInfo(m.mitgliedstyp).color }}>
                              {mitgliedstypInfo(m.mitgliedstyp).shortLabel || mitgliedstypInfo(m.mitgliedstyp).label}
                            </span>
                          </div>
                        </div>
                        <ChevronDown size={14} className={`sm:hidden flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} style={{ color: INK_SOFT }} />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!m.isPlaceholder && <button onClick={() => exportVCard(m)} title="Als vCard herunterladen"><Download size={14} style={{ color: "#B8B4A2" }} /></button>}
                        {/* Auf Desktop (sm+) bleiben die Bearbeiten-Buttons oben neben dem Namen. Auf Mobile wandern sie
                            weiter unten in den aufklappbaren Bereich, unten rechts. */}
                        <div className="hidden sm:flex items-center gap-2">
                          {isElevatedForMitglieder && !m.isPlaceholder && m.id && !m.is_child && (
                            <button onClick={() => setGroupAssignFor(m)} title="Gruppen zuweisen"><Tag size={14} style={{ color: "#B8B4A2" }} /></button>
                          )}
                          {canManage && (
                            <>
                              <button onClick={() => openEditForm(m)}><Pencil size={14} style={{ color: "#B8B4A2" }} /></button>
                              <button onClick={() => handleDelete(m)}><Trash2 size={14} style={{ color: "#B8B4A2" }} /></button>
                            </>
                          )}
                        </div>
                        {canFill && (
                          <button onClick={() => openFillPlaceholder(m)} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#C9752F1A", color: "#C9752F" }}>
                            Ausfüllen
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`${isExpanded ? "block" : "hidden"} sm:block`}>
                      {m.is_child && <div className="text-xs mb-1" style={{ color: INK_SOFT }}>Kind{parents.length > 0 ? ` von ${parents.join(" & ")}` : ""}</div>}
                      {!m.is_child && (m.mitgliedstyp === "gast" || m.mitgliedstyp === "bewohner") && relatedMemberOf(m) && (
                        <div className="text-xs mb-1" style={{ color: INK_SOFT }}>
                          {m.mitgliedstyp === "gast" ? "Gast von" : "Bewohner von"} {relatedMemberOf(m).vorname} {relatedMemberOf(m).nachname}
                        </div>
                      )}
                      {m.isPlaceholder && <div className="text-xs mb-1" style={{ color: "#C9752F" }}>Profil noch nicht ausgefüllt</div>}

                      <div className="flex flex-col gap-1 mt-1 text-xs" style={{ color: INK_SOFT }}>
                        {m.wohneinheit && <div className="flex items-center gap-1.5"><Building2 size={12} /> WE {m.wohneinheit}</div>}
                        {formatAddress(m) && <div className="flex items-center gap-1.5"><MapPin size={12} /> {formatAddress(m)}</div>}
                        {m.email && <div className="flex items-center gap-1.5"><Mail size={12} /> {m.email}</div>}
                        {m.telefon && <div className="flex items-center gap-1.5"><Phone size={12} /> {m.telefon}</div>}
                        {m.handy && <div className="flex items-center gap-1.5"><Smartphone size={12} /> {m.handy}</div>}
                        {m.geburtstag && <div className="flex items-center gap-1.5"><Calendar size={12} /> {fmtBirthday(m.geburtstag)}</div>}
                      </div>

                      {myBereiche.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {myBereiche.map((k) => {
                            const b = bereichInfo(k);
                            if (!b) return null;
                            return <span key={k} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${b.color}1A`, color: b.color }}>{b.label}</span>;
                          })}
                        </div>
                      )}

                      {/* Mobile-only: Bearbeiten-Buttons unten rechts nach dem Aufklappen. */}
                      {(!m.isPlaceholder && (isElevatedForMitglieder || canManage) && (m.id || canManage)) && (
                        <div className="flex sm:hidden items-center justify-end gap-2 mt-3">
                          {isElevatedForMitglieder && m.id && !m.is_child && (
                            <button onClick={() => setGroupAssignFor(m)} title="Gruppen zuweisen"><Tag size={14} style={{ color: "#B8B4A2" }} /></button>
                          )}
                          {canManage && (
                            <>
                              <button onClick={() => openEditForm(m)}><Pencil size={14} style={{ color: "#B8B4A2" }} /></button>
                              <button onClick={() => handleDelete(m)}><Trash2 size={14} style={{ color: "#B8B4A2" }} /></button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {isSuperAdmin && (
              <div className="mt-4">
                <button onClick={exportAllCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                  <Download size={12} /> CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddGroup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowAddGroup(false); } }}>
          <div className="w-full max-w-sm rounded-2xl p-6 max-h-[85dvh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Gruppen</h2><button onClick={() => setShowAddGroup(false)}><X size={20} /></button></div>

            {sortedBereiche.length > 0 && (
              <div className="mb-4 flex flex-col gap-1.5">
                {sortedBereiche.map((b) => (
                  <div key={b.key} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                    {groupRenameKey === b.key ? (
                      <input
                        autoFocus
                        value={groupRenameLabel}
                        onChange={(e) => setGroupRenameLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleRenameGroup(b.key)}
                        onBlur={() => handleRenameGroup(b.key)}
                        className="flex-1 rounded-lg px-2 py-1 text-xs border"
                        style={{ borderColor: BORDER_SOFT }}
                      />
                    ) : (
                      <button type="button" onClick={() => { setGroupRenameKey(b.key); setGroupRenameLabel(b.label); }} className="flex-1 text-left text-xs font-medium">{b.label}</button>
                    )}
                    <button type="button" onClick={() => handleDeleteGroup(b.key, b.label)}><Trash2 size={13} style={{ color: "#B8B4A2" }} /></button>
                  </div>
                ))}
              </div>
            )}

            <label className="text-xs font-medium block mb-1">Neue Gruppe</label>
            <input value={newGroupLabel} onChange={(e) => setNewGroupLabel(e.target.value)} placeholder="z.B. Fahrradwerkstatt" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
            <label className="text-xs font-medium block mb-1">Kontakt-Email (optional)</label>
            <input value={newGroupEmail} onChange={(e) => setNewGroupEmail(e.target.value)} placeholder="gruppe@nawodo.de" className="w-full rounded-lg px-3 py-2.5 mb-4 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
            <button
              onClick={handleAddGroup}
              disabled={savingGroup || !newGroupLabel.trim()}
              className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: BLUE, opacity: savingGroup || !newGroupLabel.trim() ? 0.6 : 1 }}
            >
              {savingGroup && <Loader2 size={15} className="animate-spin" />} {savingGroup ? "Anlegen…" : "Gruppe anlegen"}
            </button>
          </div>
        </div>
      )}

      {groupAssignFor && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setGroupAssignFor(null); } }}>
          <div className="w-full max-w-sm rounded-2xl p-6 max-h-[85dvh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Gruppen: {groupAssignFor.vorname} {groupAssignFor.nachname}</h2>
              <button onClick={() => setGroupAssignFor(null)}><X size={20} /></button>
            </div>
            {sortedBereiche.length === 0 ? (
              <p className="text-sm" style={{ color: INK_SOFT }}>Noch keine Gruppen angelegt.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {sortedBereiche.map((b) => {
                  const active = bereicheForMember(groupAssignFor.id).includes(b.key);
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => handleToggleMemberGroup(groupAssignFor.id, b.key, !active)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: active ? b.color : "transparent", color: active ? "#fff" : INK_SOFT, border: `1.5px solid ${active ? b.color : BORDER_SOFT}` }}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {profileMember && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setProfileMember(null); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[85dvh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Profil</h2>
              <button onClick={() => setProfileMember(null)}><X size={20} /></button>
            </div>
            <div className="flex flex-col items-center text-center mb-4">
              {profileMember.foto_url ? (
                <img src={profileMember.foto_url} alt="" className="w-20 h-20 rounded-full object-cover mb-2" />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center mb-2"
                  style={{ backgroundColor: profileMember.is_child ? "#6C63A61A" : "#2E86AB1A", color: profileMember.is_child ? "#6C63A6" : BLUE }}
                >
                  {profileMember.is_child ? <Users size={28} /> : <User size={28} />}
                </div>
              )}
              <div className="font-bold text-base">{profileMember.vorname}{profileMember.spitzname ? ` „${profileMember.spitzname}“` : ""} {profileMember.nachname}</div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1" style={{ backgroundColor: `${mitgliedstypInfo(profileMember.mitgliedstyp).color}1A`, color: mitgliedstypInfo(profileMember.mitgliedstyp).color }}>
                {mitgliedstypInfo(profileMember.mitgliedstyp).label}
              </span>
              {profileMember.is_child && (
                <div className="text-xs mt-1 flex flex-wrap items-center justify-center gap-1" style={{ color: INK_SOFT }}>
                  {parentMembers(profileMember).length > 0 ? (
                    <>
                      Kind von{" "}
                      {parentMembers(profileMember).map((p, i) => (
                        <span key={p.id}>
                          <button onClick={() => setProfileMember(p)} className="font-semibold underline" style={{ color: BLUE }}>{p.vorname} {p.nachname}</button>
                          {i < parentMembers(profileMember).length - 1 ? " & " : ""}
                        </span>
                      ))}
                    </>
                  ) : "Kind"}
                </div>
              )}
              {!profileMember.is_child && (profileMember.mitgliedstyp === "gast" || profileMember.mitgliedstyp === "bewohner") && relatedMemberOf(profileMember) && (
                <div className="text-xs mt-1 flex flex-wrap items-center justify-center gap-1" style={{ color: INK_SOFT }}>
                  {profileMember.mitgliedstyp === "gast" ? "Gast von" : "Bewohner von"}{" "}
                  <button onClick={() => setProfileMember(relatedMemberOf(profileMember))} className="font-semibold underline" style={{ color: BLUE }}>
                    {relatedMemberOf(profileMember).vorname} {relatedMemberOf(profileMember).nachname}
                  </button>
                </div>
              )}
              {profileMember.isPlaceholder && <div className="text-xs mt-1" style={{ color: "#C9752F" }}>Profil noch nicht ausgefüllt</div>}
            </div>
            <div className="flex flex-col gap-2 text-sm mb-4" style={{ color: INK_SOFT }}>
              {profileMember.wohneinheit && <div className="flex items-center gap-2"><Building2 size={14} /> WE {profileMember.wohneinheit}</div>}
              {formatAddress(profileMember) && <div className="flex items-center gap-2"><MapPin size={14} /> {formatAddress(profileMember)}</div>}
              {profileMember.email && <div className="flex items-center gap-2"><Mail size={14} /> {profileMember.email}</div>}
              {profileMember.telefon && <div className="flex items-center gap-2"><Phone size={14} /> {profileMember.telefon}</div>}
              {profileMember.handy && <div className="flex items-center gap-2"><Smartphone size={14} /> {profileMember.handy}</div>}
              {profileMember.geburtstag && <div className="flex items-center gap-2"><Calendar size={14} /> {fmtBirthday(profileMember.geburtstag)}</div>}
            </div>
            {profileMember.id && bereicheForMember(profileMember.id).length > 0 && (
              <div className="flex flex-wrap gap-1 mb-4">
                {bereicheForMember(profileMember.id).map((k) => {
                  const b = bereichInfo(k);
                  if (!b) return null;
                  return <span key={k} className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${b.color}1A`, color: b.color }}>{b.label}</span>;
                })}
              </div>
            )}
            {!profileMember.is_child && childrenOf(profileMember).length > 0 && (
              <div className="mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: INK_SOFT }}>Kinder</div>
                <div className="flex flex-wrap gap-1.5">
                  {childrenOf(profileMember).map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setProfileMember(child)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
                    >
                      {child.vorname} {child.nachname}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!profileMember.isPlaceholder && (
              <button
                onClick={() => exportVCard(profileMember)}
                className="w-full rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2"
                style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
              >
                <Download size={14} /> Als vCard speichern
              </button>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)", height: "100dvh" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowForm(false); } }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[85dvh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editingMember ? "Eintrag bearbeiten" : "Eigener Eintrag"}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <label className="text-xs font-medium block mb-1">Profilbild</label>
            <div className="flex items-center gap-3 mb-3">
              {formFotoPreview ? (
                <img src={formFotoPreview} alt="" className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><ImageIcon size={20} style={{ color: INK_SOFT }} /></div>
              )}
              <label className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full cursor-pointer" style={{ border: `1.5px dashed ${BORDER_SOFT}`, color: INK_SOFT }}>
                <Camera size={13} /> Foto wählen
                <input type="file" accept="image/*" className="hidden" onChange={onFotoSelected} />
              </label>
            </div>

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Vorname *</label>
                <input value={formVorname} onChange={(e) => setFormVorname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Nachname</label>
                <input value={formNachname} onChange={(e) => setFormNachname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
            </div>

            <label className="text-xs font-medium block mb-1">Spitzname</label>
            <input value={formSpitzname} onChange={(e) => setFormSpitzname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Straße</label>
                <input value={formStrasse} onChange={(e) => setFormStrasse(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
              <div className="w-28 flex-shrink-0">
                <label className="text-xs font-medium block mb-1 whitespace-nowrap">Hausnr.</label>
                <input value={formHausnummer} onChange={(e) => setFormHausnummer(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
            </div>
            <div className="flex gap-3 mb-3">
              <div className="w-28">
                <label className="text-xs font-medium block mb-1">PLZ</label>
                <input value={formPlz} onChange={(e) => setFormPlz(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Wohnort</label>
                <input value={formWohnort} onChange={(e) => setFormWohnort(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
            </div>
            {!formStrasse && !formHausnummer && !formPlz && !formWohnort && editingMember?.anschrift && (
              <p className="text-xs mb-3" style={{ color: INK_SOFT }}>Bisherige Angabe (noch nicht ins neue Format übertragen): {editingMember.anschrift}</p>
            )}

            <label className="text-xs font-medium block mb-1">Wohneinheit (WE)</label>
            <input value={formWohneinheit} onChange={(e) => setFormWohneinheit(e.target.value)} placeholder="z.B. WE 12" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Geburtstag</label>
            <input type="date" value={formGeburtstag} onChange={(e) => setFormGeburtstag(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
            <label className="flex items-center gap-2 text-xs mb-3" style={{ color: INK_SOFT }}>
              <input type="checkbox" checked={formGeburtstagVersteckt} onChange={(e) => setFormGeburtstagVersteckt(e.target.checked)} />
              Geburtstag nicht im Geburtstage-Widget der Hauptseite anzeigen
            </label>

            {!formIsChild && (
              <>
                <label className="text-xs font-medium block mb-1">E-Mail *</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

                <label className="text-xs font-medium block mb-1">Telefon (Festnetz)</label>
                <input value={formTelefon} onChange={(e) => setFormTelefon(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

                <label className="text-xs font-medium block mb-1">Handy</label>
                <input value={formHandy} onChange={(e) => setFormHandy(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </>
            )}

            <p className="text-xs mb-2" style={{ color: INK_SOFT }}>* Pflichtfeld</p>

            {formError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}</div>}

            <button
              onClick={handleSave}
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
            <button onClick={() => { setShowAccount(false); openOwnEntry(); }} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold flex items-center justify-center gap-2" style={{ border: "1.5px solid #D8D5C7", color: INK }}>
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
    </div>
  );
}
