import React, { useState, useEffect, useMemo, useCallback } from "react";
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

  return <BulldozerApp session={session} />;
}

// --- Hauptkomponente -----------------------------------------------------

function BulldozerApp({ session }) {
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

  const [showAccount, setShowAccount] = useState(false);
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
  const [leaderboardTab, setLeaderboardTab] = useState("overall"); // "overall" | "perlevel"
  const [perLevelIndex, setPerLevelIndex] = useState(0);

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

  const perLevelRanking = useMemo(() => {
    return scores.filter((s) => s.level_index === perLevelIndex).sort((a, b) => a.best_time_ms - b.best_time_ms);
  }, [scores, perLevelIndex]);

  // --- Rendering ---

  const cellPx = "clamp(28px, 10vw, 46px)";

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

  function StoneButton({ onClick, children, sub }) {
    return (
      <button
        onClick={onClick}
        className="w-full max-w-[260px] mx-auto rounded-xl py-4 px-6 flex flex-col items-center justify-center gap-0.5 mb-3"
        style={{ backgroundColor: ORANGE, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}
      >
        <span className="font-bold text-base tracking-wide text-white">{children}</span>
        {sub && <span className="text-xs font-semibold text-white">{sub}</span>}
      </button>
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
        className={`w-12 h-12 rounded-lg flex items-center justify-center ${className || ""}`}
        style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}
      >
        <Icon size={20} style={{ color: INK }} />
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
            <img src="/bulldozer/logo-nawodo.png" alt="NaWoDo" className="h-8 object-contain" />
            <h1 className="font-bold text-lg">Bulldozer</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setScreen("leaderboard")} className="p-2 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Trophy size={16} style={{ color: INK_SOFT }} /></button>
            <a href="/" className="p-2 rounded-full flex items-center justify-center" style={{ backgroundColor: "#E4E1D3" }}><Home size={16} style={{ color: INK_SOFT }} /></a>
            <button onClick={() => { setShowAccount(true); setPasswordError(""); setPasswordSuccess(false); }} className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white flex-shrink-0 overflow-hidden" style={{ backgroundColor: INK }}>
              {ownFotoUrl ? <img src={ownFotoUrl} alt="" className="w-full h-full object-cover" /> : initial}
            </button>
          </div>
        </div>

        {screen === "select" && (
          <div className="flex flex-col items-center py-6">
            <img
              src="/bulldozer/bulldozer-logo.png"
              alt="Bulldozer"
              className="w-full max-w-[320px] mb-6 px-4"
              style={{ imageRendering: "pixelated" }}
            />
            <StoneButton onClick={() => startLevel(0)}>SPIELEN</StoneButton>
            <StoneButton onClick={() => startLevel(continueIndex)} sub={highestSolved === -1 ? undefined : `Level ${continueIndex + 1}`}>
              WEITERSPIELEN
            </StoneButton>
            <StoneButton onClick={() => setScreen("leaderboard")}>HIGHSCORE</StoneButton>

            <div className="w-full max-w-[260px] mt-2">
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && jumpToCode()}
                  placeholder="Level-Code…"
                  className="flex-1 rounded-lg px-3 py-2 text-xs border uppercase"
                  style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
                />
                <button onClick={jumpToCode} className="px-3 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1" style={{ backgroundColor: ORANGE }}>
                  <KeyRound size={12} /> Los
                </button>
              </div>
              {codeError && <p className="text-xs mt-1.5 px-1 text-center" style={{ color: "#A13D3D" }}>{codeError}</p>}
            </div>
          </div>
        )}

        {screen === "game" && gameState && (
          <div>
            <div className="text-center mb-3">
              <div className="font-semibold text-sm">{levelIndex + 1}. {level.title}</div>
              <div className="text-xs" style={{ color: INK_SOFT }}>Code: {levelCode(levelIndex)}</div>
            </div>

            <div className="flex items-center justify-center gap-4 mb-4 text-sm" style={{ color: INK_SOFT }}>
              <span>Züge: <strong style={{ color: INK }}>{moves}</strong></span>
              <span>Zeit: <strong style={{ color: INK }}>{formatTime(elapsedMs)}</strong></span>
              {ownScoreFor(levelIndex) && <span>Bestzeit: <strong style={{ color: INK }}>{formatTime(ownScoreFor(levelIndex).best_time_ms)}</strong></span>}
            </div>

            <div className="mb-4 overflow-x-auto">
              {renderGrid()}
            </div>

            <div className="flex items-center justify-center gap-2 mb-4">
              <button onClick={undo} disabled={history.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT, opacity: history.length === 0 ? 0.5 : 1 }}>
                <Undo2 size={14} /> Rückgängig
              </button>
              <button onClick={restart} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold" style={{ border: `1.5px solid ${BORDER_SOFT}`, color: INK_SOFT }}>
                <RotateCcw size={14} /> Neu starten
              </button>
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <DirButton dir="up" icon={ChevronUp} />
              <div className="flex items-center gap-1.5">
                <DirButton dir="left" icon={ChevronLeft} />
                <div className="w-12 h-12" />
                <DirButton dir="right" icon={ChevronRight} />
              </div>
              <DirButton dir="down" icon={ChevronDown} />
            </div>
            <p className="text-center text-xs mt-3" style={{ color: INK_SOFT }}>Am Computer gehen auch die Pfeiltasten.</p>

            {won && (
              <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
                <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ backgroundColor: PAPER }}>
                  <Trophy className="mx-auto mb-2" size={28} style={{ color: ORANGE }} />
                  <h2 className="font-bold text-lg mb-1">Level geschafft!</h2>
                  <p className="text-sm mb-4" style={{ color: INK_SOFT }}>{moves} Züge · {formatTime(elapsedMs)} · Code: {levelCode(levelIndex)}</p>
                  {saveError && <p className="text-xs mb-3" style={{ color: "#A13D3D" }}>{saveError}</p>}
                  <div className="flex flex-col gap-2">
                    {levelIndex < LEVELS.length - 1 && (
                      <button onClick={() => startLevel(levelIndex + 1)} className="w-full rounded-lg py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: ORANGE }}>
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
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setLeaderboardTab("overall")}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: leaderboardTab === "overall" ? ORANGE : "transparent", color: leaderboardTab === "overall" ? "#fff" : INK, border: `1.5px solid ${leaderboardTab === "overall" ? ORANGE : BORDER_SOFT}` }}
              >
                Gesamt
              </button>
              <button
                onClick={() => setLeaderboardTab("perlevel")}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold"
                style={{ backgroundColor: leaderboardTab === "perlevel" ? ORANGE : "transparent", color: leaderboardTab === "perlevel" ? "#fff" : INK, border: `1.5px solid ${leaderboardTab === "perlevel" ? ORANGE : BORDER_SOFT}` }}
              >
                Pro Level
              </button>
            </div>

            {loadingScores ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin" size={22} style={{ color: INK_SOFT }} /></div>
            ) : leaderboardTab === "overall" ? (
              overallRanking.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: INK_SOFT }}>Noch keine Ergebnisse – sei der/die Erste!</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {overallRanking.map((r, i) => (
                    <div key={r.user_id} className="rounded-xl p-3.5 flex items-center justify-between" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ backgroundColor: i === 0 ? "#C9752F1A" : "#E4E1D3", color: i === 0 ? ORANGE : INK_SOFT }}>{i + 1}</div>
                        <div className="font-semibold text-sm truncate">{nameFor(r.user_id)}</div>
                      </div>
                      <div className="text-xs text-right flex-shrink-0" style={{ color: INK_SOFT }}>
                        {r.levelsSolved} / {LEVELS.length} Level<br />Gesamtzeit {formatTime(r.totalTimeMs)}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <>
                <select
                  value={perLevelIndex}
                  onChange={(e) => setPerLevelIndex(Number(e.target.value))}
                  className="w-full rounded-lg px-3 py-2.5 mb-3 text-sm border"
                  style={{ borderColor: BORDER_SOFT, backgroundColor: "#fff" }}
                >
                  {LEVELS.map((lvl, i) => <option key={i} value={i}>{i + 1}. {lvl.title}</option>)}
                </select>
                {perLevelRanking.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: INK_SOFT }}>Für dieses Level gibt's noch keine Bestzeit.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {perLevelRanking.map((r, i) => (
                      <div key={r.user_id} className="rounded-xl p-3.5 flex items-center justify-between" style={{ backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ backgroundColor: i === 0 ? "#C9752F1A" : "#E4E1D3", color: i === 0 ? ORANGE : INK_SOFT }}>{i + 1}</div>
                          <div className="font-semibold text-sm truncate">{nameFor(r.user_id)}</div>
                        </div>
                        <div className="text-xs text-right flex-shrink-0" style={{ color: INK_SOFT }}>{formatTime(r.best_time_ms)} · {r.best_moves} Züge</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

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
    </div>
  );
}
