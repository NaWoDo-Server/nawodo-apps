import React, { useState, useEffect, useMemo } from "react";
import {
  Home, Plus, X, AlertCircle, Loader2, Search, Trash2, UserX, KeyRound,
  Check, Users,
} from "lucide-react";
import { supabase, configMissing } from "./supabaseClient";

const PAPER = "#F1F0EA";
const INK = "#2B2B26";
const INK_SOFT = "#6B6A61";
const BORDER_SOFT = "#D8D5C7";
const BLUE = "#2E86AB";

const APP_LIST = [
  { key: "sharing", label: "Sharing" },
  { key: "termine", label: "Termine" },
  { key: "fahrtenbuch", label: "Fahrtenbuch" },
  { key: "faq", label: "FAQ" },
  { key: "pinnwand", label: "Pinnwand" },
  { key: "mitglieder", label: "Mitglieder" },
  { key: "workshop", label: "Workshop" },
  { key: "bulldozer", label: "Bulldozer" },
  { key: "vorsorge", label: "Vorsorge" },
];

// Fuer die Bulk-Rechtevergabe: alle Rechte, die sich pro Kategorie auf einmal
// setzen lassen - die 8 Standard-Apps (opt-out) + die 5 Opt-in-Unterfilter.
const BULK_RIGHT_OPTIONS = [
  ...APP_LIST.map((a) => ({ key: a.key, label: `App: ${a.label}` })),
  { key: "faq_projekt", label: "FAQ: Rund um das Projekt", app: "FAQ" },
  { key: "mitglieder_genossenschaft", label: "Mitglieder-Filter: Genossenschaftsmitglieder", app: "Mitglieder" },
  { key: "mitglieder_gaeste", label: "Mitglieder-Filter: Gäste", app: "Mitglieder" },
  { key: "mitglieder_bewohner", label: "Mitglieder-Filter: Bewohner", app: "Mitglieder" },
  { key: "mitglieder_kinder", label: "Mitglieder-Filter: Kinder", app: "Mitglieder" },
];

// Fuer die Rechte-Matrix: bewusst getrennt zwischen "Apps" (ganze App an/aus pro
// Mitglied) und "Nutzung in einer App" (Unter-Rechte INNERHALB einer App, z.B.
// welche Mitglieder-Filter sichtbar sind) - das sind zwei unterschiedliche Ebenen,
// die nicht in einer Spaltenliste vermischt werden sollen.
const APP_RIGHT_OPTIONS = APP_LIST.map((a) => ({ key: a.key, label: `App: ${a.label}` }));
const USAGE_RIGHT_OPTIONS = BULK_RIGHT_OPTIONS.filter((o) => ["faq_projekt", "mitglieder_genossenschaft", "mitglieder_gaeste", "mitglieder_bewohner", "mitglieder_kinder"].includes(o.key));

const OPT_IN_KEYS = ["faq_projekt", "mitglieder_genossenschaft", "mitglieder_gaeste", "mitglieder_bewohner", "mitglieder_kinder"];

const SHORT_RIGHT_LABELS = {
  faq_projekt: "FAQ Projekt",
  mitglieder_genossenschaft: "Genossen.",
  mitglieder_gaeste: "Gäste",
  mitglieder_bewohner: "Bewohner",
  mitglieder_kinder: "Kinder",
};
function shortRightLabel(opt) {
  return SHORT_RIGHT_LABELS[opt.key] || opt.label.replace("App: ", "");
}

// Fasst aufeinanderfolgende Spalten mit gleicher App zu einer Gruppe zusammen,
// damit im "Nutzung in einer App"-Tab eine Kopfzeile zeigt, zu welcher App
// welche Spalten gehoeren - wichtig, sobald mehrere Apps eigene Unter-Rechte haben.
function groupOptionsByApp(options) {
  const groups = [];
  for (const opt of options) {
    const last = groups[groups.length - 1];
    if (last && last.app === opt.app) {
      last.count += 1;
    } else {
      groups.push({ app: opt.app || "", count: 1 });
    }
  }
  return groups;
}

const BULK_CATEGORY_OPTIONS = [
  { key: "mitglied", label: "Genossenschaftsmitglieder" },
  { key: "gast", label: "Gäste" },
  { key: "bewohner", label: "Bewohner" },
  { key: "kind", label: "Kinder" },
];

const WIDGET_LIST = [
  { key: "wetter", label: "Wetter" },
  { key: "tagebuch", label: "Tagebuch" },
  { key: "geburtstage", label: "Geburtstage" },
  { key: "kalenderansicht", label: "Kalenderansicht" },
];

const FAQ_TAB_LIST = [
  { key: "app", label: "Rund um die App" },
  { key: "projekt", label: "Rund ums Wohnprojekt" },
];

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) window.location.href = "/";
  }, [session]);

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}>
        <Loader2 className="animate-spin" size={24} style={{ color: INK_SOFT }} />
      </div>
    );
  }
  if (!session) return null;

  const isSuperAdmin = session.user.user_metadata?.is_superadmin === true;
  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: PAPER }}>
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-3" size={28} style={{ color: "#A13D3D" }} />
          <p className="font-semibold mb-1">Kein Zugriff</p>
          <p className="text-sm mb-4" style={{ color: INK_SOFT }}>Diese App ist nur für den Superadmin.</p>
          <a href="/" className="text-sm font-semibold" style={{ color: INK }}>Zurück zur Startseite</a>
        </div>
      </div>
    );
  }

  return <SettingsApp session={session} />;
}

