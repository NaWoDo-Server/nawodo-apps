import React, { useState, useEffect, useMemo } from "react";
import {
  Home, Plus, X, AlertCircle, Loader2, Search, Trash2, UserX, KeyRound,
  ChevronRight, Check, Users,
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
  useEffect(() => {
    supabase.from("members").select("id, foto_url").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setOwnMemberId(data?.id || null);
      setOwnFotoUrl(data?.foto_url || null);
    });
  }, [user.id]);

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

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [newPassword, setNewPassword] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newType, setNewType] = useState("account"); // "account" | "child"
  const [newVorname, setNewVorname] = useState("");
  const [newNachname, setNewNachname] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPasswordCreate, setNewPasswordCreate] = useState("");
  const [newParentUserId, setNewParentUserId] = useState("");
  const [newChildLogin, setNewChildLogin] = useState(false);
  const [newMitgliedstyp, setNewMitgliedstyp] = useState("mitglied");
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
    const [u, m, mods, perms, gr, mb] = await Promise.all([
      supabase.rpc("list_all_users"),
      supabase.from("members").select("*"),
      supabase.from("app_moderators").select("*"),
      supabase.from("member_permissions").select("*"),
      supabase.from("bereiche").select("*"),
      supabase.from("member_bereiche").select("*"),
    ]);
    setAllUsers(u.data || []);
    setMembers(m.data || []);
    setAppModerators(mods.data || []);
    setMemberPermissions(perms.data || []);
    setBereiche(gr.data || []);
    setMemberBereiche(mb.data || []);
    setLoading(false);
  }

  function memberFor(userId) {
    return members.find((m) => m.user_id === userId && !m.is_child) || null;
  }
  function modAppsFor(userId) {
    return appModerators.filter((r) => r.user_id === userId).map((r) => r.app_key);
  }
  function deniedAppsFor(userId) {
    return memberPermissions.filter((r) => r.user_id === userId && r.allowed === false).map((r) => r.app_key);
  }
  function groupsForMember(memberId) {
    return memberBereiche.filter((r) => r.member_id === memberId).map((r) => r.bereich_key);
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers
      .filter((u) => !q || `${u.name || ""} ${u.email || ""}`.toLowerCase().includes(q))
      .sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || "", "de"));
  }, [allUsers, search]);

  const selectedUser = allUsers.find((u) => u.id === selectedUserId) || null;
  const selectedMember = selectedUserId ? memberFor(selectedUserId) : null;

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

  async function handleToggleAdmin(targetUserId, nextIsAdmin) {
    setActionError("");
    setSavingAction(true);
    try {
      await callAdminFn({ type: "toggle_admin", target_user_id: targetUserId, is_admin: nextIsAdmin });
      await loadAll();
    } catch (e) {
      setActionError(e.message || "Admin-Status konnte nicht geändert werden.");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleToggleModerator(targetUserId, appKey, nextValue) {
    setActionError("");
    setSavingAction(true);
    try {
      if (nextValue) {
        const { error } = await supabase.from("app_moderators").insert({ user_id: targetUserId, app_key: appKey });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("app_moderators").delete().eq("user_id", targetUserId).eq("app_key", appKey);
        if (error) throw error;
      }
      await loadAll();
    } catch (e) {
      setActionError(e.message || "Moderator-Status konnte nicht geändert werden.");
    } finally {
      setSavingAction(false);
    }
  }

  async function handleSetPermission(targetUserId, appKey, allowed) {
    setActionError("");
    setSavingAction(true);
    try {
      await callAdminFn({ type: "set_permission", target_user_id: targetUserId, app_key: appKey, allowed });
      await loadAll();
    } catch (e) {
      setActionError(e.message || "App-Zugriff konnte nicht geändert werden.");
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
      setSelectedUserId(null);
      await loadAll();
    } catch (e) {
      setActionError(e.message || "Account konnte nicht gelöscht werden.");
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
    setNewChildLogin(false);
    setNewMitgliedstyp("mitglied");
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
      if (!newParentUserId) return setCreateError("Bitte einen Elternteil auswählen.");
      body.parent_user_id = newParentUserId;
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
      body.email = email;
      body.password = newPasswordCreate;
      body.app_permissions = newPerms;
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
      <div className="max-w-3xl mx-auto lg:max-w-none lg:mx-0 lg:px-8 px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <img src="/settings/logo-nawodo.png" alt="NaWoDo" className="h-8 object-contain" />
            <h1 className="font-bold text-lg">Settings</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="p-2 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} style={{ color: INK_SOFT }} /></a>
            <button onClick={() => { setShowAccount(true); setSelfPasswordError(""); setSelfPasswordSuccess(false); }} className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>
              {ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}
            </button>
          </div>
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

        <div className="flex flex-col gap-2">
          {rows.map((u) => {
            const m = memberFor(u.id);
            const mods = modAppsFor(u.id);
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUserId(u.id)}
                className="w-full text-left rounded-xl p-3.5 flex items-center justify-between"
                style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {m?.foto_url ? (
                    <img src={m.foto_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#2E86AB1A", color: BLUE }}>
                      <Users size={16} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                      {u.name || u.email}
                      {u.is_admin && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#B54A451A", color: "#B54A45" }}>Admin</span>}
                      {mods.length > 0 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#C9A2271A", color: "#C9A227" }}>Mod · {mods.length}</span>}
                    </div>
                    <div className="text-xs truncate" style={{ color: INK_SOFT }}>{u.email}{m?.mitgliedstyp === "freund" ? " · Freund" : ""}</div>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: INK_SOFT }} className="flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setSelectedUserId(null)}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{selectedUser.name || selectedUser.email}</h2>
              <button onClick={() => setSelectedUserId(null)}><X size={20} /></button>
            </div>
            <div className="mb-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
              <div className="text-xs" style={{ color: INK_SOFT }}>{selectedUser.email}</div>
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
                    <option value="freund">Freund</option>
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

            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "#E9E6D9" }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: INK_SOFT }}>Rollen</div>
              <label className="flex items-center gap-2 text-sm mb-2">
                <input
                  type="checkbox"
                  disabled={savingAction}
                  checked={selectedUser.is_admin === true}
                  onChange={(e) => handleToggleAdmin(selectedUser.id, e.target.checked)}
                />
                Admin (global, in jeder App)
              </label>
              <div className="text-xs mb-1.5" style={{ color: INK_SOFT }}>Moderator für einzelne Apps:</div>
              <div className="flex flex-col gap-1.5">
                {APP_LIST.map((a) => {
                  const isMod = modAppsFor(selectedUser.id).includes(a.key);
                  return (
                    <label key={a.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={savingAction}
                        checked={isMod}
                        onChange={(e) => handleToggleModerator(selectedUser.id, a.key, e.target.checked)}
                      />
                      {a.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "#E9E6D9" }}>
              <div className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: INK_SOFT }}>App-Zugriff</div>
              <div className="flex flex-col gap-1.5">
                {APP_LIST.map((a) => {
                  const denied = deniedAppsFor(selectedUser.id).includes(a.key);
                  return (
                    <label key={a.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        disabled={savingAction}
                        checked={!denied}
                        onChange={(e) => handleSetPermission(selectedUser.id, a.key, e.target.checked)}
                      />
                      {a.label}
                    </label>
                  );
                })}
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
                  onClick={() => handleSetPassword(selectedUser.id)}
                  disabled={savingAction}
                  className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5"
                  style={{ backgroundColor: BLUE, opacity: savingAction ? 0.7 : 1 }}
                >
                  <KeyRound size={14} /> Setzen
                </button>
              </div>
              <p className="text-xs mt-1.5" style={{ color: INK_SOFT }}>Bitte der Person das neue Passwort mitteilen.</p>
            </div>

            {actionError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {actionError}</div>}

            <button
              onClick={() => handleDeleteAccount(selectedUser)}
              disabled={savingAction}
              className="w-full rounded-lg py-2.5 text-sm border flex items-center justify-center gap-2"
              style={{ borderColor: "#E0B8B8", color: "#A13D3D" }}
            >
              <UserX size={14} /> Account vollständig löschen
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowCreate(false)}>
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
              <option value="freund">Freund</option>
            </select>

            {newType === "child" ? (
              <>
                <label className="text-xs font-medium block mb-1">Elternteil</label>
                <select value={newParentUserId} onChange={(e) => setNewParentUserId(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
                  <option value="">Bitte auswählen…</option>
                  {adultsForParent.map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.vorname} {m.nachname}</option>
                  ))}
                </select>

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
        <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowAccount(false)}>
          <div className="w-full max-w-md rounded-t-2xl p-5 pb-8" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Konto</h2><button onClick={() => setShowAccount(false)}><X size={20} /></button></div>
            <div className="mb-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
              <div className="text-sm font-semibold">{userName} · Superadmin</div>
              <div className="text-xs" style={{ color: INK_SOFT }}>{user.email}</div>
            </div>
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
    </div>
  );
}
