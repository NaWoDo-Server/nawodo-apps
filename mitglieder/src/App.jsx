import React, { useState, useEffect, useMemo } from "react";
import {
  User, Users, Phone, Smartphone, Mail, MapPin, Building2, Calendar,
  Download, Search, Plus, X, Pencil, Trash2, Loader2, AlertCircle, Home,
  LayoutGrid, Image as ImageIcon, Camera, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";
import { PAPER, INK, INK_SOFT, BORDER, BORDER_SOFT } from "./theme";

const BLUE = "#2E86AB";

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
  const [allUsers, setAllUsers] = useState([]);
  const [bereicheAssign, setBereicheAssign] = useState([]);
  const [bereiche, setBereiche] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeBereich, setActiveBereich] = useState(null);
  const [typeFilter, setTypeFilter] = useState("mitglieder"); // "mitglieder" | "kinder" | "alle"
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [profileMember, setProfileMember] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [showTypePick, setShowTypePick] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [targetSelfUserId, setTargetSelfUserId] = useState(null);
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
  const [formFotoFile, setFormFotoFile] = useState(null);
  const [formFotoPreview, setFormFotoPreview] = useState(null);
  const [formBereiche, setFormBereiche] = useState([]);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState("");
  const [newGroupEmail, setNewGroupEmail] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
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
    const [m, bu, ba, gr] = await Promise.all([
      supabase.from("members").select("*"),
      supabase.rpc("list_all_users"),
      supabase.from("member_bereiche").select("*"),
      supabase.from("bereiche").select("*"),
    ]);
    setMembers(m.data || []);
    setAllUsers(bu.data || []);
    setBereicheAssign(ba.data || []);
    setBereiche(gr.data || []);
    setLoading(false);
  }

  // Vorbelegte Gesamtliste: jeder registrierte Account erscheint schon, auch wenn er sein
  // Profil noch nicht ausgefüllt hat (dann als "Platzhalter" mit Namen aus dem Account).
  const roster = useMemo(() => {
    const selfByUserId = {};
    members.forEach((m) => { if (!m.is_child && m.user_id) selfByUserId[m.user_id] = m; });
    const adults = allUsers.map((u) => {
      const existing = selfByUserId[u.id];
      if (existing) return { ...existing, isPlaceholder: false };
      return {
        id: null, user_id: u.id, created_by: null, is_child: false, isPlaceholder: true,
        vorname: u.name, nachname: "", anschrift: null, wohneinheit: null,
        email: u.email, telefon: null, handy: null, geburtstag: null, foto_url: null,
        parent1_user_id: null, parent2_user_id: null,
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
      setShowAddGroup(false);
      await loadAll();
    } catch (e) {
      alert(e.message || "Gruppe konnte nicht angelegt werden.");
    } finally {
      setSavingGroup(false);
    }
  }

  const adultMembers = useMemo(() => members.filter((m) => !m.is_child && m.user_id), [members]);

  const q = search.trim().toLowerCase();
  const visibleMembers = useMemo(() => {
    return roster
      .filter((m) => typeFilter === "alle" || (typeFilter === "mitglieder" ? !m.is_child : m.is_child))
      .filter((m) => !activeBereich || (m.id && bereicheForMember(m.id).includes(activeBereich)))
      .filter((m) => !q || `${m.vorname} ${m.nachname} ${m.anschrift || ""} ${m.wohneinheit || ""} ${m.email || ""}`.toLowerCase().includes(q));
  }, [roster, activeBereich, q, bereicheAssign, typeFilter]);

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
    setFormFotoFile(null);
    setFormFotoPreview(null);
    setFormBereiche([]);
    setFormError("");
  }

  const myOwnEntry = members.find((m) => m.user_id === user.id && !m.is_child);

  function openNewFlow() {
    setEditingMember(null);
    setTargetSelfUserId(null);
    resetForm();
    setShowTypePick(true);
  }

  function pickType(isChild) {
    setFormIsChild(isChild);
    setTargetSelfUserId(isChild ? null : user.id);
    setShowTypePick(false);
    setShowForm(true);
  }

  // Admin (oder man selbst) kann den Platzhalter-Eintrag eines registrierten Accounts ausfüllen.
  function openFillPlaceholder(row) {
    resetForm();
    setEditingMember(null);
    setTargetSelfUserId(row.user_id);
    setFormIsChild(false);
    setFormVorname(row.vorname || "");
    setShowForm(true);
  }

  function openEditForm(m) {
    setEditingMember(m);
    setTargetSelfUserId(m.user_id || null);
    setFormIsChild(m.is_child);
    setFormNachname(m.nachname);
    setFormVorname(m.vorname);
    setFormAnschrift(m.anschrift || "");
    setFormWohneinheit(m.wohneinheit || "");
    setFormEmail(m.email || "");
    setFormTelefon(m.telefon || "");
    setFormHandy(m.handy || "");
    setFormGeburtstag(m.geburtstag || "");
    setFormFotoFile(null);
    setFormFotoPreview(m.foto_url || null);
    const otherParent = [m.parent1_user_id, m.parent2_user_id].find((id) => id && id !== user.id);
    setFormParent2(otherParent || "");
    setFormBereiche(bereicheForMember(m.id));
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

  async function saveBereicheFor(memberId) {
    if (!isAdmin || !memberId) return;
    const current = bereicheForMember(memberId);
    const toAdd = formBereiche.filter((k) => !current.includes(k));
    const toRemove = current.filter((k) => !formBereiche.includes(k));
    if (toAdd.length > 0) {
      await supabase.from("member_bereiche").insert(toAdd.map((bereich_key) => ({ member_id: memberId, bereich_key })));
    }
    for (const key of toRemove) {
      await supabase.from("member_bereiche").delete().eq("member_id", memberId).eq("bereich_key", key);
    }
  }

  async function handleSave() {
    setFormError("");
    if (!formNachname.trim() && !formIsChild) { /* Nachname bei Erwachsenen erwuenscht, aber nicht hart erzwungen falls nur Vorname bekannt */ }
    if (!formVorname.trim()) return setFormError("Bitte einen Vornamen eintragen.");
    if (!formIsChild && !formNachname.trim()) return setFormError("Bitte einen Nachnamen eintragen.");
    setSaving(true);
    try {
      let fotoUrl = editingMember ? editingMember.foto_url : null;
      if (formFotoFile) fotoUrl = await uploadFile(formFotoFile, "mitglied-foto");

      const payload = {
        nachname: formNachname.trim(),
        vorname: formVorname.trim(),
        anschrift: formAnschrift.trim() || null,
        wohneinheit: formWohneinheit.trim() || null,
        email: formEmail.trim() || null,
        telefon: formTelefon.trim() || null,
        handy: formHandy.trim() || null,
        geburtstag: formGeburtstag || null,
        foto_url: fotoUrl,
      };

      let savedId = editingMember?.id || null;

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
        const { data, error } = await supabase.from("members").insert(payload).select().single();
        if (error) throw error;
        savedId = data.id;
      } else {
        const uid = targetSelfUserId || user.id;
        payload.is_child = false;
        payload.created_by = user.id;
        payload.user_id = uid;
        const { data, error } = await supabase.from("members").insert(payload).select().single();
        if (error) throw error;
        savedId = data.id;
      }

      if (isAdmin && !formIsChild && savedId) {
        await saveBereicheFor(savedId);
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
    const header = ["Nachname", "Vorname", "Anschrift", "Wohneinheit", "Email", "Telefon", "Handy", "Geburtstag", "Typ", "Eltern", "Gruppen"];
    const rows = roster.map((m) => [
      m.nachname, m.vorname, m.anschrift || "", m.wohneinheit || "", m.email || "", m.telefon || "", m.handy || "",
      m.geburtstag || "", m.is_child ? "Kind" : "Erwachsen", parentNames(m).join(" / "),
      m.id ? bereicheForMember(m.id).map((k) => bereichInfo(k)?.label || k).join(" / ") : "",
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
      <div className="max-w-3xl mx-auto lg:max-w-none lg:mx-0 lg:px-8">
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
              style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
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
            {isAdmin && (
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

            <div className="mb-3 flex items-center gap-1 p-1 rounded-full w-fit" style={{ backgroundColor: "#E4E1D3" }}>
              {[["mitglieder", "Mitglieder"], ["kinder", "Kinder"], ["alle", "Alle"]].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTypeFilter(key)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: typeFilter === key ? INK : "transparent", color: typeFilter === key ? "#fff" : INK_SOFT }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mb-4 flex items-center justify-between gap-2">
              <button onClick={openNewFlow} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: INK }}>
                <Plus size={14} /> Neuer Eintrag
              </button>
              {isAdmin && (
                <button onClick={exportAllCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                  <Download size={12} /> CSV
                </button>
              )}
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
                const canManage = !m.isPlaceholder && (isAdmin || m.created_by === user.id);
                const canFill = m.isPlaceholder && (isAdmin || m.user_id === user.id);
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
                          <div className="font-bold text-sm truncate">{m.vorname} {m.nachname}</div>
                        </div>
                        <ChevronDown size={14} className={`sm:hidden flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} style={{ color: INK_SOFT }} />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {!m.isPlaceholder && <button onClick={() => exportVCard(m)} title="Als vCard herunterladen"><Download size={14} style={{ color: "#B8B4A2" }} /></button>}
                        {canManage && (
                          <>
                            <button onClick={() => openEditForm(m)}><Pencil size={14} style={{ color: "#B8B4A2" }} /></button>
                            <button onClick={() => handleDelete(m)}><Trash2 size={14} style={{ color: "#B8B4A2" }} /></button>
                          </>
                        )}
                        {canFill && (
                          <button onClick={() => openFillPlaceholder(m)} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#C9752F1A", color: "#C9752F" }}>
                            Ausfüllen
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`${isExpanded ? "block" : "hidden"} sm:block`}>
                      {m.is_child && <div className="text-xs mb-1" style={{ color: INK_SOFT }}>Kind{parents.length > 0 ? ` von ${parents.join(" & ")}` : ""}</div>}
                      {m.isPlaceholder && <div className="text-xs mb-1" style={{ color: "#C9752F" }}>Profil noch nicht ausgefüllt</div>}

                      <div className="flex flex-col gap-1 mt-1 text-xs" style={{ color: INK_SOFT }}>
                        {m.wohneinheit && <div className="flex items-center gap-1.5"><Building2 size={12} /> WE {m.wohneinheit}</div>}
                        {m.anschrift && <div className="flex items-center gap-1.5"><MapPin size={12} /> {m.anschrift}</div>}
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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

      {showAddGroup && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowAddGroup(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg">Neue Gruppe</h2><button onClick={() => setShowAddGroup(false)}><X size={20} /></button></div>
            <label className="text-xs font-medium block mb-1">Name der Gruppe</label>
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

      {profileMember && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setProfileMember(null)}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
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
              <div className="font-bold text-base">{profileMember.vorname} {profileMember.nachname}</div>
              {profileMember.is_child && (
                <div className="text-xs" style={{ color: INK_SOFT }}>
                  Kind{parentNames(profileMember).length > 0 ? ` von ${parentNames(profileMember).join(" & ")}` : ""}
                </div>
              )}
              {profileMember.isPlaceholder && <div className="text-xs" style={{ color: "#C9752F" }}>Profil noch nicht ausgefüllt</div>}
            </div>
            <div className="flex flex-col gap-2 text-sm mb-4" style={{ color: INK_SOFT }}>
              {profileMember.wohneinheit && <div className="flex items-center gap-2"><Building2 size={14} /> WE {profileMember.wohneinheit}</div>}
              {profileMember.anschrift && <div className="flex items-center gap-2"><MapPin size={14} /> {profileMember.anschrift}</div>}
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">{editingMember ? "Eintrag bearbeiten" : formIsChild ? "Kind hinzufügen" : "Eigener Eintrag"}</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>

            <label className="text-xs font-medium block mb-1">Profilbild (optional)</label>
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

            {isAdmin && !formIsChild && (
              <div className="mb-3">
                <label className="text-xs font-medium block mb-1.5">Gruppen (nur für Admins sichtbar/änderbar)</label>
                <div className="flex flex-wrap gap-1.5">
                  {sortedBereiche.map((b) => {
                    const active = formBereiche.includes(b.key);
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => setFormBereiche((prev) => (prev.includes(b.key) ? prev.filter((k) => k !== b.key) : [...prev, b.key]))}
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
