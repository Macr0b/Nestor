// Panneaux figés (cadenas) : identifiants stables, comptes, retraits, sauvegarde. Lancement : npm test
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { state } from "../../src/project/state.js";
import {
  lockCount,
  lockSheet,
  lockedCounts,
  lockedPanelUse,
  locksWithTypes,
  panelRowLocked,
  remapLockedPanels,
  resolvedLocks,
  typeUid,
  unlockSheet,
  unlockSheets
} from "../../src/project/locks.js";
import { cleanSnapshot } from "../../src/project/project-snapshot.js";
import { freeRectangles } from "../../src/placement/rectangles.js";

const square = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10]
];
const part = (name) => ({ name, qty: 2, w: 10, h: 10, paths: [{ pts: square, closed: true }] });
const placed = (i, x) => ({ i, x, y: 5, w: 10, h: 10, k: 0, raw: { x, y: 5, w: 10, h: 10, Ln: 100, Wn: 50 } });

describe("cadenas", () => {
  beforeEach(() => {
    state.types = [part("A"), part("B"), part("C")];
    state.locks = [];
    state.sheet = { panels: [{ L: 100, W: 50, qty: "" }], gap: 2, margin: 5 };
  });

  test("figer : chaque pièce garde l'identifiant de son type, qui survit au retrait d'un autre type", () => {
    lockSheet({ pi: 0, L: 100, W: 50, o: "tl", parts: [placed(0, 5), placed(2, 20), placed(2, 35)] });
    assert.equal(lockCount(), 1);
    assert.deepEqual(lockedCounts(), [1, 0, 2]);
    // le type B (au milieu) disparaît : les indices changent, les pièces figées suivent
    state.types.splice(1, 1);
    assert.deepEqual(lockedCounts(), [1, 2]);
    assert.deepEqual(
      resolvedLocks()[0].parts.map((p) => [p.i, p.x, p.locked]),
      [
        [0, 5, true],
        [1, 20, true],
        [1, 35, true]
      ]
    );
    // un type figé disparaît : son panneau est déverrouillé
    state.types.splice(0, 1);
    assert.equal(resolvedLocks().length, 0);
    assert.equal(lockCount(), 0);
  });

  test("identifiants uniques, même après une copie qui l'aurait recopié", () => {
    const ids = state.types.map(typeUid);
    assert.equal(new Set(ids).size, 3);
    const copy = { ...state.types[0] };
    delete copy.uid;
    state.types.push(copy);
    assert.ok(!ids.includes(typeUid(copy)));
  });

  test("panneaux touchés par un changement, déverrouillage, stock pris, lignes déplacées", () => {
    lockSheet({ pi: 0, L: 100, W: 50, o: "tl", parts: [placed(0, 5)] });
    lockSheet({ pi: 0, L: 100, W: 50, o: "tl", parts: [placed(1, 5)] });
    assert.deepEqual(locksWithTypes([1, 2]), [1]);
    assert.deepEqual(locksWithTypes([0, 1]), [0, 1]);
    assert.deepEqual(lockedPanelUse(), { 0: 2 });
    assert.equal(panelRowLocked(0), true);
    assert.equal(panelRowLocked(1), false);
    // une chute ajoutée devant : la ligne du panneau figé descend
    remapLockedPanels((pi) => (pi >= 0 ? pi + 1 : pi));
    assert.equal(panelRowLocked(1), true);
    unlockSheet(0);
    assert.equal(lockCount(), 1);
    unlockSheets([0]);
    assert.equal(lockCount(), 0);
  });

  test("projet : cadenas, identifiants et remplissage gardés ; un cadenas abîmé est retiré en entier", () => {
    lockSheet({ pi: 0, L: 100, W: 50, o: "br", parts: [placed(0, 5), placed(1, 20)] });
    state.types[2].fill = 2;
    state.types[1].fill = "new";
    const snap = cleanSnapshot({
      app: "Nestor",
      kind: "projet",
      sheet: state.sheet,
      types: state.types,
      locks: [
        ...state.locks,
        { pi: 0, L: 100, W: 50, o: "tl", parts: [{ uid: 1, x: "a" }] },
        { pi: 9, L: 100, W: 50, o: "tl", parts: [{ uid: 1, x: 1, y: 1, w: 1, h: 1, dx: 0, dy: 0 }] }
      ]
    });
    assert.equal(snap.locks.length, 1);
    assert.deepEqual(
      snap.locks[0].parts.map((p) => [p.uid, p.x, p.k, p.raw.Ln]),
      [
        [state.types[0].uid, 5, 0, 100],
        [state.types[1].uid, 20, 0, 100]
      ]
    );
    assert.deepEqual(
      snap.types.map((t) => t.fill),
      [undefined, "new", 2]
    );
    assert.ok(snap.types.every((t, i) => t.uid === state.types[i].uid));
  });
});

describe("espace libre d'un panneau figé (méthode Rectangles)", () => {
  test("rectangles libres atteignables à la scie, à l'écart des pièces", () => {
    const boxes = [
      { x: 5, y: 5, w: 40, h: 20 },
      { x: 50, y: 5, w: 40, h: 20 }
    ];
    const free = freeRectangles(200, 100, boxes, 2, 5);
    // aucun rectangle libre ne touche une pièce de moins de 2 mm, aucun ne sort de la zone utile
    for (const r of free) {
      assert.ok(r.x >= 5 - 1e-9 && r.y >= 5 - 1e-9 && r.x + r.w <= 195 + 1e-9 && r.y + r.h <= 95 + 1e-9);
      for (const b of boxes) {
        const apart =
          r.x >= b.x + b.w + 2 - 1e-9 ||
          r.x + r.w <= b.x - 2 + 1e-9 ||
          r.y >= b.y + b.h + 2 - 1e-9 ||
          r.y + r.h <= b.y - 2 + 1e-9;
        assert.ok(apart, JSON.stringify({ r, b }));
      }
    }
    // la grande zone à droite et la bande du dessous sont trouvées
    assert.ok(free.some((r) => r.x >= 92 && r.w >= 100 && r.h >= 89));
    assert.ok(free.some((r) => r.y >= 27 && r.h >= 67));
    // panneau vide : toute la zone utile
    assert.deepEqual(freeRectangles(200, 100, [], 2, 5), [{ x: 5, y: 5, w: 190, h: 90 }]);
  });
});
