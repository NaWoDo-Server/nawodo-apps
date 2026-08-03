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
  {
    title: "Weiter Weg",
    rows: ["########", "#______#", "#______#", "#______#", "#______#", "#______#", "########"],
    targets: [[6, 5]],
    boxes: [[2, 2]],
    player: [1, 1],
  },
  {
    title: "Kreuz und quer",
    rows: ["########", "#______#", "#______#", "#______#", "#______#", "#______#", "########"],
    targets: [[2, 2], [5, 5]],
    boxes: [[5, 2], [2, 5]],
    player: [1, 1],
  },
  {
    title: "Zwei Baustellen",
    rows: ["#########", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#########"],
    targets: [[2, 6], [6, 6]],
    boxes: [[2, 2], [6, 2]],
    player: [1, 1],
  },
  {
    title: "Dreieck",
    rows: ["#########", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#########"],
    targets: [[3, 3], [5, 3], [4, 5]],
    boxes: [[4, 3], [3, 5], [5, 5]],
    player: [1, 1],
  },
  {
    title: "Umgekehrt",
    rows: ["#########", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#########"],
    targets: [[6, 6], [4, 2], [2, 6]],
    boxes: [[2, 2], [4, 4], [6, 2]],
    player: [1, 1],
  },
  {
    title: "Vier Ecken",
    rows: ["##########", "#________#", "#________#", "#________#", "#________#", "#________#", "#________#", "#________#", "##########"],
    targets: [[2, 4], [7, 4], [2, 5], [7, 5]],
    boxes: [[2, 2], [7, 2], [2, 6], [7, 6]],
    player: [1, 1],
  },
  {
    title: "Tausch",
    rows: ["##########", "#________#", "#________#", "#________#", "#________#", "#________#", "#________#", "#________#", "##########"],
    targets: [[6, 2], [3, 2], [6, 6], [3, 6]],
    boxes: [[3, 3], [6, 3], [3, 5], [6, 5]],
    player: [1, 1],
  },
  {
    title: "Reihenfolge",
    rows: ["#########", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#########"],
    targets: [[6, 4], [4, 4], [2, 4]],
    boxes: [[2, 2], [4, 2], [6, 2]],
    player: [1, 1],
  },
  {
    title: "Baustellen-Rundgang",
    rows: ["###########", "#_________#", "#_________#", "#_________#", "#_________#", "#_________#", "#_________#", "#_________#", "###########"],
    targets: [[8, 7], [2, 6], [5, 2], [5, 7]],
    boxes: [[2, 2], [5, 3], [8, 2], [5, 6]],
    player: [1, 1],
  },
  {
    title: "Aufeinander zu",
    rows: ["########", "#______#", "#______#", "#______#", "#______#", "#______#", "#______#", "########"],
    targets: [[5, 2], [2, 5]],
    boxes: [[2, 2], [5, 5]],
    player: [3, 3],
  },
  {
    title: "Verteilt",
    rows: ["#########", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#########"],
    targets: [[5, 3], [5, 7], [7, 3]],
    boxes: [[3, 3], [5, 5], [3, 5]],
    player: [1, 1],
  },
  {
    title: "Grosse Reihe",
    rows: ["##########", "#________#", "#________#", "#________#", "#________#", "#________#", "#________#", "##########"],
    targets: [[2, 5], [4, 5], [6, 5], [7, 5]],
    boxes: [[2, 2], [4, 2], [6, 2], [7, 2]],
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
