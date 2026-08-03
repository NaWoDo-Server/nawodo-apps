import React, { useState, useEffect, useMemo } from "react";
import { Search, Plus, X, Pencil, Trash2, Loader2, AlertCircle, Home, ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";

const PAPER = "#F1F0EA";
const INK = "#2B2B26";
const INK_SOFT = "#6B6A61";
const TEAL = "#3E8E7E";

const SECTIONS = [
  { key: "projekt", label: "Rund ums Wohnprojekt", color: "#C9752F" },
  { key: "app", label: "Rund um diese Seite", color: "#3E8E7E" },
];

// Sentinel-Wert: Wenn eine FAQ-Antwort genau diesem Text entspricht, wird statt
// des gespeicherten Texts eine live aus der Datenbank abgefragte Moderatoren-Liste
// angezeigt (siehe <ModeratorList /> weiter unten).
const DYNAMIC_MODERATORS_KEY = "__DYNAMIC_MODERATORS__";

const APP_LIST = [
  { key: "sharing", label: "Sharing" },
  { key: "termine", label: "Termine" },
  { key: "fahrtenbuch", label: "Fahrtenbuch" },
  { key: "faq", label: "FAQ" },
  { key: "pinnwand", label: "Pinnwand" },
  { key: "mitglieder", label: "Mitglieder" },
  { key: "workshop", label: "Workshop" },
  { key: "bulldozer", label: "Bulldozer" },
];

function ModeratorList() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: mods }, { data: members }, { data: admins }] = await Promise.all([
        supabase.from("app_moderators").select("user_id, app_key"),
        supabase.from("members").select("user_id, vorname, nachname"),
        supabase.rpc("list_admin_user_ids"),
      ]);
      if (!alive) return;
      const nameFor = (uid) => {
        const m = (members || []).find((mm) => mm.user_id === uid);
        if (!m) return "Unbekannt";
        return [m.vorname, m.nachname].filter(Boolean).join(" ").trim() || "Unbekannt";
      };
      const byApp = {};
      (mods || []).forEach((mo) => {
        if (!byApp[mo.app_key]) byApp[mo.app_key] = [];
        byApp[mo.app_key].push(nameFor(mo.user_id));
      });
      const adminNames = (admins || []).map((a) => nameFor(a.user_id));
      setRows([
        { key: "admin", label: "Admin", names: adminNames },
        ...APP_LIST.map((a) => ({ key: a.key, label: a.label, names: byApp[a.key] || [] })),
      ]);
    })();
    return () => { alive = false; };
  }, []);

  if (rows === null) {
    return (
      <div className="flex items-center gap-2 text-sm" style={{ color: INK_SOFT }}>
        <Loader2 size={14} className="animate-spin" /> Wird geladen…
      </div>
    );
  }

  return (
    <div className="grid gap-x-4 gap-y-2 items-start" style={{ gridTemplateColumns: "auto 1fr" }}>
      {rows.map((r) => (
        <React.Fragment key={r.key}>
          <span className="text-sm font-medium">{r.label}</span>
          <span className="text-sm" style={{ color: r.names.length ? INK : INK_SOFT }}>{r.names.length ? r.names.join(", ") : "– niemand"}</span>
        </React.Fragment>
      ))}
    </div>
  );
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
      .eq("app_key", "faq")
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

  return <FaqApp session={session} />;
}

