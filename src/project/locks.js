/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Panneaux figés (cadenas) : leurs pièces ne bougent plus, les nouvelles vont dans leurs trous. Chaque pièce figée
   est repérée par l'identifiant stable de son type (uid), qui survit aux ajouts et retraits de fichiers. */

import { state } from "./state.js";

function allLocks() {
  if (!Array.isArray(state.locks)) state.locks = [];
  return state.locks;
}

export function lockCount() {
  return allLocks().length;
}

/* Identifiant stable d'un type de pièce, créé à la demande. */
export function typeUid(type) {
  if (!(type.uid > 0))
    type.uid =
      state.types.reduce(function (m, t) {
        return Math.max(m, t.uid > 0 ? t.uid : 0);
      }, 0) + 1;
  return type.uid;
}

// position d'une pièce posée, sans ce qui ne sert qu'au calcul en cours
function placedCopy(p) {
  var c = { x: p.x, y: p.y, w: p.w, h: p.h, dx: p.dx || 0, dy: p.dy || 0 };
  if (p.a != null) {
    c.a = p.a;
    c.mx = p.mx;
    c.my = p.my;
  } else if (p.k != null) c.k = p.k;
  if (p.turned) c.turned = true;
  if (p.raw) c.raw = Object.assign({}, p.raw);
  if (p.f) c.f = Object.assign({}, p.f);
  return c;
}

/* Fige un panneau du dernier résultat (copie de ses pièces). */
export function lockSheet(sheet) {
  allLocks().push({
    pi: sheet.pi,
    L: sheet.L,
    W: sheet.W,
    o: sheet.o,
    parts: sheet.parts.map(function (p) {
      return Object.assign(placedCopy(p), { uid: typeUid(state.types[p.i]) });
    })
  });
}

export function unlockSheet(index) {
  allLocks().splice(index, 1);
}

/* Panneaux figés avec l'indice actuel de chaque pièce. Un panneau dont une pièce n'existe plus est déverrouillé. */
export function resolvedLocks() {
  var byUid = {};
  state.types.forEach(function (t, i) {
    if (t.uid > 0) byUid[t.uid] = i;
  });
  state.locks = allLocks().filter(function (l) {
    return l.parts.every(function (p) {
      return byUid[p.uid] != null;
    });
  });
  return state.locks.map(function (l) {
    return {
      pi: l.pi,
      L: l.L,
      W: l.W,
      o: l.o,
      parts: l.parts.map(function (p) {
        return Object.assign(placedCopy(p), { i: byUid[p.uid], locked: true });
      })
    };
  });
}

/* Nombre de pièces figées de chaque type (par indice actuel). */
export function lockedCounts() {
  var counts = state.types.map(function () {
    return 0;
  });
  resolvedLocks().forEach(function (l) {
    l.parts.forEach(function (p) {
      counts[p.i]++;
    });
  });
  return counts;
}

/* Panneaux figés qui contiennent l'un de ces types (indices actuels) : leurs positions dans la liste des cadenas. */
export function locksWithTypes(typeIndexes) {
  var uids = typeIndexes
    .map(function (i) {
      return state.types[i] && state.types[i].uid;
    })
    .filter(Boolean);
  var out = [];
  allLocks().forEach(function (l, k) {
    if (
      l.parts.some(function (p) {
        return uids.includes(p.uid);
      })
    )
      out.push(k);
  });
  return out;
}

/* Déverrouille plusieurs panneaux d'un coup (positions dans la liste des cadenas). */
export function unlockSheets(indexes) {
  state.locks = allLocks().filter(function (l, k) {
    return !indexes.includes(k);
  });
}

/* Une ligne de panneau sert-elle à un panneau figé ? (sa taille ne peut plus changer) */
export function panelRowLocked(panelIndex) {
  return allLocks().some(function (l) {
    return l.pi === panelIndex;
  });
}

/* Les lignes de panneau ont bougé (ajout, retrait, déplacement) : map(ancien indice) → nouvel indice. */
export function remapLockedPanels(map) {
  allLocks().forEach(function (l) {
    l.pi = map(l.pi);
  });
}

/* Panneaux figés de chaque ligne (pour retirer leur stock du calcul des autres). */
export function lockedPanelUse() {
  var used = {};
  allLocks().forEach(function (l) {
    used[l.pi] = (used[l.pi] || 0) + 1;
  });
  return used;
}
