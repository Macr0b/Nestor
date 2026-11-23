/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Police au trait simple (un seul passage de laser ou de fraise par trait) pour les numéros gravés et la
   grille de test laser. Chaque signe est dessiné sur une grille de 4 de large et 6 de haut, Y vers le haut. */

const GLYPH_WIDTH = 4;
const GLYPH_HEIGHT = 6;
// avance d'un signe à l'autre : largeur du signe plus l'espace
const ADVANCE = 5.5;

const DOT = [
  [1.7, 0],
  [2.3, 0],
  [2.3, 0.6],
  [1.7, 0.6],
  [1.7, 0]
];

const GLYPHS = {
  0: [
    [
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 5],
      [3, 6],
      [1, 6],
      [0, 5],
      [0, 1],
      [1, 0]
    ]
  ],
  1: [
    [
      [0.8, 4.8],
      [2, 6],
      [2, 0]
    ],
    [
      [0.8, 0],
      [3.2, 0]
    ]
  ],
  2: [
    [
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 4],
      [0, 0],
      [4, 0]
    ]
  ],
  3: [
    [
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 4],
      [3, 3],
      [1.5, 3]
    ],
    [
      [3, 3],
      [4, 2],
      [4, 1],
      [3, 0],
      [1, 0],
      [0, 1]
    ]
  ],
  4: [
    [
      [3, 0],
      [3, 6],
      [0, 2],
      [4, 2]
    ]
  ],
  5: [
    [
      [4, 6],
      [0, 6],
      [0, 3.5],
      [3, 3.5],
      [4, 2.5],
      [4, 1],
      [3, 0],
      [1, 0],
      [0, 1]
    ]
  ],
  6: [
    [
      [3.5, 6],
      [2, 6],
      [0, 4],
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 2.5],
      [3, 3.5],
      [1, 3.5],
      [0, 2.5]
    ]
  ],
  7: [
    [
      [0, 6],
      [4, 6],
      [1.5, 0]
    ]
  ],
  8: [
    [
      [1, 3],
      [0, 4],
      [0, 5],
      [1, 6],
      [3, 6],
      [4, 5],
      [4, 4],
      [3, 3],
      [1, 3],
      [0, 2],
      [0, 1],
      [1, 0],
      [3, 0],
      [4, 1],
      [4, 2],
      [3, 3]
    ]
  ],
  9: [
    [
      [0.5, 0],
      [2, 0],
      [4, 2],
      [4, 5],
      [3, 6],
      [1, 6],
      [0, 5],
      [0, 3.5],
      [1, 2.5],
      [3, 2.5],
      [4, 3.5]
    ]
  ],
  ".": [DOT],
  ",": [
    [
      [2, 0.6],
      [2, 0],
      [1.4, -1]
    ]
  ],
  "-": [
    [
      [1, 3],
      [3, 3]
    ]
  ],
  "/": [
    [
      [0, 0],
      [4, 6]
    ]
  ],
  "%": [
    [
      [0, 0],
      [4, 6]
    ],
    [
      [0, 6],
      [1.2, 6],
      [1.2, 4.8],
      [0, 4.8],
      [0, 6]
    ],
    [
      [2.8, 1.2],
      [4, 1.2],
      [4, 0],
      [2.8, 0],
      [2.8, 1.2]
    ]
  ],
  P: [
    [
      [0, 0],
      [0, 6],
      [3, 6],
      [4, 5],
      [4, 4],
      [3, 3],
      [0, 3]
    ]
  ],
  V: [
    [
      [0, 6],
      [2, 0],
      [4, 6]
    ]
  ],
  W: [
    [
      [0, 6],
      [1, 0],
      [2, 4],
      [3, 0],
      [4, 6]
    ]
  ],
  m: [
    [
      [0, 0],
      [0, 4]
    ],
    [
      [0, 3],
      [1, 4],
      [1.5, 4],
      [2, 3],
      [2, 0]
    ],
    [
      [2, 3],
      [2.5, 4],
      [3, 4],
      [4, 3],
      [4, 0]
    ]
  ],
  s: [
    [
      [4, 3.5],
      [3.5, 4],
      [0.5, 4],
      [0, 3.5],
      [0, 2.5],
      [4, 1.5],
      [4, 0.5],
      [3.5, 0],
      [0.5, 0],
      [0, 0.5]
    ]
  ],
  "×": [
    [
      [0.5, 1],
      [3.5, 4]
    ],
    [
      [0.5, 4],
      [3.5, 1]
    ]
  ],
  " ": []
};

// signes disponibles (les autres sont ignorés)
export function canWrite(text) {
  return String(text)
    .split("")
    .every(function (c) {
      return Object.prototype.hasOwnProperty.call(GLYPHS, c);
    });
}

// largeur du texte pour une hauteur de chiffre donnée
export function strokeTextWidth(text, height) {
  var n = String(text).length;
  if (!n) return 0;
  return ((n - 1) * ADVANCE + GLYPH_WIDTH) * (height / GLYPH_HEIGHT);
}

/* Traits du texte centré sur (cx, cy), en coordonnées de page (Y vers le bas), hauteur des chiffres = height.
   Renvoie une liste de polylignes ouvertes [[x, y], …]. */
export function strokeText(text, cx, cy, height) {
  var k = height / GLYPH_HEIGHT,
    chars = String(text).split(""),
    left = cx - strokeTextWidth(text, height) / 2,
    lines = [];
  chars.forEach(function (c, index) {
    var glyph = GLYPHS[c];
    if (!glyph) return;
    var x0 = left + index * ADVANCE * k;
    glyph.forEach(function (stroke) {
      lines.push(
        stroke.map(function (v) {
          return [round4(x0 + v[0] * k), round4(cy + height / 2 - v[1] * k)];
        })
      );
    });
  });
  return lines;
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}
