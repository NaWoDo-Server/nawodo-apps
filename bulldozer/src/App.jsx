import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from "react";
import {
  Home, Loader2, AlertCircle, X, Pencil, RotateCcw, Undo2, Trophy,
  ChevronLeft, ChevronUp, ChevronDown, ChevronRight, KeyRound,
} from "lucide-react";
import { supabase, configMissing, BUCKET } from "./supabaseClient";
import { LEVELS, levelCode, findLevelIndexByCode } from "./levels.js";

const PAPER = "#F1F0EA";
const INK = "#2B2B26";
const INK_SOFT = "#6B6A61";
const BORDER_SOFT = "#D8D5C7";
const ORANGE = "#C9752F";
const LIGHT_GRAY = "#B7B4A5";
const GREEN = "#2E7D4F";
const TEAL = "#3E8E7E";

// --- Spiel-Engine (reine Funktionen, kein React) -----------------------

function parseLevel(level) {
  const rows = level.rows;
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const walls = new Set();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x] || "#";
      if (ch === "#") walls.add(`${x},${y}`);
    }
  }
  const targets = new Set(level.targets.map(([x, y]) => `${x},${y}`));
  return { width, height, walls, targets };
}

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

function tryMove(parsed, state, dir) {
  const [dx, dy] = DIRS[dir];
  const [px, py] = state.player;
  const nx = px + dx, ny = py + dy;
  const nKey = `${nx},${ny}`;
  if (parsed.walls.has(nKey)) return null;
  if (state.boxes.has(nKey)) {
    const bx = nx + dx, by = ny + dy;
    const bKey = `${bx},${by}`;
    if (parsed.walls.has(bKey) || state.boxes.has(bKey)) return null;
    const newBoxes = new Set(state.boxes);
    newBoxes.delete(nKey);
    newBoxes.add(bKey);
    return { player: [nx, ny], boxes: newBoxes, pushed: true };
  }
  return { player: [nx, ny], boxes: state.boxes, pushed: false };
}

function isWin(parsed, boxes) {
  for (const t of parsed.targets) if (!boxes.has(t)) return false;
  return true;
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function LevelPreview({ level, cellSize = 8 }) {
  const parsed = parseLevel(level);
  const boxSet = new Set(level.boxes.map(([x, y]) => `${x},${y}`));
  const [px, py] = level.player;
  const w = parsed.width * cellSize;
  const h = parsed.height * cellSize;
  const rects = [];
  for (let y = 0; y < parsed.height; y++) {
    for (let x = 0; x < parsed.width; x++) {
      const isWall = parsed.walls.has(`${x},${y}`);
      rects.push(
        <rect
          key={`c${x},${y}`}
          x={x * cellSize}
          y={y * cellSize}
          width={cellSize}
          height={cellSize}
          fill={isWall ? "#8A8874" : "#808000"}
        />
      );
    }
  }
  const marks = [];
  for (const [x, y] of level.targets) {
    marks.push(
      <circle
        key={`t${x},${y}`}
        cx={x * cellSize + cellSize / 2}
        cy={y * cellSize + cellSize / 2}
        r={cellSize * 0.32}
        fill="none"
        stroke="#D34E4E"
        strokeWidth={Math.max(1, cellSize * 0.12)}
      />
    );
  }
  for (const key of boxSet) {
    const [x, y] = key.split(",").map(Number);
    marks.push(
      <circle
        key={`b${x},${y}`}
        cx={x * cellSize + cellSize / 2}
        cy={y * cellSize + cellSize / 2}
        r={cellSize * 0.4}
        fill="#B7B4A5"
        stroke="#2B2B26"
        strokeWidth={Math.max(0.5, cellSize * 0.06)}
      />
    );
  }
  marks.push(
    <rect
      key="player"
      x={px * cellSize + cellSize * 0.18}
      y={py * cellSize + cellSize * 0.18}
      width={cellSize * 0.64}
      height={cellSize * 0.64}
      fill="#E6B800"
      stroke="#A13D3D"
      strokeWidth={Math.max(0.5, cellSize * 0.08)}
    />
  );
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", imageRendering: "pixelated" }}>
      {rects}
      {marks}
    </svg>
  );
}

