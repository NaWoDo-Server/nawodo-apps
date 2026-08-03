import React, { useState, useEffect, useMemo } from "react";
import {
  User, Users, Phone, Smartphone, Mail, MapPin, Building2, Calendar,
  Download, Search, Plus, X, Pencil, Trash2, Loader2, AlertCircle, Home,
} from "lucide-react";
import { supabase, configMissing } from "./supabaseClient";
import { PAPER, INK, INK_SOFT, BORDER, BORDER_SOFT } from "./theme";

const BLUE = "#2E86AB";

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
  if (m.anschrift) lines.push(`ADR;TYPE=HOME:;;${m.anschrift.replace(/\n/g, ", ")};;;;`);
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
  if (session === undefined || session === null) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={28} style={{ color: INK_SOFT }} /></div>;
  }
  return <MitgliederApp session={session} />;
}

function MitgliederApp({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
  const isAdmin = user.user_metadata?.is_admin === true;
  const initial = userName.charAt(0).toUpperCase();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [showTypePick, setShowTypePick] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formIsChild, setFormIsChild] = useState(false);
  const [formNachname, setFormNachname] = useState("");
  const [formVorname, setFormVorname] = useState("");
  const [formAnschrift, setFormAnschrift] = useState("");
  const [formWohneinheit, setFormWohneinheit] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formTelefon, setFormTelefon] = useState("");
  const [formHandy, setFormHandy] = useState("");
  const [formGeburtstag, setFormGeburtstag] = useState("");
  const [formParent2, setFormParent2] = useState("");
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
    const { data } = await supabase.from("members").select("*").order("nachname").order("vorname");
    setMembers(data || []);
    setLoading(false);
  }

  const myOwnEntry = members.find((m) => m.user_id === user.id);
  const adultMembers = useMemo(() => members.filter((m) => !m.is_child && m.user_id), [members]);
  const memberById = (id) => members.find((m) => m.user_id === id);

  function parentNames(m) {
    const names = [];
    if (m.parent1_user_id) { const p = memberById(m.parent1_user_id); if (p) names.push(`${p.vorname} ${p.nachname}`); }
    if (m.parent2_user_id) { const p = memberById(m.parent2_user_id); if (p) names.push(`${p.vorname} ${p.nachname}`); }
    return names;
  }

  const q = search.trim().toLowerCase();
  const visibleMembers = useMemo(() => {
    if (!q) return members;
    return members.filter((m) =>
      `${m.vorname} ${m.nachname} ${m.anschrift || ""} ${m.wohneinheit || ""} ${m.email || ""}`.toLowerCase().includes(q)
    );
  }, [members, q]);

  function resetForm() {
    setFormIsChild(false);
    setFormNachname("");
    setFormVorname("");
    setFormAnschrift("");
    setFormWohneinheit("");
    setFormEmail("");
    setFormTelefon("");
    setFormHandy("");
    setFormGeburtstag("");
    setFormParent2("");
    setFormError("");
  }

  function openNewFlow() {
    setEditingMember(null);
    resetForm();
    setShowTypePick(true);
  }

  function pickType(isChild) {
    setFormIsChild(isChild);
    setShowTypePick(false);
    setShowForm(true);
  }

  function openEditForm(m) {
    setEditingMember(m);
    setFormIsChild(m.is_child);
    setFormNachname(m.nachname);
    setFormVorname(m.vorname);
    setFormAnschrift(m.anschrift || "");
    setFormWohneinheit(m.wohneinheit || "");
    setFormEmail(m.email || "");
    setFormTelefon(m.telefon || "");
    setFormHandy(m.handy || "");
    setFormGeburtstag(m.geburtstag || "");
    const otherParent = [m.parent1_user_id, m.parent2_user_id].find((id) => id && id !== user.id);
    setFormParent2(otherParent || "");
    setFormError("");
    setShowForm(true);
  }

  async function handleSave() {
    setFormError("");
    if (!formNachname.trim()) return setFormError("Bitte einen Nachnamen eintragen.");
    if (!formVorname.trim()) return setFormError("Bitte einen Vornamen eintragen.");
    setSaving(true);
    try {
      const payload = {
        nachname: formNachname.trim(),
        vorname: formVorname.trim(),
        anschrift: formAnschrift.trim() || null,
        wohneinheit: formWohneinheit.trim() || null,
        email: formEmail.trim() || null,
        telefon: formTelefon.trim() || null,
        handy: formHandy.trim() || null,
        geburtstag: formGeburtstag || null,
      };
      if (editingMember) {
        if (formIsChild) {
          payload.parent1_user_id = editingMember.parent1_user_id === user.id || !editingMember.parent1_user_id ? user.id : editingMember.parent1_user_id;
          payload.parent2_user_id = formParent2 || null;
        }
        const { error } = await supabase.from("members").update(payload).eq("id", editingMember.id);
        if (error) throw error;
      } else if (formIsChild) {
        payload.is_child = true;
        payload.created_by = user.id;
        payload.parent1_user_id = user.id;
        payload.parent2_user_id = formParent2 || null;
        const { error } = await supabase.from("members").insert(payload);
        if (error) throw error;
      } else {
        payload.is_child = false;
        payload.created_by = user.id;
        payload.user_id = user.id;
        const { error } = await supabase.from("members").insert(payload);
        if (error) throw error;
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
    downloadBlob(buildVCard(m), `${m.vorname}-${m.nachname}.vcf`, "text/vcard;charset=utf-8");
  }

  function exportAllCSV() {
    const header = ["Nachname", "Vorname", "Anschrift", "Wohneinheit", "Email", "Telefon", "Handy", "Geburtstag", "Typ", "Eltern"];
    const rows = members.map((m) => [
      m.nachname, m.vorname, m.anschrift || "", m.wohneinheit || "", m.email || "", m.telefon || "", m.handy || "",
      m.geburtstag || "", m.is_child ? "Kind" : "Erwachsen", parentNames(m).join(" / "),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(";")).join("\r\n");
    downloadBlob("﻿" + csv, "nawodo-mitglieder.csv", "text/csv;charset=utf-8");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
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
      <div className="sm:max-w-2xl mx-auto sm:border-x" style={{ borderColor: "#E4E1D3" }}>
        <div className="px-5 pt-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/mitglieder/logo-nawodo.png" alt="NaWoDo" className="h-8 object-contain" />
            <h1 className="font-bold text-lg">Mitglieder</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="p-2 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} style={{ color: INK_SOFT }} /></a>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white flex-shrink-0" style={{ backgroundColor: INK }}>{initial}</button>
          </div>
        </div>

        <div className="px-5 mb-3">
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

        <div className="px-5 mb-4 flex items-center justify-between gap-2">
          <button onClick={openNewFlow} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: INK }}>
            <Plus size={14} /> Neuer Eintrag
          </button>
          {isAdmin && (
            <button onClick={exportAllCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
              <Download size={12} /> CSV
            </button>
          )}
        </div>

        <div className="px-5 flex flex-col gap-3">
          {visibleMembers.length === 0 && (
            <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}>
              <p className="text-sm" style={{ color: INK_SOFT }}>Noch keine Einträge.</p>
            </div>
          )}
          {visibleMembers.map((m) => {
            const canManage = isAdmin || m.created_by === user.id;
            const parents = m.is_child ? parentNames(m) : [];
            return (
              <div key={m.id} className="rounded-xl p-4" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: m.is_child ? "#6C63A61A" : "#2E86AB1A", color: m.is_child ? "#6C63A6" : BLUE }}>
                      {m.is_child ? <Users size={16} /> : <User size={16} />}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{m.vorname} {m.nachname}</div>
                      {m.is_child && <div className="text-xs" style={{ color: INK_SOFT }}>Kind{parents.length > 0 ? ` von ${parents.join(" & ")}` : ""}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => exportVCard(m)} title="Als vCard herunterladen"><Download size={14} style={{ color: "#B8B4A2" }} /></button>
                    {canManage && (
                      <>
                        <button onClick={() => openEditForm(m)}><Pencil size={14} style={{ color: "#B8B4A2" }} /></button>
                        <button onClick={() => handleDelete(m)}><Trash2 size={14} style={{ color: "#B8B4A2" }} /></button>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-1 mt-2 text-xs" style={{ color: INK_SOFT }}>
                  {m.wohneinheit && <div className="flex items-center gap-1.5"><Building2 size={12} /> WE {m.wohneinheit}</div>}
                  {m.anschrift && <div className="flex items-center gap-1.5"><MapPin size={12} /> {m.anschrift}</div>}
                  {m.email && <div className="flex items-center gap-1.5"><Mail size={12} /> {m.email}</div>}
                  {m.telefon && <div className="flex items-center gap-1.5"><Phone size={12} /> {m.telefon}</div>}
                  {m.handy && <div className="flex items-center gap-1.5"><Smartphone size={12} /> {m.handy}</div>}
                  {m.geburtstag && <div className="flex items-center gap-1.5"><Calendar size={12} /> {fmtBirthday(m.geburtstag)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showTypePick && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowTypePick(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Neuer Eintrag</h2><button onClick={() => setShowTypePick(false)}><X size={20} /></button></div>
            <div className="flex flex-col gap-2">
              {!myOwnEntry ? (
                <button onClick={() => pickType(false)} className="flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-semibold text-left" style={{ border: `1.5px solid ${BORDER_SOFT}` }}>
                  <User size={16} style={{ color: BLUE }} /> Eigener Eintrag
                </button>
              ) : (
                <p className="text-xs px-1" style={{ color: INK_SOFT }}>Du hast bereits einen eigenen Eintrag.</p>
              )}
              <button onClick={() => pickType(true)} className="flex items-center gap-2.5 px-4 py-3 rounded-lg text-sm font-semibold text-left" style={{ border: `1.5px solid ${BORDER_SOFT}` }}>
                <Users size={16} style={{ color: "#6C63A6" }} /> Kind hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editingMember ? "Eintrag bearbeiten" : formIsChild ? "Kind hinzufügen" : "Eigener Eintrag"}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Vorname</label>
                <input value={formVorname} onChange={(e) => setFormVorname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium block mb-1">Nachname</label>
                <input value={formNachname} onChange={(e) => setFormNachname(e.target.value)} className="w-full rounded-lg px-3 py-2.5 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </div>
            </div>

            <label className="text-xs font-medium block mb-1">Anschrift</label>
            <input value={formAnschrift} onChange={(e) => setFormAnschrift(e.target.value)} placeholder="Straße, PLZ Ort" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Wohneinheit (WE)</label>
            <input value={formWohneinheit} onChange={(e) => setFormWohneinheit(e.target.value)} placeholder="z.B. WE 12" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            <label className="text-xs font-medium block mb-1">Geburtstag</label>
            <input type="date" value={formGeburtstag} onChange={(e) => setFormGeburtstag(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

            {!formIsChild && (
              <>
                <label className="text-xs font-medium block mb-1">E-Mail</label>
                <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

                <label className="text-xs font-medium block mb-1">Telefon (Festnetz)</label>
                <input value={formTelefon} onChange={(e) => setFormTelefon(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

                <label className="text-xs font-medium block mb-1">Handy</label>
                <input value={formHandy} onChange={(e) => setFormHandy(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
              </>
            )}

            {formIsChild && (
              <>
                <label className="text-xs font-medium block mb-1">Zweiter Elternteil (optional)</label>
                <select value={formParent2} onChange={(e) => setFormParent2(e.target.value)} className="w-full rounded-lg px-3 py-2.5 mb-1 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}>
                  <option value="">Keine Angabe</option>
                  {adultMembers.filter((m) => m.user_id !== user.id).map((m) => (
                    <option key={m.user_id} value={m.user_id}>{m.vorname} {m.nachname}</option>
                  ))}
                </select>
                <p className="text-xs mb-3" style={{ color: INK_SOFT }}>Du bist automatisch als Elternteil verknüpft.</p>
              </>
            )}

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