function FaqApp({ session }) {
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
  const initial = userName.charAt(0).toUpperCase();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState(() => new Set());
  const [sectionOpen, setSectionOpen] = useState({ projekt: true, app: false });

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formSection, setFormSection] = useState("app");
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
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
    const { data } = await supabase.from("faq_entries").select("*").order("section").order("sort_order");
    setEntries(data || []);
    setLoading(false);
  }

  function toggleOpen(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSection(key) {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return entries;
    return entries.filter((e) => e.question.toLowerCase().includes(q) || e.answer.toLowerCase().includes(q));
  }, [entries, q]);

  function openNewForm(section) {
    setEditingEntry(null);
    setFormError("");
    setFormSection(section || "app");
    setFormQuestion("");
    setFormAnswer("");
    setShowForm(true);
  }

  function openEditForm(entry) {
    setEditingEntry(entry);
    setFormError("");
    setFormSection(entry.section);
    setFormQuestion(entry.question);
    setFormAnswer(entry.answer);
    setShowForm(true);
  }

  async function handleSave() {
    setFormError("");
    if (!formQuestion.trim()) return setFormError("Bitte eine Frage eintragen.");
    if (!formAnswer.trim()) return setFormError("Bitte eine Antwort eintragen.");
    setSaving(true);
    try {
      const payload = { section: formSection, question: formQuestion.trim(), answer: formAnswer.trim() };
      if (editingEntry) {
        const { error } = await supabase.from("faq_entries").update(payload).eq("id", editingEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("faq_entries").insert({ ...payload, created_by: user.id });
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

  async function handleDelete() {
    if (!editingEntry) return;
    if (!window.confirm("Diese Frage wirklich löschen?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("faq_entries").delete().eq("id", editingEntry.id);
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
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={28} style={{ color: INK_SOFT }} /></div>;
  }

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="sm:max-w-2xl mx-auto lg:max-w-none lg:w-2/3">
        <div className="px-5 pt-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/faq/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
            <h1 className="font-bold text-lg lg:text-2xl">FAQ</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>{ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}</button>
          </div>
        </div>

        <div className="px-5 mb-4">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: INK_SOFT }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Frage durchsuchen…"
              className="w-full rounded-full pl-9 pr-3 py-2.5 text-sm border"
              style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}
            />
          </div>
        </div>

        {SECTIONS.map((sec) => {
          const items = filtered.filter((e) => e.section === sec.key);
          if (q && items.length === 0) return null;
          const expanded = q ? true : sectionOpen[sec.key];
          return (
            <div key={sec.key} className="px-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => toggleSection(sec.key)} className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: INK }} />
                  {expanded ? <ChevronDown size={14} style={{ color: INK }} className="flex-shrink-0" /> : <ChevronRight size={14} style={{ color: INK }} className="flex-shrink-0" />}
                  <span className="text-sm font-bold uppercase tracking-wide" style={{ color: INK }}>{sec.label}</span>
                </button>
                {isAdmin && (
                  <button onClick={() => openNewForm(sec.key)} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ border: "1.5px dashed #B8B4A2", color: INK_SOFT }}>
                    <Plus size={12} /> Neue Frage
                  </button>
                )}
              </div>

              {!expanded ? null : items.length === 0 ? (
                <div className="text-center py-8 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}>
                  <p className="text-sm" style={{ color: INK_SOFT }}>Noch keine Fragen hier.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((e) => {
                    const open = openIds.has(e.id);
                    return (
                      <div key={e.id} className="rounded-lg" style={{ backgroundColor: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
                        <button onClick={() => toggleOpen(e.id)} className="w-full flex items-center justify-between gap-2 px-3.5 py-3 text-left">
                          <div className="flex items-center gap-2 min-w-0">
                            {open ? <ChevronDown size={14} style={{ color: INK_SOFT }} className="flex-shrink-0" /> : <ChevronRight size={14} style={{ color: INK_SOFT }} className="flex-shrink-0" />}
                            <span className="text-sm font-semibold truncate">{e.question}</span>
                          </div>
                          {isAdmin && (
                            <span
                              onClick={(ev) => { ev.stopPropagation(); openEditForm(e); }}
                              className="flex-shrink-0 p-1"
                            >
                              <Pencil size={13} style={{ color: "#B8B4A2" }} />
                            </span>
                          )}
                        </button>
                        {open && (
                          <div className="px-3.5 pb-3.5 pt-0.5 text-sm whitespace-pre-wrap" style={{ color: INK_SOFT, borderTop: "1px solid #F1F0EA", marginTop: 0 }}>
                            {e.answer === DYNAMIC_MODERATORS_KEY ? <ModeratorList /> : e.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {q && filtered.length === 0 && (
          <div className="px-5">
            <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}>
              <HelpCircle className="mx-auto mb-2" size={22} style={{ color: INK_SOFT }} />
              <p className="text-sm" style={{ color: INK_SOFT }}>Keine Treffer für "{search}".</p>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowForm(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">{editingEntry ? "Frage bearbeiten" : "Neue Frage"}</h2><button onClick={() => setShowForm(false)}><X size={20} /></button></div>

            <label className="text-xs font-medium block mb-1.5">Bereich</label>
            <div className="flex gap-2 mb-3">
              {SECTIONS.map((sec) => (
                <button
                  key={sec.key}
                  onClick={() => setFormSection(sec.key)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: formSection === sec.key ? TEAL : "transparent", color: formSection === sec.key ? "#fff" : INK, border: `1.5px solid ${formSection === sec.key ? TEAL : "#D8D5C7"}` }}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            <label className="text-xs font-medium block mb-1">Frage</label>
            <input value={formQuestion} onChange={(e) => setFormQuestion(e.target.value)} placeholder="z.B. Wie lautet das WLAN-Passwort?" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Antwort</label>
            {editingEntry && editingEntry.answer === DYNAMIC_MODERATORS_KEY ? (
              <div className="w-full rounded-lg px-3 py-2.5 mb-3 text-xs" style={{ backgroundColor: "#E9E6D9", color: INK_SOFT }}>
                Diese Antwort wird automatisch aus der aktuellen Moderatoren-Liste erzeugt und kann hier nicht als Text bearbeitet werden. Die Frage selbst kannst du oben trotzdem umbenennen.
              </div>
            ) : (
              <textarea value={formAnswer} onChange={(e) => setFormAnswer(e.target.value)} placeholder="Antwort…" rows={4} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }} />
            )}

            {formError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}</div>}

            <button onClick={handleSave} disabled={saving} className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2 mb-2" style={{ backgroundColor: TEAL, opacity: saving ? 0.7 : 1 }}>
              {saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Speichern…" : editingEntry ? "Änderungen speichern" : "Anlegen"}
            </button>
            {editingEntry && (
              <button onClick={handleDelete} disabled={saving} className="w-full rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-2" style={{ color: "#A13D3D", border: "1.5px solid #E0B8B8" }}>
                <Trash2 size={14} /> Frage löschen
              </button>
            )}
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
