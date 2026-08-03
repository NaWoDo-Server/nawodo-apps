import React, { useState, useEffect, useMemo } from "react";
import {
  Home, Plus, X, AlertCircle, Loader2, Calendar, User, Users, FileText, Paperclip,
  Trash2, Pencil, ChevronDown, ChevronRight, Check, Download, Archive,
} from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";

const PAPER = "#F1F0EA";
const INK = "#2B2B26";
const INK_SOFT = "#6B6A61";
const BORDER_SOFT = "#D8D5C7";
const BLUE = "#2E86AB";

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
      .eq("app_key", "workshop")
      .maybeSingle()
      .then(({ data }) => setAccess(!data || data.allowed !== false))
      .catch(() => setAccess(true));
  }, [session]);

  if (session === undefined || (session && access === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}>
        <Loader2 className="animate-spin" size={24} style={{ color: INK_SOFT }} />
      </div>
    );
  }
  if (!session) return null;

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

  return <WorkshopApp session={session} />;
}

function WorkshopApp({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
  const initial = userName.charAt(0).toUpperCase();
  const isAdmin = user.user_metadata?.is_admin === true;
  const isSuperAdmin = user.user_metadata?.is_superadmin === true;

  const [myModApps, setMyModApps] = useState([]);
  const isElevated = isAdmin || isSuperAdmin || myModApps.includes("workshop");

  const [workshops, setWorkshops] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [foodItems, setFoodItems] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [expandedArchiveId, setExpandedArchiveId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState(null);
  const [formDate, setFormDate] = useState(todayStr());
  const [formModeratorUserId, setFormModeratorUserId] = useState("");
  const [formThemen, setFormThemen] = useState("");
  const [formThemenInfo, setFormThemenInfo] = useState("");
  const [formAgenda, setFormAgenda] = useState("");
  const [formFiles, setFormFiles] = useState([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showAccount, setShowAccount] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [ws, att, food, at, mods, us] = await Promise.all([
      supabase.from("workshops").select("*").order("date", { ascending: false }),
      supabase.from("workshop_attachments").select("*"),
      supabase.from("workshop_food_items").select("*").order("created_at"),
      supabase.from("workshop_attendance").select("*"),
      supabase.from("app_moderators").select("app_key").eq("user_id", user.id),
      supabase.rpc("list_all_users"),
    ]);
    setWorkshops(ws.data || []);
    setAttachments(att.data || []);
    setFoodItems(food.data || []);
    setAttendance(at.data || []);
    setMyModApps((mods.data || []).map((r) => r.app_key));
    setAllUsers(us.data || []);
    setLoading(false);
  }

  // "Aktueller" Workshop: der naechste bevorstehende (Datum >= heute); gibt es keinen, der
  // zuletzt vergangene. Alle anderen wandern automatisch ins Archiv - wie bei der Pinnwand.
  const { currentWorkshop, archivedWorkshops } = useMemo(() => {
    const today = todayStr();
    const upcoming = workshops.filter((w) => w.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = workshops.filter((w) => w.date < today).sort((a, b) => b.date.localeCompare(a.date));
    const current = upcoming[0] || past[0] || null;
    const archived = workshops.filter((w) => w.id !== current?.id).sort((a, b) => b.date.localeCompare(a.date));
    return { currentWorkshop: current, archivedWorkshops: archived };
  }, [workshops]);

  function attachmentsFor(workshopId) { return attachments.filter((a) => a.workshop_id === workshopId); }
  function foodItemsFor(workshopId) { return foodItems.filter((f) => f.workshop_id === workshopId); }
  function attendanceFor(workshopId) { return attendance.filter((a) => a.workshop_id === workshopId); }
  function myAttendance(workshopId) { return attendance.find((a) => a.workshop_id === workshopId && a.user_id === user.id); }

  function canManageWorkshop(w) {
    return !!w && (isElevated || w.created_by === user.id);
  }

  function resetForm() {
    setFormDate(todayStr());
    setFormModeratorUserId("");
    setFormThemen("");
    setFormThemenInfo("");
    setFormAgenda("");
    setFormFiles([]);
    setFormError("");
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
    setFormThemen(w.themen || "");
    setFormThemenInfo(w.themen_info || "");
    setFormAgenda(w.agenda || "");
    setFormFiles([]);
    setFormError("");
    setShowForm(true);
  }

  async function handleSaveWorkshop() {
    setFormError("");
    if (!formDate) return setFormError("Bitte ein Datum eintragen.");
    setSaving(true);
    try {
      const moderator = allUsers.find((u) => u.id === formModeratorUserId);
      const payload = {
        date: formDate,
        moderator_user_id: formModeratorUserId || null,
        moderator_name: moderator?.name || null,
        themen: formThemen.trim() || null,
        themen_info: formThemenInfo.trim() || null,
        agenda: formAgenda.trim() || null,
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

      setShowForm(false);
      setEditingWorkshop(null);
      await loadAll();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}>
        <Loader2 className="animate-spin" size={24} style={{ color: INK_SOFT }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAPER, color: INK }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <img src="/workshop/logo-nawodo.png" alt="" className="w-8 h-8 rounded-lg" />
            <h1 className="font-bold text-lg">Workshop</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="p-2 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} style={{ color: INK_SOFT }} /></a>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white flex-shrink-0" style={{ backgroundColor: BLUE }}>{initial}</button>
          </div>
        </div>

        <div className="mb-4">
          <button
            onClick={openNewForm}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold"
            style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
          >
            <Plus size={14} /> Neuer Workshop
          </button>
        </div>

        {!currentWorkshop && (
          <div className="text-center py-10 rounded-xl mb-4" style={{ backgroundColor: "#E9E6D9" }}>
            <p className="text-sm" style={{ color: INK_SOFT }}>Noch kein Workshop angelegt.</p>
          </div>
        )}

        {currentWorkshop && (
          <div className="mb-6">
            <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: INK_SOFT }}>Aktueller Workshop</div>
            <WorkshopCard
              w={currentWorkshop}
              highlighted
              attachmentsList={attachmentsFor(currentWorkshop.id)}
              foodList={foodItemsFor(currentWorkshop.id)}
              attendanceList={attendanceFor(currentWorkshop.id)}
              myAttendanceRow={myAttendance(currentWorkshop.id)}
              canManage={canManageWorkshop(currentWorkshop)}
              userId={user.id}
              onEdit={() => openEditForm(currentWorkshop)}
              onDelete={() => handleDeleteWorkshop(currentWorkshop)}
              onDeleteAttachment={handleDeleteAttachment}
              onAddFood={(text) => handleAddFoodItem(currentWorkshop.id, text)}
              onDeleteFood={handleDeleteFoodItem}
              onSetAttendance={(v) => handleSetAttendance(currentWorkshop.id, v)}
            />
          </div>
        )}

        {archivedWorkshops.length > 0 && (
          <div>
            <button
              onClick={() => setShowArchive((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-3"
              style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}
            >
              <Archive size={12} /> {showArchive ? "Archiv ausblenden" : `Archiv anzeigen (${archivedWorkshops.length})`}
            </button>
            {showArchive && (
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
                          canManage={canManageWorkshop(w)}
                          userId={user.id}
                          onCollapse={() => setExpandedArchiveId(null)}
                          onEdit={() => openEditForm(w)}
                          onDelete={() => handleDeleteWorkshop(w)}
                          onDeleteAttachment={handleDeleteAttachment}
                          onAddFood={(text) => handleAddFoodItem(w.id, text)}
                          onDeleteFood={handleDeleteFoodItem}
                          onSetAttendance={(v) => handleSetAttendance(w.id, v)}
                        />
                      ) : (
                        <button
                          onClick={() => setExpandedArchiveId(w.id)}
                          className="w-full text-left rounded-xl p-3.5 flex items-center justify-between"
                          style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-sm">{fmtDateLong(w.date)}</div>
                            {w.themen && <div className="text-xs truncate" style={{ color: INK_SOFT }}>{w.themen}</div>}
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editingWorkshop ? "Workshop bearbeiten" : "Neuer Workshop"}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

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
            <textarea value={formThemen} onChange={(e) => setFormThemen(e.target.value)} rows={3} placeholder="Ein Thema pro Zeile" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Infos zu den Themen</label>
            <textarea value={formThemenInfo} onChange={(e) => setFormThemenInfo(e.target.value)} rows={3} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Agenda</label>
            <textarea value={formAgenda} onChange={(e) => setFormAgenda(e.target.value)} rows={3} placeholder="z.B. 18:00 Begrüßung, 18:15 Thema 1, ..." className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Anhänge (optional)</label>
            <input type="file" multiple onChange={(e) => setFormFiles(Array.from(e.target.files || []))} className="w-full text-sm mb-3" />

            {formError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}</div>}

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
        <div className="fixed inset-0 flex items-end justify-center z-50" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowAccount(false)}>
          <div className="w-full max-w-md rounded-t-2xl p-5 pb-8" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Konto</h2><button onClick={() => setShowAccount(false)}><X size={20} /></button></div>
            <div className="mb-4 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "#E4E1D3" }}>
              <div className="text-sm font-semibold">{userName}{isAdmin ? " · Admin" : ""}</div>
              <div className="text-xs" style={{ color: INK_SOFT }}>{user.email}</div>
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

function WorkshopCard({
  w, highlighted, attachmentsList, foodList, attendanceList, myAttendanceRow, canManage, userId,
  onCollapse, onEdit, onDelete, onDeleteAttachment, onAddFood, onDeleteFood, onSetAttendance,
}) {
  const [newFoodText, setNewFoodText] = useState("");
  const yesCount = attendanceList.filter((a) => a.attending).length;
  const yesNames = attendanceList.filter((a) => a.attending).map((a) => a.user_name);

  return (
    <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: "#fff", boxShadow: highlighted ? "0 2px 8px rgba(0,0,0,0.10)" : "0 1px 3px rgba(0,0,0,0.08)", border: highlighted ? `1.5px solid ${BLUE}33` : "none" }}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-1.5 font-bold text-base"><Calendar size={15} style={{ color: BLUE }} /> {fmtDateLong(w.date)}</div>
          {w.moderator_name && <div className="text-xs mt-0.5" style={{ color: INK_SOFT }}>Moderator/in: {w.moderator_name}</div>}
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

      {w.themen && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Themen</div>
          <p className="text-sm whitespace-pre-wrap">{w.themen}</p>
        </div>
      )}
      {w.themen_info && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Infos zu den Themen</div>
          <p className="text-sm whitespace-pre-wrap" style={{ color: INK_SOFT }}>{w.themen_info}</p>
        </div>
      )}
      {w.agenda && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Agenda</div>
          <p className="text-sm whitespace-pre-wrap">{w.agenda}</p>
        </div>
      )}

      {attachmentsList.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: INK_SOFT }}>Anhänge</div>
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

      <div className="mb-3 pt-3" style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
        <div className="text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: INK_SOFT }}>Wer bringt was mit?</div>
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

      <div className="pt-3" style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: INK_SOFT }}>Teilnahme</div>
          <div className="text-xs" style={{ color: INK_SOFT }}>{yesCount} {yesCount === 1 ? "Zusage" : "Zusagen"}</div>
        </div>
        <div className="flex gap-2 mb-2">
          <button
            onClick={() => onSetAttendance(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: myAttendanceRow?.attending === true ? "#2E7D4F" : "#2E7D4F1A", color: myAttendanceRow?.attending === true ? "#fff" : "#2E7D4F" }}
          >
            <Check size={14} /> Ich komme
          </button>
          <button
            onClick={() => onSetAttendance(false)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: myAttendanceRow?.attending === false ? "#A13D3D" : "#A13D3D1A", color: myAttendanceRow?.attending === false ? "#fff" : "#A13D3D" }}
          >
            <X size={14} /> Ich komme nicht
          </button>
        </div>
        {yesNames.length > 0 && (
          <p className="text-xs" style={{ color: INK_SOFT }}>{yesNames.join(", ")}</p>
        )}
      </div>
    </div>
  );
}
