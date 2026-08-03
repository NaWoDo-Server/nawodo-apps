// Original, selbst entworfene Sokoban-artige Level (kein Nachbau der
// urheberrechtlich geschuetzten "Bulldozer"-Level von John Hattan / The Code Zone -
// nur das allgemeine Schiebe-Prinzip ist inspiriert davon).
//
// Format pro Level:
//   rows:    Zeilen des Spielfelds, "#" = Wand, alles andere = begehbarer Boden.
//   targets: Zielfelder als [x, y]
//   boxes:   Start-Positionen der Kisten als [x, y]
//   player:  Start-Position des Bulldozers als [x, y]
//   title:   kurzer Anzeigename

export const LEVELS = [
  {
    title: "Der erste Schub",
    rows: ["#####", "#P__#", "#_B_#", "#_T_#", "#####"],
    targets: [[2, 3]],
    boxes: [[2, 2]],
    player: [1, 1],
  },
  {
    title: "Doppelt haelt besser",
    rows: ["#######", "#P____#", "#_B_B_#", "#_T_T_#", "#######"],
    targets: [[2, 3], [4, 3]],
    boxes: [[2, 2], [4, 2]],
    player: [1, 1],
  },
  {
    title: "Um die Ecke",
    rows: ["######", "#P___#", "#_B__#", "#____#", "#___T#", "######"],
    targets: [[4, 4]],
    boxes: [[2, 2]],
    player: [1, 1],
  },
  {
    title: "Zwei Wege",
    rows: ["#######", "#P____#", "#_B_B_#", "#_____#", "#_T_T_#", "#######"],
    targets: [[2, 4], [4, 4]],
    boxes: [[2, 2], [4, 2]],
    player: [1, 1],
  },
  {
    title: "Grosse Baustelle",
    rows: ["########", "#P_____#", "#_B___B#", "#______#", "#_T___T#", "########"],
    targets: [[2, 4], [6, 4]],
    boxes: [[2, 2], [6, 2]],
    player: [1, 1],
  },
  {
    title: "Der lange Schub",
    rows: ["#######", "#P____#", "#_____#", "#__B__#", "#_____#", "#____T#", "#######"],
    targets: [[5, 5]],
    boxes: [[3, 3]],
    player: [1, 1],
  },
  {
    title: "Drei auf einen Streich",
    rows: ["#########", "#P______#", "#_B_B_B_#", "#_______#", "#_T_T_T_#", "#########"],
    targets: [[2, 4], [4, 4], [6, 4]],
    boxes: [[2, 2], [4, 2], [6, 2]],
    player: [1, 1],
  },
  {
    title: "Feierabend",
    rows: ["#########", "#P______#", "#_B___B_#", "#____B__#", "#_______#", "#_T_T_T_#", "#########"],
    targets: [[2, 5], [4, 5], [6, 5]],
    boxes: [[2, 2], [6, 2], [5, 3]],
    player: [1, 1],
  },
];

// Kurzer "Fantasie-Code" pro Level - keine echte Sicherung, nur zum schnellen
// Springen/Teilen gedacht (wie bei den Level-Codes des Originalspiels).
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ohne O/0, I/1 (Verwechslungsgefahr)

export function levelCode(index) {
  let n = ((index + 1) * 2654435761 + 104729) >>> 0;
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += CODE_CHARS[n % CODE_CHARS.length];
    n = Math.floor(n / CODE_CHARS.length);
  }
  return code;
}

export function findLevelIndexByCode(input) {
  const clean = (input || "").trim().toUpperCase();
  if (!clean) return -1;
  for (let i = 0; i < LEVELS.length; i++) {
    if (levelCode(i) === clean) return i;
  }
  return -1;
}
