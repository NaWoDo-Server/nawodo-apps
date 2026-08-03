import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search, Gift, Megaphone, Users, Star, BookOpen, BarChart3, LayoutGrid,
  Plus, X, Pencil, Trash2, Loader2, AlertCircle, Home, Paperclip,
  Image as ImageIcon, Archive, Pin, MessageCircle, Send,
} from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";
import { PAPER, INK, INK_SOFT, BORDER, BORDER_SOFT } from "./theme";

const ARCHIVE_DAYS = 30;

// Rubriken kommen jetzt aus der Datenbank (Tabelle "post_types"), damit Admins sie selbst
// verwalten koennen. Die Icons bleiben eine feste, kleine Auswahl (als Text-Key in der DB).
const TYPE_ICON_MAP = {
  search: Search, gift: Gift, megaphone: Megaphone, users: Users, star: Star,
  "book-open": BookOpen, "bar-chart-3": BarChart3, pin: Pin, "layout-grid": LayoutGrid,
};
const TYPE_ICON_KEYS = Object.keys(TYPE_ICON_MAP);
const FALLBACK_TYPE = { key: "gesuch", label: "Beitrag", titleLabel: "Titel", icon: "search", color: "#2E86AB", Icon: Search };
function typeInfo(list, key) {
  const t = (list || []).find((t) => t.key === key);
  return t || (list && list[0]) || FALLBACK_TYPE;
}