function SettingsApp({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
  const initial = userName.charAt(0).toUpperCase();

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

  const [allUsers, setAllUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [appModerators, setAppModerators] = useState([]);
  const [memberPermissions, setMemberPermissions] = useState([]);
  const [bereiche, setBereiche] = useState([]);
  const [memberBereiche, setMemberBereiche] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState("");
  const [savingAction, setSavingAction] = useState(false);
  const [togglingCell, setTogglingCell] = useState(null); // `${userId}:${appKey}` waehrend des Speicherns

  const [selectedRowKey, setSelectedRowKey] = useState(null);
  const [pendingIsAdmin, setPendingIsAdmin] = useState(false);
  const [pendingMods, setPendingMods] = useState([]);
  const [newPassword, setNewPassword] = useState("");

  const [activeTab, setActiveTab] = useState("benutzer"); // "benutzer" | "apps"
  const [rightsView, setRightsView] = useState("apps"); // "apps" | "nutzung"

  // Apps-Tab: globale Ein/Aus-Schalter pro App (app_settings.app_enabled_<key>)
  const [appEnabledMap, setAppEnabledMap] = useState({});
  const [savingAppToggle, setSavingAppToggle] = useState(null);
  const [widgetEnabledMap, setWidgetEnabledMap] = useState({});
  const [savingWidgetToggle, setSavingWidgetToggle] = useState(null);
  const [faqTabEnabledMap, setFaqTabEnabledMap] = useState({});
  const [savingFaqTabToggle, setSavingFaqTabToggle] = useState(null);

  // Benutzer-Tab: Bulk-Rechtevergabe nach Kategorie
  const [bulkCategories, setBulkCategories] = useState([]);
  const [bulkRightKey, setBulkRightKey] = useState("");
  const [bulkAllowed, setBulkAllowed] = useState(true);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkResult, setBulkResult] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState("account"); // "account" | "child"
  const [newVorname, setNewVorname] = useState("");
  const [newNachname, setNewNachname] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPasswordCreate, setNewPasswordCreate] = useState("");
  const [newParentUserId, setNewParentUserId] = useState("");
  const [newParent2UserId, setNewParent2UserId] = useState("");
  const [newChildLogin, setNewChildLogin] = useState(false);
  const [newMitgliedstyp, setNewMitgliedstyp] = useState("mitglied");
  const [newRelatedUserId, setNewRelatedUserId] = useState("");
  const [newPerms, setNewPerms] = useState(() => Object.fromEntries(APP_LIST.map((a) => [a.key, true])));
  const [savingCreate, setSavingCreate] = useState(false);
  const [createError, setCreateError] = useState("");

  const [showAccount, setShowAccount] = useState(false);
  const [selfNewPassword, setSelfNewPassword] = useState("");
  const [selfNewPasswordConfirm, setSelfNewPasswordConfirm] = useState("");
  const [selfPasswordError, setSelfPasswordError] = useState("");
  const [selfPasswordSuccess, setSelfPasswordSuccess] = useState(false);
  const [savingSelfPassword, setSavingSelfPassword] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [u, m, mods, perms, gr, mb, appSet] = await Promise.all([
      supabase.rpc("list_all_users"),
      supabase.from("members").select("*"),
      supabase.from("app_moderators").select("*"),
      supabase.from("member_permissions").select("*"),
      supabase.from("bereiche").select("*"),
      supabase.from("member_bereiche").select("*"),
      supabase.from("app_settings").select("key,value").in("key", [
        ...APP_LIST.map((a) => `app_enabled_${a.key}`),
        ...WIDGET_LIST.map((w) => `widget_enabled_${w.key}`),
        ...FAQ_TAB_LIST.map((t) => `faq_tab_enabled_${t.key}`),
      ]),
    ]);
    setAllUsers(u.data || []);
    setMembers(m.data || []);
    setAppModerators(mods.data || []);
    setMemberPermissions(perms.data || []);
    setBereiche(gr.data || []);
    setMemberBereiche(mb.data || []);
    const enabledMap = {};
    APP_LIST.forEach((a) => { enabledMap[a.key] = true; });
    const widgetMap = {};
    WIDGET_LIST.forEach((w) => { widgetMap[w.key] = true; });
    const faqTabMap = {};
    FAQ_TAB_LIST.forEach((t) => { faqTabMap[t.key] = true; });
    (appSet.data || []).forEach((row) => {
      if (row.key.startsWith("app_enabled_")) {
        enabledMap[row.key.replace("app_enabled_", "")] = row.value !== false;
      } else if (row.key.startsWith("widget_enabled_")) {
        widgetMap[row.key.replace("widget_enabled_", "")] = row.value !== false;
      } else if (row.key.startsWith("faq_tab_enabled_")) {
        faqTabMap[row.key.replace("faq_tab_enabled_", "")] = row.value !== false;
      }
    });
    setAppEnabledMap(enabledMap);
    setWidgetEnabledMap(widgetMap);
    setFaqTabEnabledMap(faqTabMap);
    setLoading(false);
  }

  async function handleToggleAppEnabled(appKey, nextEnabled) {
    setSavingAppToggle(appKey);
    setActionError("");
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: `app_enabled_${appKey}`, value: nextEnabled, updated_at: new Date().toISOString() });
      if (error) throw error;
      setAppEnabledMap((prev) => ({ ...prev, [appKey]: nextEnabled }));
    } catch (e) {
      setActionError(e.message || "Konnte nicht gespeichert werden.");
    } finally {
      setSavingAppToggle(null);
    }
  }

  async function handleToggleWidgetEnabled(widgetKey, nextEnabled) {
    setSavingWidgetToggle(widgetKey);
    setActionError("");
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: `widget_enabled_${widgetKey}`, value: nextEnabled, updated_at: new Date().toISOString() });
      if (error) throw error;
      setWidgetEnabledMap((prev) => ({ ...prev, [widgetKey]: nextEnabled }));
    } catch (e) {
      setActionError(e.message || "Konnte nicht gespeichert werden.");
    } finally {
      setSavingWidgetToggle(null);
    }
  }

  async function handleToggleFaqTab(tabKey, nextEnabled) {
    setSavingFaqTabToggle(tabKey);
    setActionError("");
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: `faq_tab_enabled_${tabKey}`, value: nextEnabled, updated_at: new Date().toISOString() });
      if (error) throw error;
      setFaqTabEnabledMap((prev) => ({ ...prev, [tabKey]: nextEnabled }));
    } catch (e) {
      setActionError(e.message || "Konnte nicht gespeichert werden.");
    } finally {
      setSavingFaqTabToggle(null);
    }
  }

  // Ermittelt alle Login-Accounts (user_id), deren Mitgliedsprofil zu mindestens
  // einer der ausgewaehlten Kategorien passt.
  function memberIdsForCategories(categories) {
    return members
      .filter((m) => {
        if (!m.user_id) return false;
        if (m.is_child) return categories.includes("kind");
        const typ = m.mitgliedstyp || "mitglied";
        return categories.includes(typ);
      })
      .map((m) => m.user_id);
  }

  async function handleBulkApply() {
    if (bulkCategories.length === 0 || !bulkRightKey) return;
    setBulkApplying(true);
    setBulkResult("");
    try {
      const targetIds = [...new Set(memberIdsForCategories(bulkCategories))];
      for (const uid of targetIds) {
        await callAdminFn({ type: "set_permission", target_user_id: uid, app_key: bulkRightKey, allowed: bulkAllowed });
      }
      setBulkResult(targetIds.length === 0 ? "Keine passenden Mitglieder mit Login gefunden." : `Erledigt für ${targetIds.length} Mitglieder.`);
      await loadAll();
    } catch (e) {
      setBulkResult(e.message || "Fehler beim Anwenden.");
    } finally {
      setBulkApplying(false);
    }
  }

  function modAppsFor(userId) {
    return appModerators.filter((r) => r.user_id === userId).map((r) => r.app_key);
  }
  function deniedAppsFor(userId) {
    return memberPermissions.filter((r) => r.user_id === userId && r.allowed === false).map((r) => r.app_key);
  }
  // Opt-in-Rechte (anders als die App-Keys oben): fehlende Zeile = NICHT erlaubt.
  function faqProjektAllowedFor(userId) {
    return memberPermissions.some((r) => r.user_id === userId && r.app_key === "faq_projekt" && r.allowed === true);
  }
  function mitgliederGenossenschaftAllowedFor(userId) {
    return memberPermissions.some((r) => r.user_id === userId && r.app_key === "mitglieder_genossenschaft" && r.allowed === true);
  }
  function mitgliederGaesteAllowedFor(userId) {
    return memberPermissions.some((r) => r.user_id === userId && r.app_key === "mitglieder_gaeste" && r.allowed === true);
  }
  function mitgliederBewohnerAllowedFor(userId) {
    return memberPermissions.some((r) => r.user_id === userId && r.app_key === "mitglieder_bewohner" && r.allowed === true);
  }
  function mitgliederKinderAllowedFor(userId) {
    return memberPermissions.some((r) => r.user_id === userId && r.app_key === "mitglieder_kinder" && r.allowed === true);
  }

  // Fuer die Rechte-Matrix in der Benutzerliste: einheitliche Pruefung ueber alle
  // Rechte (Standard-Apps UND Opt-in-Unterfilter) in einer Funktion.
  function isRightAllowed(userId, appKey) {
    const row = memberPermissions.find((r) => r.user_id === userId && r.app_key === appKey);
    if (OPT_IN_KEYS.includes(appKey)) return row?.allowed === true;
    return !(row && row.allowed === false);
  }

  async function handleToggleMatrixCell(userId, appKey) {
    const cellKey = `${userId}:${appKey}`;
    setTogglingCell(cellKey);
    setActionError("");
    try {
      await callAdminFn({ type: "set_permission", target_user_id: userId, app_key: appKey, allowed: !isRightAllowed(userId, appKey) });
      await loadAll();
    } catch (e) {
      setActionError(e.message || "Konnte nicht geändert werden.");
    } finally {
      setTogglingCell(null);
    }
  }
  function groupsForMember(memberId) {
    return memberBereiche.filter((r) => r.member_id === memberId).map((r) => r.bereich_key);
  }

  // rowKey identifiziert eine Zeile eindeutig - entweder ueber die Auth-User-ID
  // (Account mit Login) oder, falls keiner existiert (z.B. Kinder ohne eigenen
  // Login), ueber die Mitglieder-ID.
  function rowKey(r) {
    return r.authUser ? `u:${r.authUser.id}` : `m:${r.member.id}`;
  }

  // Jede Zeile in der Liste ist entweder: ein Mitglieder-Profil (inkl. Kinder ohne
  // Login) mit optional verknuepftem Login, oder ein Login-Account, der noch kein
  // Mitglieder-Profil angelegt hat.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const seenUserIds = new Set();
    const combined = members.map((m) => {
      const authUser = m.user_id ? allUsers.find((u) => u.id === m.user_id) || null : null;
      if (authUser) seenUserIds.add(authUser.id);
      return { member: m, authUser };
    });
    allUsers.forEach((u) => {
      if (!seenUserIds.has(u.id)) combined.push({ member: null, authUser: u });
    });
    return combined
      .map((r) => ({
        ...r,
        displayName: (r.member && [r.member.vorname, r.member.nachname].filter(Boolean).join(" ").trim()) || r.authUser?.name || r.authUser?.email || "Unbenannt",
      }))
      .filter((r) => !q || `${r.displayName} ${r.authUser?.email || ""}`.toLowerCase().includes(q))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "de"));
  }, [members, allUsers, search]);

  const selectedRow = selectedRowKey ? rows.find((r) => rowKey(r) === selectedRowKey) || null : null;
  const selectedAuthUser = selectedRow?.authUser || null;
  const selectedMember = selectedRow?.member || null;

  useEffect(() => {
    if (selectedRowKey) {
      const r = rows.find((x) => rowKey(x) === selectedRowKey);
      if (r?.authUser) loadPendingFor(r.authUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRowKey]);

  async function callAdminFn(body, method = "POST") {
    const resp = await fetch(`${window.__SUPABASE_URL__}/functions/v1/admin-create-account`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: window.__SUPABASE_ANON_KEY__,
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || "Aktion fehlgeschlagen.");
    return data;
  }

  function loadPendingFor(u) {
    if (!u) return;
    setPendingIsAdmin(u.is_admin === true);
    setPendingMods(modAppsFor(u.id));
  }

  async function handleApplyRoles() {
    if (!selectedAuthUser) return;
    setActionError("");
    setSavingAction(true);
    try {
      const currentIsAdmin = selectedAuthUser.is_admin === true;
      if (pendingIsAdmin !== currentIsAdmin) {
        await callAdminFn({ type: "toggle_admin", target_user_id: selectedAuthUser.id, is_admin: pendingIsAdmin });
      }
      const currentMods = modAppsFor(selectedAuthUser.id);
      const toAdd = pendingMods.filter((k) => !currentMods.includes(k));
      const toRemove = currentMods.filter((k) => !pendingMods.includes(k));
      for (const k of toAdd) {
        const { error } = await supabase.from("app_moderators").insert({ user_id: selectedAuthUser.id, app_key: k });
        if (error) throw error;
      }
      for (const k of toRemove) {
        const { error } = await supabase.from("app_moderators").delete().eq("user_id", selectedAuthUser.id).eq("app_key", k);
        if (error) throw error;
      }
      await loadAll();
    } catch (e) {
      setActionError(e.message || "Rollen konnten nicht gespeichert werden.");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleToggleGroup(memberId, bereichKey, nextValue) {
    setActionError("");
    setSavingAction(true);
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
      setActionError(e.message || "Gruppe konnte nicht geändert werden.");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleSetMitgliedstyp(memberId, typ) {
    setActionError("");
    setSavingAction(true);
    try {
      const { error } = await supabase.from("members").update({ mitgliedstyp: typ }).eq("id", memberId);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      setActionError(e.message || "Typ konnte nicht geändert werden.");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleSetPassword(targetUserId) {
    setActionError("");
    if (!newPassword || newPassword.length < 6) {
      setActionError("Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    setSavingAction(true);
    try {
      await callAdminFn({ type: "set_password", target_user_id: targetUserId, password: newPassword });
      setNewPassword("");
      alert("Neues Passwort gesetzt. Bitte der Person mitteilen.");
    } catch (e) {
      setActionError(e.message || "Passwort konnte nicht gesetzt werden.");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleDeleteAccount(targetUser) {
    const displayName = targetUser.name || targetUser.email;
    if (!window.confirm(`Account von ${displayName} wirklich vollständig löschen? Die Person kann sich danach nicht mehr einloggen. Das kann nicht rückgängig gemacht werden.`)) return;
    setActionError("");
    setSavingAction(true);
    try {
      await callAdminFn({ user_id: targetUser.id }, "DELETE");
      setSelectedRowKey(null);
      await loadAll();
    } catch (e) {
      setActionError(e.message || "Account konnte nicht gelöscht werden.");
    } finally {
      setSavingAction(false);
    }
  }

  // Fuer Eintraege ohne eigenen Login (z.B. Kinder) - hier gibt es keinen
  // Auth-Account zum Loeschen, nur die Zeile in der members-Tabelle.
  async function handleDeleteMemberOnly(targetMember) {
    const displayName = [targetMember.vorname, targetMember.nachname].filter(Boolean).join(" ").trim() || "diesen Eintrag";
    if (!window.confirm(`${displayName} wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    setActionError("");
    setSavingAction(true);
    try {
      const { error } = await supabase.from("members").delete().eq("id", targetMember.id);
      if (error) throw error;
      setSelectedRowKey(null);
      await loadAll();
    } catch (e) {
      setActionError(e.message || "Eintrag konnte nicht gelöscht werden.");
    } finally {
      setSavingAction(false);
    }
  }

  function resetCreateForm() {
    setNewType("account");
    setNewVorname("");
    setNewNachname("");
    setNewEmail("");
    setNewPasswordCreate("");
    setNewParentUserId("");
    setNewParent2UserId("");
    setNewChildLogin(false);
    setNewMitgliedstyp("mitglied");
    setNewRelatedUserId("");
    setNewPerms(Object.fromEntries(APP_LIST.map((a) => [a.key, true])));
    setCreateError("");
  }

  async function handleCreate() {
    setCreateError("");
    if (!newVorname.trim()) return setCreateError("Bitte einen Vornamen angeben.");
    const body = {
      type: newType,
      vorname: newVorname.trim(),
      nachname: newNachname.trim(),
      mitgliedstyp: newMitgliedstyp,
    };
    if (newType === "child") {
      if (!newParentUserId && !newParent2UserId) return setCreateError("Bitte mindestens einen Elternteil (Vater oder Mutter) auswählen.");
      body.parent1_user_id = newParentUserId || null;
      body.parent2_user_id = newParent2UserId || null;
      if (newChildLogin) {
        const email = newEmail.trim().toLowerCase();
        if (!email || !email.includes("@")) return setCreateError("Bitte eine gültige Email-Adresse angeben.");
        if (!newPasswordCreate || newPasswordCreate.length < 6) return setCreateError("Passwort muss mindestens 6 Zeichen haben.");
        body.email = email;
        body.password = newPasswordCreate;
        body.app_permissions = newPerms;
      }
    } else {
      const email = newEmail.trim().toLowerCase();
      if (!email || !email.includes("@")) return setCreateError("Bitte eine gültige Email-Adresse angeben.");
      if (!newPasswordCreate || newPasswordCreate.length < 6) return setCreateError("Passwort muss mindestens 6 Zeichen haben.");
      if ((newMitgliedstyp === "gast" || newMitgliedstyp === "bewohner") && !newRelatedUserId) {
        return setCreateError("Bitte angeben, zu welchem Mitglied diese Person gehört.");
      }
      body.email = email;
      body.password = newPasswordCreate;
      body.app_permissions = newPerms;
      body.related_user_id = newRelatedUserId || null;
    }
    setSavingCreate(true);
    try {
      await callAdminFn(body);
      resetCreateForm();
      setShowCreate(false);
      await loadAll();
    } catch (e) {
      setCreateError(e.message || "Konnte nicht angelegt werden.");
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleSelfChangePassword() {
    setSelfPasswordError("");
    setSelfPasswordSuccess(false);
    if (selfNewPassword.length < 6) return setSelfPasswordError("Mindestens 6 Zeichen.");
    if (selfNewPassword !== selfNewPasswordConfirm) return setSelfPasswordError("Passwörter stimmen nicht überein.");
    setSavingSelfPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: selfNewPassword });
      if (error) throw error;
      setSelfPasswordSuccess(true);
      setSelfNewPassword("");
      setSelfNewPasswordConfirm("");
    } catch (e) {
      setSelfPasswordError(e.message || "Hat nicht geklappt.");
    } finally {
      setSavingSelfPassword(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const adultsForParent = useMemo(
    () => members.filter((m) => !m.is_child && m.user_id),
    [members]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}>
        <Loader2 className="animate-spin" size={24} style={{ color: INK_SOFT }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAPER, color: INK }}>
      <div className="max-w-3xl mx-auto lg:max-w-none lg:w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <img src="/settings/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
            <h1 className="font-bold text-lg lg:text-2xl">Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
            <span className="text-xs lg:text-sm font-semibold truncate max-w-[90px] lg:max-w-[160px]" style={{ color: INK_SOFT }}>{userName}</span>
            <button onClick={() => { setShowAccount(true); setSelfPasswordError(""); setSelfPasswordSuccess(false); }} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>
              {ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mb-5 p-1 rounded-full w-fit" style={{ backgroundColor: "#E4E1D3" }}>
          <button
            onClick={() => setActiveTab("benutzer")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
            style={activeTab === "benutzer" ? { backgroundColor: "#fff", color: INK, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } : { color: INK_SOFT }}
          >
            <Users size={14} /> Benutzer
          </button>
          <button
            onClick={() => setActiveTab("apps")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
            style={activeTab === "apps" ? { backgroundColor: "#fff", color: INK, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } : { color: INK_SOFT }}
          >
            Apps
          </button>
        </div>

        {activeTab === "benutzer" && (
        <>
        <div className="mb-4 p-4 rounded-xl" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div className="text-sm font-semibold mb-3">Recht für mehrere Mitglieder auf einmal setzen</div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: INK_SOFT }}>Für welche Kategorien?</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {BULK_CATEGORY_OPTIONS.map((c) => {
              const active = bulkCategories.includes(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => setBulkCategories((list) => (active ? list.filter((k) => k !== c.key) : [...list, c.key]))}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: active ? BLUE : "transparent", color: active ? "#fff" : INK_SOFT, border: `1.5px solid ${active ? BLUE : BORDER_SOFT}` }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <div className="text-xs font-semibold mb-1.5" style={{ color: INK_SOFT }}>Welches Recht?</div>
          <select
            value={bulkRightKey}
            onChange={(e) => setBulkRightKey(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border"
            style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
          >
            <option value="">Bitte wählen…</option>
            {BULK_RIGHT_OPTIONS.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
          <div className="flex items-center gap-4 mb-3">
            <label className="flex items-center gap-1.5 text-xs font-semibold">
              <input type="radio" checked={bulkAllowed === true} onChange={() => setBulkAllowed(true)} /> Erlauben
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold">
              <input type="radio" checked={bulkAllowed === false} onChange={() => setBulkAllowed(false)} /> Sperren
            </label>
          </div>
          <button
            onClick={handleBulkApply}
            disabled={bulkApplying || bulkCategories.length === 0 || !bulkRightKey}
            className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
            style={{ backgroundColor: BLUE, opacity: bulkApplying || bulkCategories.length === 0 || !bulkRightKey ? 0.6 : 1 }}
          >
            {bulkApplying && <Loader2 size={14} className="animate-spin" />} {bulkApplying ? "Wird angewendet…" : "Anwenden"}
          </button>
          {bulkResult && <p className="text-xs mt-2" style={{ color: INK_SOFT }}>{bulkResult}</p>}
        </div>

        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: INK_SOFT }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Benutzer durchsuchen…"
              className="w-full rounded-full pl-9 pr-3 py-2.5 text-sm border"
              style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}
            />
          </div>
          <button
            onClick={() => { resetCreateForm(); setShowCreate(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold"
            style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
          >
            <Plus size={14} /> Neuer Benutzer
          </button>
        </div>

        <div className="flex items-center gap-1.5 mb-3 p-1 rounded-full w-fit" style={{ backgroundColor: "#E4E1D3" }}>
          <button
            onClick={() => setRightsView("apps")}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={rightsView === "apps" ? { backgroundColor: "#fff", color: INK, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } : { color: INK_SOFT }}
          >
            Apps
          </button>
          <button
            onClick={() => setRightsView("nutzung")}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={rightsView === "nutzung" ? { backgroundColor: "#fff", color: INK, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" } : { color: INK_SOFT }}
          >
            Nutzung in einer App
          </button>
        </div>
        <p className="text-xs mb-2" style={{ color: INK_SOFT }}>Name antippen öffnet das Profil (Adresse, Rolle, Passwort). Häkchen wirken sofort.</p>
        <div className="overflow-x-auto rounded-xl" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <table className="text-xs border-collapse" style={{ minWidth: 760 }}>
            <thead>
              {rightsView === "nutzung" && (
                <tr>
                  <th className="sticky left-0" style={{ backgroundColor: "#fff" }}></th>
                  {groupOptionsByApp(USAGE_RIGHT_OPTIONS).map((g, i) => (
                    <th
                      key={`${g.app}-${i}`}
                      colSpan={g.count}
                      className="px-1.5 pt-2 pb-1 text-center text-[10px] font-bold uppercase tracking-wide"
                      style={{ color: BLUE }}
                    >
                      {g.app}
                    </th>
                  ))}
                </tr>
              )}
              <tr>
                <th className="text-left px-3 py-2.5 sticky left-0" style={{ backgroundColor: "#fff", borderBottom: `1.5px solid ${BORDER_SOFT}` }}>Mitglied</th>
                {(rightsView === "apps" ? APP_RIGHT_OPTIONS : USAGE_RIGHT_OPTIONS).map((opt) => (
                  <th key={opt.key} title={opt.label} className="px-1.5 py-2.5 text-center font-semibold whitespace-nowrap" style={{ color: INK_SOFT, borderBottom: `1.5px solid ${BORDER_SOFT}` }}>
                    {shortRightLabel(opt)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const m = r.member;
                const u = r.authUser;
                const mods = u ? modAppsFor(u.id) : [];
                return (
                  <tr key={rowKey(r)} style={{ borderBottom: `1px solid ${BORDER_SOFT}` }}>
                    <td className="px-3 py-2 sticky left-0" style={{ backgroundColor: "#fff" }}>
                      <button onClick={() => setSelectedRowKey(rowKey(r))} className="text-left">
                        <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                          {r.displayName}
                          {u?.is_admin && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#B54A451A", color: "#B54A45" }}>Admin</span>}
                          {mods.length > 0 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#C9A2271A", color: "#C9A227" }}>Mod · {mods.length}</span>}
                          {m?.is_child && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#3E8E7E1A", color: "#3E8E7E" }}>Kind</span>}
                        </div>
                        <div className="text-xs truncate" style={{ color: INK_SOFT }}>
                          {u?.email || "Kein eigener Login"}
                          {m?.mitgliedstyp === "gast" ? " · Gast" : m?.mitgliedstyp === "bewohner" ? " · Bewohner" : ""}
                        </div>
                      </button>
                    </td>
                    {(rightsView === "apps" ? APP_RIGHT_OPTIONS : USAGE_RIGHT_OPTIONS).map((opt) => (
                      <td key={opt.key} className="text-center px-1.5 py-2">
                        {u ? (
                          <input
                            type="checkbox"
                            checked={isRightAllowed(u.id, opt.key)}
                            disabled={togglingCell === `${u.id}:${opt.key}`}
                            onChange={() => handleToggleMatrixCell(u.id, opt.key)}
                          />
                        ) : (
                          <span style={{ color: BORDER_SOFT }}>–</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
        )}

        {activeTab === "apps" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs mb-1" style={{ color: INK_SOFT }}>
            Hier kannst du einzelne Apps für die ganze Genossenschaft aus- und wieder einschalten. Ausgeschaltete Apps sind für alle (außer dir als Superadmin) gesperrt.
          </p>
          {APP_LIST.map((a) => {
            const enabled = appEnabledMap[a.key] !== false;
            const saving = savingAppToggle === a.key;
            return (
              <div key={a.key} className="flex items-center justify-between p-3.5 rounded-xl" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div className="text-sm font-semibold">{a.label}</div>
                <button
                  onClick={() => handleToggleAppEnabled(a.key, !enabled)}
                  disabled={saving}
                  className="w-12 h-7 rounded-full relative flex-shrink-0"
                  style={{ backgroundColor: enabled ? BLUE : "#D8D5C7", opacity: saving ? 0.6 : 1, transition: "background-color 0.15s" }}
                >
                  <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white" style={{ left: enabled ? "22px" : "2px", transition: "left 0.15s" }} />
                </button>
              </div>
            );
          })}

          <div className="text-xs font-bold uppercase tracking-wide mt-3 mb-1" style={{ color: INK_SOFT }}>FAQ-Bereiche</div>
          {FAQ_TAB_LIST.map((t) => {
            const enabled = faqTabEnabledMap[t.key] !== false;
            const saving = savingFaqTabToggle === t.key;
            return (
              <div key={t.key} className="flex items-center justify-between p-3.5 rounded-xl" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div className="text-sm font-semibold">{t.label}</div>
                <button
                  onClick={() => handleToggleFaqTab(t.key, !enabled)}
                  disabled={saving}
                  className="w-12 h-7 rounded-full relative flex-shrink-0"
                  style={{ backgroundColor: enabled ? BLUE : "#D8D5C7", opacity: saving ? 0.6 : 1, transition: "background-color 0.15s" }}
                >
                  <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white" style={{ left: enabled ? "22px" : "2px", transition: "left 0.15s" }} />
                </button>
              </div>
            );
          })}

          <div className="text-xs font-bold uppercase tracking-wide mt-3 mb-1" style={{ color: INK_SOFT }}>Startseite-Widgets</div>
          {WIDGET_LIST.map((w) => {
            const enabled = widgetEnabledMap[w.key] !== false;
            const saving = savingWidgetToggle === w.key;
            return (
              <div key={w.key} className="flex items-center justify-between p-3.5 rounded-xl" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div className="text-sm font-semibold">{w.label}</div>
                <button
                  onClick={() => handleToggleWidgetEnabled(w.key, !enabled)}
                  disabled={saving}
                  className="w-12 h-7 rounded-full relative flex-shrink-0"
                  style={{ backgroundColor: enabled ? BLUE : "#D8D5C7", opacity: saving ? 0.6 : 1, transition: "background-color 0.15s" }}
                >
                  <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white" style={{ left: enabled ? "22px" : "2px", transition: "left 0.15s" }} />
                </button>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {selectedRow && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setSelectedRowKey(null); } }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{selectedRow.displayName}</h2>
              <button onClick={() => setSelectedRowKey(null)}><X size={20} /></button>
            </div>
            <div className="mb-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
              <div className="text-xs" style={{ color: INK_SOFT }}>{selectedAuthUser?.email || "Kein eigener Login"}</div>
            </div>

            {selectedMember ? (
              <>
                <div className="mb-4">
                  <label className="text-xs font-medium block mb-1">Mitgliedstyp</label>
                  <select
                    value={selectedMember.mitgliedstyp || "mitglied"}
                    onChange={(e) => handleSetMitgliedstyp(selectedMember.id, e.target.value)}
                    disabled={savingAction}
                    className="w-full rounded-lg px-3 py-2.5 text-sm border"
                    style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
                  >
                    <option value="mitglied">Genossenschaftsmitglied</option>
                    <option value="bewohner">Bewohner</option>
                    <option value="gast">Gast</option>
                  </select>
                </div>

                {bereiche.length > 0 && (
                  <div className="mb-4">
                    <label className="text-xs font-medium block mb-1.5">Gruppen</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[...bereiche].sort((a, b) => a.label.localeCompare(b.label, "de")).map((b) => {
                        const active = groupsForMember(selectedMember.id).includes(b.key);
                        return (
                          <button
                            key={b.key}
                            type="button"
                            disabled={savingAction}
                            onClick={() => handleToggleGroup(selectedMember.id, b.key, !active)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: active ? b.color : "transparent", color: active ? "#fff" : INK_SOFT, border: `1.5px solid ${active ? b.color : BORDER_SOFT}` }}
                          >
                            {b.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs mb-4" style={{ color: INK_SOFT }}>Kein Mitglieder-Profil vorhanden (Mitgliedstyp/Gruppen erst verfügbar, sobald eins angelegt ist).</p>
            )}

            {selectedAuthUser ? (
            <>
            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "#E9E6D9" }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: INK_SOFT }}>Rollen</div>
              <label className="flex items-center gap-2 text-sm mb-2">
                <input
                  type="checkbox"
                  disabled={savingAction}
                  checked={pendingIsAdmin}
                  onChange={(e) => setPendingIsAdmin(e.target.checked)}
                />
                Admin (global, in jeder App)
              </label>
              <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Moderator für einzelne Apps:</div>
              <div className="flex flex-col gap-1.5 mb-3">
                {APP_LIST.map((a) => {
                  const isMod = pendingMods.includes(a.key);
                  return (
                    <label key={a.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={savingAction}
                        checked={isMod}
                        onChange={(e) => setPendingMods((list) => (e.target.checked ? [...list, a.key] : list.filter((k) => k !== a.key)))}
                      />
                      {a.label}
                    </label>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleApplyRoles}
                  disabled={savingAction}
                  className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5"
                  style={{ backgroundColor: BLUE, opacity: savingAction ? 0.7 : 1 }}
                >
                  <Check size={14} /> Setzen
                </button>
              </div>
            </div>


            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "#E9E6D9" }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: INK_SOFT }}>Neues Passwort setzen</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="mind. 6 Zeichen"
                  className="flex-1 rounded-lg px-3 py-2 text-sm border"
                  style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
                />
                <button
                  onClick={() => handleSetPassword(selectedAuthUser.id)}
                  disabled={savingAction}
                  className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5"
                  style={{ backgroundColor: BLUE, opacity: savingAction ? 0.7 : 1 }}
                >
                  <KeyRound size={14} /> Setzen
                </button>
              </div>
              <p className="text-xs mt-1.5" style={{ color: INK_SOFT }}>Bitte der Person das neue Passwort mitteilen.</p>
            </div>
            </>
            ) : (
              <p className="text-xs mb-4" style={{ color: INK_SOFT }}>Kein eigener Login vorhanden – Rollen, App-Zugriff und Passwort gelten nur für Accounts mit Login.</p>
            )}

            {actionError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {actionError}</div>}

            {selectedAuthUser ? (
              <button
                onClick={() => handleDeleteAccount(selectedAuthUser)}
                disabled={savingAction}
                className="w-full rounded-lg py-2.5 text-sm border flex items-center justify-center gap-2"
                style={{ borderColor: "#E0B8B8", color: "#A13D3D" }}
              >
                <UserX size={14} /> Account vollständig löschen
              </button>
            ) : selectedMember ? (
              <button
                onClick={() => handleDeleteMemberOnly(selectedMember)}
                disabled={savingAction}
                className="w-full rounded-lg py-2.5 text-sm border flex items-center justify-center gap-2"
                style={{ borderColor: "#E0B8B8", color: "#A13D3D" }}
              >
                <UserX size={14} /> Eintrag löschen
              </button>
            ) : null}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowCreate(false); } }}>
          <div className="w-full max-w-sm rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Neuer Benutzer</h2><button onClick={() => setShowCreate(false)}><X size={20} /></button></div>

            <div className="flex items-center gap-1 p-1 rounded-full w-fit mb-4" style={{ backgroundColor: "#E4E1D3" }}>
              {[["account", "Login-Account"], ["child", "Kind"]].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setNewType(key)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: newType === key ? "#fff" : "transparent", color: newType === key ? INK : INK_SOFT }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Vorname</label>
                <input value={newVorname} onChange={(e) => setNewVorname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Nachname</label>
                <input value={newNachname} onChange={(e) => setNewNachname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
            </div>

            <label className="text-xs font-medium block mb-1">Typ</label>
            <select value={newMitgliedstyp} onChange={(e) => setNewMitgliedstyp(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
              <option value="mitglied">Genossenschaftsmitglied</option>
              <option value="bewohner">Bewohner</option>
              <option value="gast">Gast</option>
            </select>

            {newType === "child" ? (
              <>
                <label className="text-xs font-medium block mb-1">Vater</label>
                <select value={newParentUserId} onChange={(e) => setNewParentUserId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
                  <option value="">Keine Angabe</option>
                  {adultsForParent.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.vorname} {m.nachname}</option>
                  ))}
                </select>

                <label className="text-xs font-medium block mb-1">Mutter</label>
                <select value={newParent2UserId} onChange={(e) => setNewParent2UserId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-1 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
                  <option value="">Keine Angabe</option>
                  {adultsForParent.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.vorname} {m.nachname}</option>
                  ))}
                </select>
                <p className="text-xs mb-3" style={{ color: INK_SOFT }}>* Mindestens Vater oder Mutter muss ausgewählt sein.</p>

                <label className="flex items-center gap-2 text-sm mb-3">
                  <input type="checkbox" checked={newChildLogin} onChange={(e) => setNewChildLogin(e.target.checked)} />
                  Braucht einen eigenen Login
                </label>

                {newChildLogin && (
                  <>
                    <label className="text-xs font-medium block mb-1">Email</label>
                    <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
                    <label className="text-xs font-medium block mb-1">Startpasswort</label>
                    <input type="text" value={newPasswordCreate} onChange={(e) => setNewPasswordCreate(e.target.value)} placeholder="mind. 6 Zeichen" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

                    <label className="text-xs font-medium block mb-1.5">App-Zugriff</label>
                    <div className="flex flex-col gap-1.5 mb-3">
                      {APP_LIST.map((a) => (
                        <label key={a.key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={newPerms[a.key] !== false}
                            onChange={(e) => setNewPerms((prev) => ({ ...prev, [a.key]: e.target.checked }))}
                          />
                          {a.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {(newMitgliedstyp === "gast" || newMitgliedstyp === "bewohner") && (
                  <>
                    <label className="text-xs font-medium block mb-1">Zugehöriges Mitglied</label>
                    <select value={newRelatedUserId} onChange={(e) => setNewRelatedUserId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-1 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
                      <option value="">Bitte auswählen</option>
                      {adultsForParent.map((m) => (
                        <option key={m.user_id} value={m.user_id}>{m.vorname} {m.nachname}</option>
                      ))}
                    </select>
                    <p className="text-xs mb-3" style={{ color: INK_SOFT }}>* Zu welchem Mitglied gehört {newMitgliedstyp === "gast" ? "der Gast" : "der/die Bewohner:in"}?</p>
                  </>
                )}
                <label className="text-xs font-medium block mb-1">Email</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
                <label className="text-xs font-medium block mb-1">Startpasswort</label>
                <input type="text" value={newPasswordCreate} onChange={(e) => setNewPasswordCreate(e.target.value)} placeholder="mind. 6 Zeichen" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

                <label className="text-xs font-medium block mb-1.5">App-Zugriff</label>
                <div className="flex flex-col gap-1.5 mb-3">
                  {APP_LIST.map((a) => (
                    <label key={a.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newPerms[a.key] !== false}
                        onChange={(e) => setNewPerms((prev) => ({ ...prev, [a.key]: e.target.checked }))}
                      />
                      {a.label}
                    </label>
                  ))}
                </div>
              </>
            )}

            {createError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {createError}</div>}
            <button
              onClick={handleCreate}
              disabled={savingCreate}
              className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: BLUE, opacity: savingCreate ? 0.7 : 1 }}
            >
              {savingCreate && <Loader2 size={15} className="animate-spin" />} {savingCreate ? "Anlegen…" : "Anlegen"}
            </button>
          </div>
        </div>
      )}

      {showAccount && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowAccount(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Konto</h2><button onClick={() => setShowAccount(false)}><X size={20} /></button></div>
            <div className="mb-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
              <div className="text-sm font-semibold">{userName} · Superadmin</div>
              <div className="text-xs" style={{ color: INK_SOFT }}>{user.email}</div>
            </div>
            <button onClick={() => { setShowAccount(false); openEditProfile(); }} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold flex items-center justify-center gap-2" style={{ border: "1.5px solid #D8D5C7", color: INK }}>
              <Pencil size={14} /> Eintrag bearbeiten
            </button>

            <label className="text-xs font-medium block mb-1">Passwort ändern</label>
            <input type="password" value={selfNewPassword} onChange={(e) => setSelfNewPassword(e.target.value)} placeholder="Neues Passwort" className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            <input type="password" value={selfNewPasswordConfirm} onChange={(e) => setSelfNewPasswordConfirm(e.target.value)} placeholder="Neues Passwort wiederholen" className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            {selfPasswordError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{selfPasswordError}</p>}
            {selfPasswordSuccess && <p className="text-xs mb-2" style={{ color: "#2E7D4F" }}>Passwort geändert!</p>}
            <button onClick={handleSelfChangePassword} disabled={savingSelfPassword} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: INK, opacity: savingSelfPassword ? 0.7 : 1 }}>
              {savingSelfPassword && <Loader2 size={15} className="animate-spin" />} {savingSelfPassword ? "Speichern…" : "Passwort speichern"}
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