// --- Auth / Zugriff (gleiches Muster wie in den anderen Apps) ----------

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) window.location.href = "/";
  }, [session]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("member_permissions")
      .select("allowed")
      .eq("user_id", session.user.id)
      .eq("app_key", "bulldozer")
      .maybeSingle()
      .then(({ data }) => setAccess(!data || data.allowed !== false))
      .catch(() => setAccess(true));
  }, [session]);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("app_settings")
      .select("value")
      .eq("key", "app_enabled_bulldozer")
      .maybeSingle()
      .then(({ data }) => setAppEnabled(!data || data.value !== false))
      .catch(() => setAppEnabled(true));
  }, [session]);

  if (session === undefined || session === null || access === undefined || appEnabled === undefined) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAPER }}><Loader2 className="animate-spin" size={28} style={{ color: INK_SOFT }} /></div>;
  }

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

  return <BulldozerApp session={session} />;
}

// --- Hauptkomponente -----------------------------------------------------

function BulldozerApp({ session }) {
  const user = session.user;
  const userName = user.user_metadata?.name || user.email;
  const initial = userName.charAt(0).toUpperCase();
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

  const [showAccount, setShowAccount] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showLevelTable, setShowLevelTable] = useState(false);
  const [previewLevelIdx, setPreviewLevelIdx] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  // --- Spielstand / Bildschirme ---

  const [screen, setScreen] = useState("select"); // "select" | "game" | "leaderboard"
  const [levelIndex, setLevelIndex] = useState(0);
  const [gameState, setGameState] = useState(null); // { player:[x,y], boxes:Set<string> }
  const [history, setHistory] = useState([]);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [won, setWon] = useState(false);
  const [facing, setFacing] = useState("right");
  const [saveError, setSaveError] = useState("");

  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");

  const [scores, setScores] = useState([]);
  const [members, setMembers] = useState([]);
  const [loadingScores, setLoadingScores] = useState(true);

  useEffect(() => { loadScores(); }, []);

  async function loadScores() {
    const [{ data: sc }, { data: mem }] = await Promise.all([
      supabase.from("bulldozer_scores").select("*"),
      supabase.from("members").select("user_id, vorname, nachname"),
    ]);
    setScores(sc || []);
    setMembers(mem || []);
    setLoadingScores(false);
  }

  function nameFor(uid) {
    if (uid === user.id) return `${userName} (du)`;
    const m = members.find((mm) => mm.user_id === uid);
    if (!m) return "Unbekannt";
    return [m.vorname, m.nachname].filter(Boolean).join(" ").trim() || "Unbekannt";
  }

  const ownSolvedIndices = useMemo(() => scores.filter((s) => s.user_id === user.id).map((s) => s.level_index), [scores, user.id]);
  const highestSolved = ownSolvedIndices.length ? Math.max(...ownSolvedIndices) : -1;
  const allSolved = highestSolved >= LEVELS.length - 1;
  const continueIndex = Math.min(highestSolved + 1, LEVELS.length - 1);

  const level = LEVELS[levelIndex];
  const parsed = useMemo(() => parseLevel(level), [levelIndex]);

  const gridWrapRef = useRef(null);
  const controlsRef = useRef(null);
  const [cellSize, setCellSize] = useState(36);

  useLayoutEffect(() => {
    if (screen !== "game") return;
    function recompute() {
      const wrap = gridWrapRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      const controlsHeight = controlsRef.current ? controlsRef.current.getBoundingClientRect().height : 0;
      const availableWidth = wrap.clientWidth;
      const availableHeight = window.innerHeight - wrapRect.top - controlsHeight - 16;
      const maxByWidth = Math.floor(availableWidth / parsed.width);
      const maxByHeight = Math.floor(availableHeight / parsed.height);
      const maxCap = window.innerWidth >= 1024 ? 78 : 46;
      const next = Math.max(14, Math.min(maxCap, maxByWidth, maxByHeight));
      if (Number.isFinite(next) && next > 0) setCellSize(next);
    }
    recompute();
    window.addEventListener("resize", recompute);
    window.addEventListener("orientationchange", recompute);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("orientationchange", recompute);
    };
  }, [screen, parsed.width, parsed.height]);

  // Spielflaeche horizontal zentrieren, statt links stehen zu lassen. Faengt vor allem den
  // Fall ab, dass beim Levelwechsel eine alte Scroll-Position vom vorherigen (breiteren)
  // Level uebrig bleibt und das Feld dadurch verschoben wirkt.
  useLayoutEffect(() => {
    if (screen !== "game") return;
    const wrap = gridWrapRef.current;
    if (!wrap) return;
    wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
  }, [screen, cellSize, parsed.width, parsed.height, levelIndex]);

  function ownScoreFor(idx) {
    return scores.find((s) => s.user_id === user.id && s.level_index === idx) || null;
  }

  function startLevel(idx) {
    const lvl = LEVELS[idx];
    setLevelIndex(idx);
    setGameState({ player: lvl.player, boxes: new Set(lvl.boxes.map(([x, y]) => `${x},${y}`)) });
    setHistory([]);
    setMoves(0);
    setStartedAt(Date.now());
    setElapsedMs(0);
    setWon(false);
    setFacing("right");
    setSaveError("");
    setScreen("game");
  }

  function restart() {
    startLevel(levelIndex);
  }

  useEffect(() => {
    if (screen !== "game" || won || !startedAt) return;
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => clearInterval(id);
  }, [screen, won, startedAt]);

  async function saveScore(idx, timeMs, movesCount) {
    setSaveError("");
    try {
      const existing = ownScoreFor(idx);
      const bestTime = existing ? Math.min(existing.best_time_ms, timeMs) : timeMs;
      const bestMoves = existing ? Math.min(existing.best_moves, movesCount) : movesCount;
      const { error } = await supabase.from("bulldozer_scores").upsert(
        { user_id: user.id, level_index: idx, best_time_ms: bestTime, best_moves: bestMoves },
        { onConflict: "user_id,level_index" }
      );
      if (error) throw error;
      await loadScores();
    } catch (e) {
      setSaveError(e.message || "Ergebnis konnte nicht gespeichert werden.");
    }
  }

  const move = useCallback((dir) => {
    if (!gameState || won) return;
    const next = tryMove(parsed, gameState, dir);
    if (!next) return;
    const newMoves = moves + 1;
    setHistory((h) => [...h, gameState]);
    setMoves(newMoves);
    setGameState(next);
    setFacing(dir);
    if (isWin(parsed, next.boxes)) {
      const finalTime = startedAt ? Date.now() - startedAt : elapsedMs;
      setElapsedMs(finalTime);
      setWon(true);
      saveScore(levelIndex, finalTime, newMoves);
    }
  }, [gameState, won, parsed, startedAt, moves, elapsedMs, levelIndex]);

  useEffect(() => {
    if (screen !== "game") return;
    function onKey(e) {
      const map = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        if (!won) move(dir);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, won, move]);

  function undo() {
    if (won || history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setGameState(prev);
    setMoves((m) => Math.max(0, m - 1));
  }

  function jumpToCode() {
    setCodeError("");
    const idx = findLevelIndexByCode(codeInput);
    if (idx === -1) {
      setCodeError("Code nicht gefunden.");
      return;
    }
    setCodeInput("");
    startLevel(idx);
  }

  const overallRanking = useMemo(() => {
    const byUser = {};
    scores.forEach((s) => {
      if (!byUser[s.user_id]) byUser[s.user_id] = { user_id: s.user_id, levelsSolved: 0, totalTimeMs: 0 };
      byUser[s.user_id].levelsSolved += 1;
      byUser[s.user_id].totalTimeMs += s.best_time_ms;
    });
    return Object.values(byUser).sort((a, b) => b.levelsSolved - a.levelsSolved || a.totalTimeMs - b.totalTimeMs);
  }, [scores]);

  // --- Rendering ---

  const cellPx = `${cellSize}px`;

  // Eigenes Sprite-Sheet (von Lars beigesteuert, Weston Campbells eigenes
  // "Bulldozer Monochrome"-Theme, mit seiner Erlaubnis) - 15 Kacheln a 32x32px,
  // als ein Bild unter /bulldozer/theme.png ausgeliefert.
  const THEME_TILE_COUNT = 15;
  const THEME = {
    wallBorder: 1,
    wallObstacle: 3,
    box: 8,
    boxOnTarget: 9,
    target: 10,
    playerRight: 11,
    playerUp: 12,
    playerDown: 13,
    playerLeft: 14,
  };
  const FLOOR_COLOR = "#808000";
  const PLAYER_SPRITE = { right: THEME.playerRight, up: THEME.playerUp, down: THEME.playerDown, left: THEME.playerLeft };

  function spriteStyle(index, extra) {
    return {
      backgroundImage: "url(/bulldozer/theme.png)",
      backgroundSize: `${THEME_TILE_COUNT * 100}% 100%`,
      backgroundPosition: `${(index / (THEME_TILE_COUNT - 1)) * 100}% 0`,
      backgroundRepeat: "no-repeat",
      imageRendering: "pixelated",
      ...extra,
    };
  }

  function ImgButton({ onClick, src, alt, sub }) {
    return (
      <div className="flex items-center justify-center mb-3 lg:mb-5">
        <div className="w-14 lg:w-24 flex-shrink-0" aria-hidden="true" />
        <button
          onClick={onClick}
          className="w-full max-w-[130px] lg:max-w-[220px] rounded-xl overflow-hidden block flex-shrink-0 relative p-1.5"
          style={{
            backgroundColor: "#F7F5EF",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 5px 10px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.14), inset 0 -3px 5px rgba(0,0,0,0.1)",
          }}
        >
          <img src={src} alt={alt} className="w-full block rounded-lg" style={{ imageRendering: "pixelated", opacity: 0.82 }} />
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0) 48%, rgba(0,0,0,0.1) 100%)" }}
          />
        </button>
        <div className="w-14 lg:w-24 flex-shrink-0 pl-2 lg:pl-3">
          {sub && (
            <span className="text-xs lg:text-base font-semibold" style={{ color: INK }}>
              {sub}
            </span>
          )}
        </div>
      </div>
    );
  }

  function renderGrid() {
    if (!gameState) return null;
    const cells = [];
    for (let y = 0; y < parsed.height; y++) {
      for (let x = 0; x < parsed.width; x++) {
        const key = `${x},${y}`;
        const isWall = parsed.walls.has(key);
        const isTarget = parsed.targets.has(key);
        const isBox = gameState.boxes.has(key);
        const isPlayer = gameState.player[0] === x && gameState.player[1] === y;
        let cellStyle = { width: cellPx, height: cellPx, backgroundColor: FLOOR_COLOR };
        let content = null;
        if (isWall) {
          const isBorder = x === 0 || y === 0 || x === parsed.width - 1 || y === parsed.height - 1;
          cellStyle = { width: cellPx, height: cellPx, ...spriteStyle(isBorder ? THEME.wallBorder : THEME.wallObstacle) };
        } else if (isPlayer) {
          content = <div style={{ width: "88%", height: "88%", ...spriteStyle(PLAYER_SPRITE[facing] ?? THEME.playerRight) }} />;
        } else if (isBox) {
          content = <div style={{ width: "86%", height: "86%", ...spriteStyle(isTarget ? THEME.boxOnTarget : THEME.box) }} />;
        } else if (isTarget) {
          content = <div style={{ width: "86%", height: "86%", ...spriteStyle(THEME.target) }} />;
        }
        cells.push(
          <div key={key} className="flex items-center justify-center" style={cellStyle}>
            {content}
          </div>
        );
      }
    }
    return (
      <div
        className="mx-auto rounded-lg overflow-hidden"
        style={{ display: "grid", gridTemplateColumns: `repeat(${parsed.width}, ${cellPx})`, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
      >
        {cells}
      </div>
    );
  }

  function DirButton({ dir, icon: Icon, className }) {
    return (
      <button
        onClick={() => !won && move(dir)}
        className={`w-12 h-12 lg:w-20 lg:h-20 rounded-lg flex items-center justify-center ${className || ""}`}
        style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}
      >
        <Icon size={20} className="lg:w-8 lg:h-8" style={{ color: INK }} />
      </button>
    );
  }

  return (
    <div className="min-h-screen pb-10" style={{ backgroundColor: PAPER, color: INK, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="max-w-3xl mx-auto lg:max-w-none lg:w-2/3 lg:mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            {screen !== "select" && (
              <button onClick={() => setScreen("select")} className="p-1.5 -ml-1.5 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}>
                <ChevronLeft size={16} style={{ color: INK_SOFT }} />
              </button>
            )}
            <img src="/bulldozer/logo-nawodo.png" alt="NaWoDo" className="h-8 lg:h-12 object-contain" />
            <h1 className="font-bold text-lg lg:text-2xl">Bulldozer</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} className="lg:w-6 lg:h-6" style={{ color: INK_SOFT }} /></a>
            <span className="text-xs lg:text-sm font-semibold truncate max-w-[90px] lg:max-w-[160px]" style={{ color: INK_SOFT }}>{userName}</span>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 lg:w-14 lg:h-14 rounded-full flex items-center justify-center font-semibold text-sm lg:text-lg text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>
              {ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}
            </button>
          </div>
        </div>

        {screen === "select" && (
          <div className="flex flex-col items-center py-6">
            <img
              src="/bulldozer/bulldozer-logo.png"
              alt="Bulldozer"
              className="w-full max-w-[320px] lg:max-w-[480px] mb-6 px-4"
              style={{ imageRendering: "pixelated" }}
            />
            <ImgButton onClick={() => setShowHelp(true)} src="/bulldozer/btn-anleitung.png" alt="Spielanleitung" />
            <ImgButton onClick={() => startLevel(0)} src="/bulldozer/btn-start.png" alt="Spielen" />
            <ImgButton
              onClick={() => startLevel(continueIndex)}
              src="/bulldozer/btn-weiter.png"
              alt="Weiterspielen"
              sub={highestSolved === -1 ? undefined : `${continueIndex + 1}/${LEVELS.length}`}
            />
            <ImgButton onClick={() => setScreen("leaderboard")} src="/bulldozer/btn-highscore.png" alt="Highscore" />

            <div className="w-full max-w-[130px] lg:max-w-[210px] mt-2">
              <div className="flex gap-1 lg:gap-1.5">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && jumpToCode()}
                  placeholder="Code…"
                  className="flex-1 min-w-0 h-7 lg:h-9 rounded-lg px-1.5 text-[10px] lg:text-xs border uppercase"
                  style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
                />
                <button
                  onClick={jumpToCode}
                  className="flex-shrink-0 h-7 lg:h-9 rounded-lg overflow-hidden relative p-1"
                  style={{
                    backgroundColor: "#F7F5EF",
                    border: "1px solid rgba(255,255,255,0.6)",
                    boxShadow: "0 3px 6px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.14), inset 0 -2px 3px rgba(0,0,0,0.1)",
                  }}
                >
                  <img src="/bulldozer/btn-los.png" alt="Los" className="h-full w-auto block rounded" style={{ imageRendering: "pixelated", opacity: 0.82 }} />
                  <div
                    className="absolute inset-0 rounded-lg pointer-events-none"
                    style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.16) 28%, rgba(255,255,255,0) 48%, rgba(0,0,0,0.1) 100%)" }}
                  />
                </button>
              </div>
              {codeError && <p className="text-xs lg:text-sm mt-1.5 px-1 text-center" style={{ color: "#A13D3D" }}>{codeError}</p>}
              {isSuperAdmin && (
                <button
                  onClick={() => setShowLevelTable(true)}
                  className="flex items-center justify-center mx-auto mt-3 h-7 lg:h-9 rounded-lg px-4 lg:px-6 text-xs lg:text-sm font-semibold"
                  style={{ backgroundColor: "transparent", border: `1px solid ${BORDER_SOFT}`, color: INK_SOFT }}
                >
                  Levelcode-Tabelle
                </button>
              )}
            </div>
          </div>
        )}

        {screen === "game" && gameState && (
          <div>
            <div className="text-center mb-3">
              <div className="font-semibold text-sm lg:text-xl">{levelIndex + 1}. {level.title}</div>
              <div className="text-xs lg:text-base" style={{ color: INK_SOFT }}>Code: {levelCode(levelIndex)}</div>
            </div>

            <div className="flex items-center justify-center gap-4 lg:gap-8 mb-4 text-sm lg:text-lg" style={{ color: INK_SOFT }}>
              <span>Züge: <strong style={{ color: INK }}>{moves}</strong></span>
              <span>Zeit: <strong style={{ color: INK }}>{formatTime(elapsedMs)}</strong></span>
              {ownScoreFor(levelIndex) && <span>Bestzeit: <strong style={{ color: INK }}>{formatTime(ownScoreFor(levelIndex).best_time_ms)}</strong></span>}
            </div>

            <div ref={gridWrapRef} className="mb-4 overflow-x-auto">
              {renderGrid()}
            </div>

            <div ref={controlsRef}>
              <div className="flex items-center justify-center gap-2 lg:gap-4 mb-4 lg:mb-6">
                <button onClick={undo} disabled={history.length === 0} className="flex items-center gap-1.5 px-3 py-2 lg:px-5 lg:py-3 rounded-lg text-xs lg:text-base font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT, opacity: history.length === 0 ? 0.5 : 1 }}>
                  <Undo2 size={14} /> Rückgängig
                </button>
                <button onClick={restart} className="flex items-center gap-1.5 px-3 py-2 lg:px-5 lg:py-3 rounded-lg text-xs lg:text-base font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                  <RotateCcw size={14} /> Neu starten
                </button>
              </div>

              <div className="flex flex-col items-center gap-1.5 lg:gap-2.5">
                <DirButton dir="up" icon={ChevronUp} />
                <div className="flex items-center gap-1.5 lg:gap-2.5">
                  <DirButton dir="left" icon={ChevronLeft} />
                  <div className="w-12 h-12 lg:w-20 lg:h-20" />
                  <DirButton dir="right" icon={ChevronRight} />
                </div>
                <DirButton dir="down" icon={ChevronDown} />
              </div>
              <p className="text-center text-xs lg:text-base mt-3" style={{ color: INK_SOFT }}>Am Computer gehen auch die Pfeiltasten.</p>
            </div>

            {won && (
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ backgroundColor: PAPER }}>
                  <Trophy className="mx-auto mb-2" size={28} style={{ color: LIGHT_GRAY }} />
                  <h2 className="font-bold text-lg mb-1">Level geschafft!</h2>
                  <p className="text-sm mb-4" style={{ color: INK_SOFT }}>{moves} Züge · {formatTime(elapsedMs)} · Code: {levelCode(levelIndex)}</p>
                  {saveError && <p className="text-xs mb-3" style={{ color: "#A13D3D" }}>{saveError}</p>}
                  <div className="flex flex-col gap-2">
                    {levelIndex < LEVELS.length - 1 && (
                      <button onClick={() => startLevel(levelIndex + 1)} className="w-full rounded-lg py-2.5 text-sm font-semibold" style={{ backgroundColor: LIGHT_GRAY, color: INK }}>
                        Nächstes Level
                      </button>
                    )}
                    <button onClick={() => setScreen("select")} className="w-full rounded-lg py-2.5 text-sm font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK }}>
                      Zur Übersicht
                    </button>
                    <button onClick={() => setScreen("leaderboard")} className="w-full rounded-lg py-2.5 text-sm font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK }}>
                      Zur Rangliste
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {screen === "leaderboard" && (
          <div>
            {loadingScores ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin" size={22} style={{ color: INK_SOFT }} /></div>
            ) : overallRanking.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: INK_SOFT }}>Noch keine Ergebnisse – sei der/die Erste!</p>
            ) : (
              <div className="flex flex-col gap-2 lg:gap-3 mx-auto" style={{ maxWidth: "50%" }}>
                {overallRanking.map((r, i) => (
                  <div key={r.user_id} className="rounded-xl p-3.5 lg:p-5 flex items-center justify-between" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                    <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                      <div className="w-7 h-7 lg:w-10 lg:h-10 rounded-full flex items-center justify-center flex-shrink-0 text-xs lg:text-base font-bold" style={{ backgroundColor: i === 0 ? "#C9752F1A" : "#E4E1D3", color: i === 0 ? ORANGE : INK_SOFT }}>{i + 1}</div>
                      <div className="font-semibold text-sm lg:text-lg truncate">{nameFor(r.user_id)}</div>
                    </div>
                    <div className="text-xs lg:text-base text-right flex-shrink-0" style={{ color: INK_SOFT }}>
                      {r.levelsSolved} / {LEVELS.length} Level<br />Gesamtzeit {formatTime(r.totalTimeMs)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showLevelTable && isSuperAdmin && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowLevelTable(false); setPreviewLevelIdx(null); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[85vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">Levelcode-Tabelle</h2>
              <button onClick={() => { setShowLevelTable(false); setPreviewLevelIdx(null); }}><X size={20} /></button>
            </div>
            {previewLevelIdx !== null && (
              <div className="mb-4 p-3 rounded-xl flex flex-col items-center gap-2" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                <div className="text-xs font-semibold text-center">{previewLevelIdx + 1}. {LEVELS[previewLevelIdx].title}</div>
                <div className="overflow-x-auto max-w-full">
                  <LevelPreview level={LEVELS[previewLevelIdx]} cellSize={9} />
                </div>
                <div className="text-xs font-mono" style={{ color: INK_SOFT }}>Code: {levelCode(previewLevelIdx)}</div>
              </div>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: INK_SOFT }}>
                  <th className="text-left font-semibold pb-1.5 pr-2">#</th>
                  <th className="text-left font-semibold pb-1.5 pr-2">Titel</th>
                  <th className="text-left font-semibold pb-1.5">Code</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((lvl, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${BORDER_SOFT}` }}>
                    <td className="py-1 pr-2" style={{ color: INK_SOFT }}>{i + 1}</td>
                    <td className="py-1 pr-2">
                      <button
                        onClick={() => setPreviewLevelIdx(previewLevelIdx === i ? null : i)}
                        className="text-left underline decoration-dotted"
                        style={{ color: previewLevelIdx === i ? ORANGE : INK }}
                      >
                        {lvl.title}
                      </button>
                    </td>
                    <td className="py-1 font-mono">{levelCode(i)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onMouseDown={(e) => { e.currentTarget.dataset.selfDown = e.target === e.currentTarget ? "1" : ""; }} onClick={(e) => { if (e.target === e.currentTarget && e.currentTarget.dataset.selfDown === "1") { setShowHelp(false); } }}>
          <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: PAPER }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg">So wird gespielt</h2>
              <button onClick={() => setShowHelp(false)}><X size={20} /></button>
            </div>
            <div className="text-sm space-y-3" style={{ color: INK }}>
              <p>
                <strong>Ziel:</strong> Schiebe mit deinem Bulldozer alle Steine auf die markierten
                Zielfelder (rote Ringe). Sobald jeder Stein auf einem Zielfeld steht, ist das Level
                geschafft.
              </p>
              <p>
                <strong>Steuerung:</strong> Am Computer mit den Pfeiltasten, am Handy oder Tablet
                mit den Pfeil-Buttons unter dem Spielfeld. Du kannst Steine nur schieben, nicht
                ziehen – achte also darauf, dich nicht selbst einzusperren.
              </p>
              <p>
                <strong>Rückgängig &amp; Neustart:</strong> Mit dem Rückgängig-Button machst du
                deinen letzten Zug rückgängig, mit Neustart beginnst du das Level von vorne.
              </p>
              <p>
                <strong>Level-Codes:</strong> Jedes Level hat einen kurzen Code (z. B. bei
                „Level geschafft“ oder oben im Spiel zu sehen). Damit kannst du direkt zu einem
                Level springen oder es mit anderen teilen.
              </p>
              <p>
                <strong>Weiterspielen:</strong> Der Button „Weiter“ bringt dich immer zu deinem
                zuletzt noch nicht gelösten Level – die Zahl daneben zeigt, welches Level das ist.
              </p>
              <p>
                <strong>Highscore:</strong> In der Rangliste siehst du zwei Ansichten: „Gesamt“
                zeigt, wer die meisten Level gelöst hat (bei Gleichstand zählt die schnellere
                Gesamtzeit), „Pro Level“ zeigt die schnellste Zeit je Level.
              </p>
            </div>
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
                <div className="text-sm font-semibold truncate">{userName}</div>
                <div className="text-xs truncate" style={{ color: INK_SOFT }}>{user.email}</div>
                {uploadingAvatar && <div className="text-xs mt-0.5" style={{ color: INK_SOFT }}>Wird hochgeladen…</div>}
                {avatarError && <div className="text-xs mt-0.5" style={{ color: "#A13D3D" }}>{avatarError}</div>}
              </div>
            </div>
            <button onClick={() => { setShowAccount(false); openEditProfile(); }} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold flex items-center justify-center gap-2" style={{ border: "1.5px solid #D8D5C7", color: INK }}>
              <Pencil size={14} /> Eintrag bearbeiten
            </button>

            <label className="text-xs font-medium block mb-1">Passwort ändern</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Neues Passwort" className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
            <input type="password" value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} placeholder="Neues Passwort wiederholen" className="w-full rounded-lg px-3 py-2.5 mb-2 text-sm border" style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }} />
            {passwordError && <p className="text-xs mb-2" style={{ color: "#A13D3D" }}>{passwordError}</p>}
            {passwordSuccess && <p className="text-xs mb-2" style={{ color: "#2E7D4F" }}>Passwort geändert!</p>}
            <button onClick={handleChangePassword} disabled={savingPassword} className="w-full rounded-lg py-2.5 mb-4 text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: INK, opacity: savingPassword ? 0.7 : 1 }}>
              {savingPassword && <Loader2 size={15} className="animate-spin" />} {savingPassword ? "Speichern…" : "Passwort speichern"}
            </button>
            <button onClick={handleLogout} className="w-full rounded-lg py-2.5 text-sm font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: "#A13D3D" }}>
              Abmelden
            </button>
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