function fmtRelative(iso) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays <= 0) return "heute";
  if (diffDays === 1) return "gestern";
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function isArchived(post) {
  const diffDays = (Date.now() - new Date(post.created_at).getTime()) / 86400000;
  return diffDays > ARCHIVE_DAYS;
}
async function uploadFile(file, pathPrefix) {
  const ext = file.name.split(".").pop();
  const path = `${pathPrefix}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB pro Beitrag
const MAX_IMAGE_DIMENSION = 1600; // Titelbilder werden vor dem Hochladen auf max. 1600px verkleinert

// Verkleinert ein hochgeladenes Foto auf dem Geraet des Nutzers (Canvas), bevor es
// hochgeladen wird - spart Speicherplatz und macht die Seite schneller.
function resizeImage(file, maxDim = MAX_IMAGE_DIMENSION, quality = 0.82) {
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
        resolve(new File([blob], "titelbild.jpg", { type: "image/jpeg" }));
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
      .eq("app_key", "pinnwand")
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

  return <PinnwandApp session={session} />;
}

function PinnwandApp({ session }) {
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
  const isSuperAdmin = user.user_metadata?.is_superadmin === true;
  const [myModApps, setMyModApps] = useState([]);
  useEffect(() => {
    supabase.from("app_moderators").select("app_key").eq("user_id", user.id).then(({ data }) => {
      setMyModApps((data || []).map((r) => r.app_key));
    });
  }, [user.id]);
  const isElevated = isAdmin || isSuperAdmin || myModApps.includes("pinnwand");
  const initial = userName.charAt(0).toUpperCase();

  const [posts, setPosts] = useState([]);
  const [postTypesRaw, setPostTypesRaw] = useState([]);
  const [options, setOptions] = useState([]);
  const [votes, setVotes] = useState([]);
  const [pins, setPins] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState(null); // null = Gesamtübersicht
  const [showArchive, setShowArchive] = useState(false);
  const [openCommentIds, setOpenCommentIds] = useState(() => new Set());
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [formType, setFormType] = useState("gesuch");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPriceNote, setFormPriceNote] = useState("");
  const [formIsFree, setFormIsFree] = useState(false);
  const [formPollMode, setFormPollMode] = useState("single");
  const [formPollOptions, setFormPollOptions] = useState(["", ""]);
  const [formImageFile, setFormImageFile] = useState(null);
  const [formImagePreview, setFormImagePreview] = useState(null);
  const [formAttachmentFile, setFormAttachmentFile] = useState(null);
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

  const imageInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [p, pt, o, v, pi, c] = await Promise.all([
      supabase.from("posts").select("*").order("created_at", { ascending: false }),
      supabase.from("post_types").select("*").order("sort_order"),
      supabase.from("poll_options").select("*").order("sort_order"),
      supabase.from("poll_votes").select("*"),
      supabase.from("post_pins").select("*"),
      supabase.from("post_comments").select("*").order("created_at"),
    ]);
    setPosts(p.data || []);
    setPostTypesRaw(pt.data || []);
    setOptions(o.data || []);
    setVotes(v.data || []);
    setPins(pi.data || []);
    setComments(c.data || []);
    setLoading(false);
  }

  function optionsFor(postId) { return options.filter((o) => o.post_id === postId); }
  function votesFor(postId) { return votes.filter((v) => v.post_id === postId); }
  function myVotesFor(postId) { return votesFor(postId).filter((v) => v.user_id === user.id).map((v) => v.option_id); }
  function commentsFor(postId) { return comments.filter((c) => c.post_id === postId); }
  const pinnedIds = useMemo(() => new Set(pins.filter((p) => p.user_id === user.id).map((p) => p.post_id)), [pins, user.id]);

  const postTypes = useMemo(
    () => postTypesRaw.map((t) => ({ ...t, titleLabel: t.title_label, Icon: TYPE_ICON_MAP[t.icon] || Search })),
    [postTypesRaw]
  );

  async function handleAddPostType(label, icon) {
    if (!label.trim()) return;
    const key = label.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `rubrik_${Date.now()}`;
    const palette = ["#2E86AB", "#6C63A6", "#B54A45", "#C9A227", "#1F6F5C", "#C9752F", "#3E8E7E"];
    const color = palette[postTypesRaw.length % palette.length];
    try {
      const { error } = await supabase.from("post_types").insert({
        key, label: label.trim(), title_label: `Titel: ${label.trim()}`, icon: icon || "search",
        color, sort_order: postTypesRaw.length,
      });
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message || "Rubrik konnte nicht angelegt werden.");
    }
  }

  async function handleRenamePostType(key, label) {
    if (!label.trim()) return;
    try {
      const { error } = await supabase.from("post_types").update({ label: label.trim() }).eq("key", key);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message || "Konnte nicht umbenannt werden.");
    }
  }

  async function handleDeletePostType(key, label) {
    if (!window.confirm(`Rubrik "${label}" wirklich löschen?`)) return;
    try {
      const { error } = await supabase.from("post_types").delete().eq("key", key);
      if (error) throw error;
      await loadAll();
    } catch (e) {
      alert(e.message || "Rubrik konnte nicht gelöscht werden - vermutlich gibt es noch Beiträge in dieser Rubrik.");
    }
  }

  function toggleComments(id) {
    setOpenCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function togglePin(post) {
    const existing = pins.find((p) => p.post_id === post.id && p.user_id === user.id);
    try {
      if (existing) {
        await supabase.from("post_pins").delete().eq("id", existing.id);
      } else {
        await supabase.from("post_pins").insert({ post_id: post.id, user_id: user.id });
      }
      await loadAll();
    } catch {}
  }

  async function addComment(post, body) {
    if (!body.trim()) return;
    try {
      await supabase.from("post_comments").insert({ post_id: post.id, user_id: user.id, user_name: userName, body: body.trim() });
      await loadAll();
    } catch {}
  }

  async function deleteComment(comment) {
    try {
      await supabase.from("post_comments").delete().eq("id", comment.id);
      await loadAll();
    } catch {}
  }

  const q = search.trim().toLowerCase();
  const visiblePosts = useMemo(() => {
    const filtered = posts
      .filter((p) => activeFilter === null || p.type === activeFilter)
      .filter((p) => (showArchive ? isArchived(p) : !isArchived(p)))
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    return filtered.slice().sort((a, b) => {
      const aPin = pinnedIds.has(a.id), bPin = pinnedIds.has(b.id);
      if (aPin !== bPin) return aPin ? -1 : 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }, [posts, activeFilter, showArchive, q, pinnedIds]);

  function resetForm() {
    setFormType(postTypes[0]?.key || "gesuch");
    setFormTitle("");
    setFormDescription("");
    setFormPriceNote("");
    setFormIsFree(false);
    setFormPollMode("single");
    setFormPollOptions(["", ""]);
    setFormImageFile(null);
    setFormImagePreview(null);
    setFormAttachmentFile(null);
    setFormError("");
  }

  function openNewForm() {
    resetForm();
    setEditingPost(null);
    setShowForm(true);
  }

  function openEditForm(post) {
    setEditingPost(post);
    setFormType(post.type);
    setFormTitle(post.title);
    setFormDescription(post.description);
    setFormPriceNote(post.price_note || "");
    setFormIsFree(!!post.is_free);
    setFormPollMode(post.poll_mode || "single");
    setFormPollOptions(optionsFor(post.id).map((o) => o.label));
    setFormImageFile(null);
    setFormImagePreview(post.image_url || null);
    setFormAttachmentFile(null);
    setFormError("");
    setShowForm(true);
  }

  function updatePollOption(idx, value) {
    setFormPollOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }
  function addPollOption() { setFormPollOptions((prev) => [...prev, ""]); }
  function removePollOption(idx) { setFormPollOptions((prev) => prev.filter((_, i) => i !== idx)); }

  async function onImageSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormImagePreview(URL.createObjectURL(file));
    try {
      const resized = await resizeImage(file);
      setFormImageFile(resized);
    } catch {
      setFormImageFile(file); // falls Verkleinern fehlschlaegt: Original hochladen
    }
  }

  function onAttachmentSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFormError("Die Datei ist größer als 50 MB. Bitte eine kleinere Datei anhängen.");
      e.target.value = "";
      return;
    }
    setFormError("");
    setFormAttachmentFile(file);
  }

  async function handleSave() {
    setFormError("");
    if (!formTitle.trim()) return setFormError("Bitte einen Titel eintragen.");
    if (!formDescription.trim()) return setFormError("Bitte eine Beschreibung eintragen.");
    let pollOptionsClean = [];
    if (formType === "umfrage" && !editingPost) {
      pollOptionsClean = formPollOptions.map((o) => o.trim()).filter(Boolean);
      if (pollOptionsClean.length < 2) return setFormError("Bitte mindestens 2 Antwortmöglichkeiten eintragen.");
    }
    setSaving(true);
    try {
      let imageUrl = editingPost ? editingPost.image_url : null;
      if (formImageFile) imageUrl = await uploadFile(formImageFile, "pinnwand-bild");
      let attachmentUrl = editingPost ? editingPost.attachment_url : null;
      let attachmentName = editingPost ? editingPost.attachment_name : null;
      if (formAttachmentFile) {
        attachmentUrl = await uploadFile(formAttachmentFile, "pinnwand-anhang");
        attachmentName = formAttachmentFile.name;
      }
      const payload = {
        type: formType,
        title: formTitle.trim(),
        description: formDescription.trim(),
        image_url: imageUrl,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        price_note: formType === "angebot" && !formIsFree ? (formPriceNote.trim() || null) : null,
        is_free: formType === "angebot" ? formIsFree : false,
        poll_mode: formType === "umfrage" ? formPollMode : null,
      };
      if (editingPost) {
        const { error } = await supabase.from("posts").update(payload).eq("id", editingPost.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("posts").insert({ ...payload, created_by: user.id, created_by_name: userName }).select().single();
        if (error) throw error;
        if (formType === "umfrage" && pollOptionsClean.length > 0) {
          const rows = pollOptionsClean.map((label, i) => ({ post_id: data.id, label, sort_order: i }));
          const { error: optErr } = await supabase.from("poll_options").insert(rows);
          if (optErr) throw optErr;
        }
      }
      setShowForm(false);
      setEditingPost(null);
      await loadAll();
    } catch (e) {
      setFormError(e.message || "Speichern hat nicht geklappt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(post) {
    if (!window.confirm(`"${post.title}" wirklich löschen?`)) return;
    try {
      await supabase.from("posts").delete().eq("id", post.id);
      await loadAll();
    } catch {}
  }

  async function handleVote(post, selectedOptionIds) {
    try {
      await supabase.from("poll_votes").delete().eq("post_id", post.id).eq("user_id", user.id);
      if (selectedOptionIds.length > 0) {
        const rows = selectedOptionIds.map((option_id) => ({ post_id: post.id, option_id, user_id: user.id }));
        await supabase.from("poll_votes").insert(rows);
      }
      await loadAll();
    } catch {}
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
      <div className="max-w-3xl mx-auto lg:max-w-none lg:w-2/3 lg:mx-auto">
        <div className="px-4 pt-6 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/pinnwand/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
            <h1 className="font-bold text-lg lg:text-2xl">Pinnwand</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>{ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}</button>
          </div>
        </div>

        <div className="flex items-start gap-3 px-4">
          {/* Icon-Leiste links: fungiert als Filter, oben die Gesamtübersicht */}
          <div className="flex flex-col items-center gap-2.5 flex-shrink-0 pt-1">
            <button
              onClick={() => setActiveFilter(null)}
              title="Gesamtübersicht"
              className="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0"
              style={{ backgroundColor: INK, opacity: activeFilter === null ? 1 : 0.55, boxShadow: activeFilter === null ? "0 0 0 3px #fff, 0 0 0 5px " + INK : "none" }}
            >
              <LayoutGrid size={18} />
            </button>
            {postTypes.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveFilter(t.key)}
                title={t.label}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: t.color, opacity: activeFilter === t.key ? 1 : 0.55, boxShadow: activeFilter === t.key ? `0 0 0 3px #fff, 0 0 0 5px ${t.color}` : "none" }}
              >
                <t.Icon size={18} />
              </button>
            ))}
          </div>

          {/* Beiträge */}
          <div className="flex-1 min-w-0">
            <div className="mb-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: INK_SOFT }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Beiträge durchsuchen…"
                  className="w-full rounded-full pl-9 pr-3 py-2.5 text-sm border"
                  style={{ borderColor: "#D8D5C7", backgroundColor: "#fff" }}
                />
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={openNewForm}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: "#C9752F" }}
              >
                <Plus size={14} /> Neuer Beitrag
              </button>
              <button
                onClick={() => setShowArchive((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: showArchive ? INK : "transparent", color: showArchive ? "#fff" : INK_SOFT, border: `1.5px solid ${showArchive ? INK : BORDER_SOFT}` }}
              >
                <Archive size={12} /> Archiv
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {visiblePosts.length === 0 && (
                <div className="text-center py-10 rounded-xl" style={{ backgroundColor: "#E9E6D9" }}>
                  <p className="text-sm" style={{ color: INK_SOFT }}>{showArchive ? "Keine archivierten Beiträge." : "Noch keine Beiträge."}</p>
                </div>
              )}
              {visiblePosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  postTypes={postTypes}
                  isAdmin={isElevated}
                  ownUserId={user.id}
                  options={optionsFor(post.id)}
                  allVotes={votesFor(post.id)}
                  myVotes={myVotesFor(post.id)}
                  pinned={pinnedIds.has(post.id)}
                  onTogglePin={() => togglePin(post)}
                  postComments={commentsFor(post.id)}
                  commentsOpen={openCommentIds.has(post.id)}
                  onToggleComments={() => toggleComments(post.id)}
                  onAddComment={(body) => addComment(post, body)}
                  onDeleteComment={deleteComment}
                  onImageClick={() => setLightboxUrl(post.image_url)}
                  onEdit={() => openEditForm(post)}
                  onDelete={() => handleDelete(post)}
                  onVote={(ids) => handleVote(post, ids)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {lightboxUrl && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4" style={{ backgroundColor: "rgba(0,0,0,0.85)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setLightboxUrl(null); } }}>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-lg object-contain" />
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}><X size={20} /></button>
        </div>
      )}

      {showForm && (
        <PostForm
          editingPost={editingPost}
          postTypes={postTypes}
          isAdmin={isElevated}
          onAddType={handleAddPostType}
          onRenameType={handleRenamePostType}
          onDeleteType={handleDeletePostType}
          formType={formType} setFormType={setFormType}
          formTitle={formTitle} setFormTitle={setFormTitle}
          formDescription={formDescription} setFormDescription={setFormDescription}
          formPriceNote={formPriceNote} setFormPriceNote={setFormPriceNote}
          formIsFree={formIsFree} setFormIsFree={setFormIsFree}
          formPollMode={formPollMode} setFormPollMode={setFormPollMode}
          formPollOptions={formPollOptions}
          updatePollOption={updatePollOption} addPollOption={addPollOption} removePollOption={removePollOption}
          formImagePreview={formImagePreview} onImageSelected={onImageSelected} imageInputRef={imageInputRef}
          formAttachmentFile={formAttachmentFile} onAttachmentSelected={onAttachmentSelected} attachmentInputRef={attachmentInputRef}
          formError={formError} saving={saving}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingPost(null); }}
        />
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

function PostCard({
  post, postTypes, isAdmin, ownUserId, options, allVotes, myVotes, pinned, onTogglePin,
  postComments, commentsOpen, onToggleComments, onAddComment, onDeleteComment,
  onImageClick, onEdit, onDelete, onVote,
}) {
  const info = typeInfo(postTypes, post.type);
  const canManage = isAdmin || post.created_by === ownUserId;
  const archived = isArchived(post);
  const [commentDraft, setCommentDraft] = useState("");

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
      {post.image_url && (
        <button onClick={onImageClick} className="block w-full">
          <img src={post.image_url} alt="" className="w-full h-40 object-cover" />
        </button>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: info.color }}>
            <info.Icon size={11} /> {info.label}
          </span>
          <div className="flex items-center gap-2">
            {archived && <span className="text-xs flex items-center gap-1" style={{ color: INK_SOFT }}><Archive size={11} /> archiviert</span>}
            <button onClick={onTogglePin} title={pinned ? "Nicht mehr anpinnen" : "Anpinnen"}>
              <Pin size={14} style={{ color: pinned ? info.color : "#B8B4A2" }} fill={pinned ? info.color : "none"} />
            </button>
            {canManage && (
              <>
                <button onClick={onEdit}><Pencil size={14} style={{ color: "#B8B4A2" }} /></button>
                <button onClick={onDelete}><Trash2 size={14} style={{ color: "#B8B4A2" }} /></button>
              </>
            )}
          </div>
        </div>

        <h3 className="font-bold text-base mb-1">{post.title}</h3>

        {post.type === "angebot" && (post.is_free || post.price_note) && (
          <span className="inline-block mb-2 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "#E9E6D9", color: INK }}>
            {post.is_free ? "Zu verschenken" : post.price_note}
          </span>
        )}

        <p className="text-sm mb-2 whitespace-pre-wrap" style={{ color: INK_SOFT }}>{post.description}</p>

        {post.type === "umfrage" && (
          <PollWidget post={post} options={options} allVotes={allVotes} myVotes={myVotes} onVote={onVote} color={info.color} />
        )}

        {post.attachment_url && (
          <a href={post.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 mt-2 text-xs font-semibold" style={{ color: info.color }}>
            <Paperclip size={12} /> {post.attachment_name || "Anhang öffnen"}
          </a>
        )}

        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid #F1F0EA" }}>
          <span className="text-xs font-medium">{post.created_by_name}</span>
          <span className="text-xs" style={{ color: INK_SOFT }}>{fmtRelative(post.created_at)}</span>
        </div>

        <button onClick={onToggleComments} className="flex items-center gap-1.5 mt-2 text-xs font-semibold" style={{ color: INK_SOFT }}>
          <MessageCircle size={13} /> {postComments.length > 0 ? `${postComments.length} Frage${postComments.length === 1 ? "" : "n"}` : "Frage stellen"}
        </button>

        {commentsOpen && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid #F1F0EA" }}>
            <div className="flex flex-col gap-2 mb-2">
              {postComments.map((c) => (
                <div key={c.id} className="text-xs rounded-lg px-2.5 py-2" style={{ backgroundColor: "#F1F0EA" }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold">{c.user_name}</span>
                    <div className="flex items-center gap-2">
                      <span style={{ color: INK_SOFT }}>{fmtRelative(c.created_at)}</span>
                      {(isAdmin || c.user_id === ownUserId) && (
                        <button onClick={() => onDeleteComment(c)}><X size={11} style={{ color: "#B8B4A2" }} /></button>
                      )}
                    </div>
                  </div>
                  <div>{c.body}</div>
                </div>
              ))}
              {postComments.length === 0 && <p className="text-xs" style={{ color: INK_SOFT }}>Noch keine Fragen.</p>}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && commentDraft.trim()) { onAddComment(commentDraft); setCommentDraft(""); } }}
                placeholder="Frage stellen…"
                className="flex-1 rounded-lg px-3 py-2 text-xs border"
                style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
              />
              <button
                onClick={() => { if (commentDraft.trim()) { onAddComment(commentDraft); setCommentDraft(""); } }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                style={{ backgroundColor: info.color }}
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PollWidget({ post, options, allVotes, myVotes, onVote, color }) {
  const [selected, setSelected] = useState(myVotes);
  useEffect(() => { setSelected(myVotes); }, [myVotes.join(",")]);

  const totalVoters = new Set(allVotes.map((v) => v.user_id)).size;
  const countFor = (optId) => allVotes.filter((v) => v.option_id === optId).length;
  const changed = selected.slice().sort().join(",") !== myVotes.slice().sort().join(",");

  function toggleOption(id) {
    if (post.poll_mode === "multiple") {
      setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setSelected((prev) => (prev.includes(id) ? [] : [id]));
    }
  }

  return (
    <div className="mb-2">
      <div className="flex flex-col gap-1.5 mb-2">
        {options.map((opt) => {
          const count = countFor(opt.id);
          const pct = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggleOption(opt.id)}
              className="relative w-full text-left rounded-lg px-3 py-2 text-sm overflow-hidden"
              style={{ border: `1.5px solid ${isSelected ? color : BORDER_SOFT}`, backgroundColor: "#fff" }}
            >
              <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, backgroundColor: `${color}22` }} />
              <div className="relative flex items-center justify-between">
                <span className="font-medium">{opt.label}</span>
                <span className="text-xs" style={{ color: INK_SOFT }}>{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: INK_SOFT }}>{totalVoters} {totalVoters === 1 ? "Stimme" : "Stimmen"} · {post.poll_mode === "multiple" ? "Mehrfachauswahl" : "Einfache Auswahl"}</span>
        {changed && (
          <button onClick={() => onVote(selected)} className="text-xs font-semibold px-3 py-1.5 rounded-full text-white" style={{ backgroundColor: color }}>
            {myVotes.length > 0 ? "Ändern" : "Abstimmen"}
          </button>
        )}
      </div>
    </div>
  );
}

function PostForm({
  editingPost, postTypes, isAdmin, onAddType, onRenameType, onDeleteType,
  formType, setFormType, formTitle, setFormTitle, formDescription, setFormDescription,
  formPriceNote, setFormPriceNote, formIsFree, setFormIsFree, formPollMode, setFormPollMode,
  formPollOptions, updatePollOption, addPollOption, removePollOption,
  formImagePreview, onImageSelected, imageInputRef,
  formAttachmentFile, onAttachmentSelected, attachmentInputRef,
  formError, saving, onSave, onClose,
}) {
  const info = typeInfo(postTypes, formType);
  const isEditing = !!editingPost;
  const [manageTypes, setManageTypes] = useState(false);
  const [typeRenameKey, setTypeRenameKey] = useState(null);
  const [typeRenameLabel, setTypeRenameLabel] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newTypeIcon, setNewTypeIcon] = useState("search");

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { onClose(); } }}>
      <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">{isEditing ? "Beitrag bearbeiten" : "Neuer Beitrag"}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium block" style={{ color: INK_SOFT }}>Art des Beitrags</label>
          {isAdmin && !isEditing && (
            <button type="button" onClick={() => setManageTypes((v) => !v)} className="text-[11px] font-semibold underline" style={{ color: INK_SOFT }}>
              {manageTypes ? "Fertig" : "Rubriken verwalten"}
            </button>
          )}
        </div>
        {manageTypes ? (
          <div className="mb-4 flex flex-col gap-1.5">
            {postTypes.map((t) => (
              <div key={t.key} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                {typeRenameKey === t.key ? (
                  <input
                    autoFocus
                    value={typeRenameLabel}
                    onChange={(e) => setTypeRenameLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (onRenameType(t.key, typeRenameLabel), setTypeRenameKey(null))}
                    onBlur={() => { onRenameType(t.key, typeRenameLabel); setTypeRenameKey(null); }}
                    className="flex-1 rounded-lg px-2 py-1 text-xs border"
                    style={{ borderColor: BORDER_SOFT }}
                  />
                ) : (
                  <button type="button" onClick={() => { setTypeRenameKey(t.key); setTypeRenameLabel(t.label); }} className="flex-1 text-left text-xs font-medium">{t.label}</button>
                )}
                <button type="button" onClick={() => onDeleteType(t.key, t.label)}><Trash2 size={13} style={{ color: "#B8B4A2" }} /></button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1">
              <select value={newTypeIcon} onChange={(e) => setNewTypeIcon(e.target.value)} className="rounded-lg px-1.5 py-1.5 text-xs border" style={{ borderColor: BORDER_SOFT }}>
                {TYPE_ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <input
                value={newTypeLabel}
                onChange={(e) => setNewTypeLabel(e.target.value)}
                placeholder="Neue Rubrik…"
                className="flex-1 rounded-lg px-2 py-1.5 text-xs border"
                style={{ borderColor: BORDER_SOFT }}
              />
              <button
                type="button"
                onClick={() => { onAddType(newTypeLabel, newTypeIcon); setNewTypeLabel(""); }}
                disabled={!newTypeLabel.trim()}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: INK, opacity: !newTypeLabel.trim() ? 0.6 : 1 }}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mb-4 flex-wrap">
            {postTypes.map((t) => (
              <button
                key={t.key}
                disabled={isEditing}
                onClick={() => setFormType(t.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: formType === t.key ? t.color : "transparent",
                  color: formType === t.key ? "#fff" : INK,
                  border: `1.5px solid ${formType === t.key ? t.color : BORDER_SOFT}`,
                  opacity: isEditing && formType !== t.key ? 0.4 : 1,
                }}
              >
                <t.Icon size={12} /> {t.label}
              </button>
            ))}
          </div>
        )}

        <label className="text-xs font-medium block mb-1">Titelbild (optional)</label>
        <div className="mb-3">
          {formImagePreview ? (
            <div className="relative mb-1.5">
              <img src={formImagePreview} alt="" className="w-full h-32 object-cover rounded-lg" />
              <button onClick={() => imageInputRef.current?.click()} className="absolute bottom-2 right-2 text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: INK }}>Ändern</button>
            </div>
          ) : (
            <button onClick={() => imageInputRef.current?.click()} className="w-full py-4 rounded-lg text-xs font-semibold flex items-center justify-center gap-2" style={{ border: `1.5px dashed ${BORDER_SOFT}`, color: INK_SOFT }}>
              <ImageIcon size={14} /> Bild hochladen
            </button>
          )}
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={onImageSelected} />
        </div>

        <label className="text-xs font-medium block mb-1">{info.titleLabel}</label>
        <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Titel eintragen" className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

        {formType === "angebot" && (
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1">Gewünschte Geldleistung (optional)</label>
            <input
              value={formPriceNote}
              onChange={(e) => setFormPriceNote(e.target.value)}
              disabled={formIsFree}
              placeholder="z.B. 20€ VB"
              className="w-full rounded-lg px-3 py-2.5 mb-1.5 text-sm border"
              style={{ borderColor: BORDER_SOFT, backgroundColor: formIsFree ? "#EFEEE7" : "#fff" }}
            />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={formIsFree} onChange={(e) => setFormIsFree(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm font-medium">Zu verschenken</span>
            </label>
          </div>
        )}

        <label className="text-xs font-medium block mb-1">Beschreibung</label>
        <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Beschreibung…" rows={4} className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />

        {formType === "umfrage" && !isEditing && (
          <div className="mb-3">
            <label className="text-xs font-medium block mb-1.5">Abstimmung</label>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setFormPollMode("single")} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: formPollMode === "single" ? info.color : "transparent", color: formPollMode === "single" ? "#fff" : INK, border: `1.5px solid ${formPollMode === "single" ? info.color : BORDER_SOFT}` }}>Einfache Auswahl</button>
              <button onClick={() => setFormPollMode("multiple")} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ backgroundColor: formPollMode === "multiple" ? info.color : "transparent", color: formPollMode === "multiple" ? "#fff" : INK, border: `1.5px solid ${formPollMode === "multiple" ? info.color : BORDER_SOFT}` }}>Mehrfachauswahl</button>
            </div>
            <label className="text-xs font-medium block mb-1.5">Antwortmöglichkeiten</label>
            <div className="flex flex-col gap-2 mb-2">
              {formPollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input value={opt} onChange={(e) => updatePollOption(idx, e.target.value)} placeholder={`Option ${idx + 1}`} className="flex-1 rounded-lg px-3 py-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
                  {formPollOptions.length > 2 && (
                    <button onClick={() => removePollOption(idx)}><X size={16} style={{ color: "#B8B4A2" }} /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addPollOption} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ border: `1.5px dashed ${BORDER_SOFT}`, color: INK_SOFT }}>+ Option hinzufügen</button>
          </div>
        )}
        {formType === "umfrage" && isEditing && (
          <p className="text-xs mb-3" style={{ color: INK_SOFT }}>Die Antwortmöglichkeiten lassen sich nach dem Anlegen nicht mehr ändern (wegen bereits abgegebener Stimmen).</p>
        )}

        <label className="text-xs font-medium block mb-1">Dateianhang (optional)</label>
        <div className="mb-3">
          <button onClick={() => attachmentInputRef.current?.click()} className="w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2" style={{ border: `1.5px dashed ${BORDER_SOFT}`, color: INK_SOFT }}>
            <Paperclip size={13} /> {formAttachmentFile ? formAttachmentFile.name : "Datei anhängen"}
          </button>
          <input ref={attachmentInputRef} type="file" className="hidden" onChange={onAttachmentSelected} />
          <p className="text-xs mt-1" style={{ color: INK_SOFT }}>Maximal 50 MB pro Datei.</p>
        </div>

        {formError && <div className="flex items-start gap-2 text-sm mb-3 px-1" style={{ color: "#A13D3D" }}><AlertCircle size={15} className="mt-0.5 flex-shrink-0" /> {formError}</div>}

        <button
          onClick={onSave}
          disabled={saving}
          className="w-full rounded-lg py-3 font-semibold text-sm text-white flex items-center justify-center gap-2"
          style={{ backgroundColor: info.color, opacity: saving ? 0.7 : 1 }}
        >
          {saving && <Loader2 size={15} className="animate-spin" />} {saving ? "Speichern…" : isEditing ? "Speichern" : "Veröffentlichen"}
        </button>
      </div>
    </div>
  );
}
