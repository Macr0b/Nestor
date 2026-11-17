/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* « Saisir à la main » : ajout de pièces rectangulaires (nom, longueur, largeur, quantité, sens fixe), une par une
   ou collées depuis un tableur. Elles rejoignent la liste des pièces, où elles se modifient comme les autres. */

import { translate } from "../i18n/i18n.js";
import { newManualPart, parsePastedParts } from "../project/manual-parts.js";
import { schedulePreferencesSave } from "../project/preferences.js";
import { state } from "../project/state.js";
import { session } from "../session.js";
import { byId } from "../util/dom.js";
import { lengthUnits } from "../util/units.js";
import { readLengthField, setLengthField } from "./lengths.js";
import { renderAll } from "./render-all.js";

/* Ajoute des pièces au projet ; l'exemple du premier lancement laisse alors la place. */
function addManualParts(parts) {
  if (state.example) {
    state.files = [];
    state.types = [];
    state.example = false;
    state.name = "";
    state.source = "";
    state.info = null;
  }
  let ord = state.types.reduce(function (max, t) {
    return Math.max(max, t.ord || 0);
  }, 0);
  parts.forEach(function (p) {
    p.ord = ++ord;
    state.types.push(p);
  });
  session.lastResult = null;
  schedulePreferencesSave();
  renderAll();
}

function showMessage(text) {
  byId("manualMsg").textContent = text;
}

// champs de cotes selon les unités choisies (nombre, ou texte pour les fractions de pouce)
function prepareLengthFields() {
  ["manL", "manW"].forEach(function (id) {
    // la saisie en cours est gardée telle quelle
    const field = byId(id),
      typed = field.value;
    setLengthField(field, "");
    field.value = typed;
  });
}

function showSource(source) {
  const manual = source === "manual";
  byId("srcChoice")
    .querySelectorAll("[data-src]")
    .forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.src === source));
    });
  byId("manualForm").hidden = !manual;
  byId("srcFilePane").hidden = manual;
  if (manual) {
    prepareLengthFields();
    byId("manName").focus();
  }
}

function addFromForm() {
  const part = newManualPart({
    name: byId("manName").value,
    length: readLengthField(byId("manL")),
    width: readLengthField(byId("manW")),
    qty: byId("manQty").value === "" ? 1 : Number(byId("manQty").value),
    fixed: byId("manFixed").checked
  });
  if (!part) {
    showMessage(translate("manual.needSize"));
    byId(readLengthField(byId("manL")) > 0 ? "manW" : "manL").focus();
    return;
  }
  addManualParts([part]);
  showMessage(translate("manual.added", { n: 1 }));
  byId("manName").value = "";
  byId("manL").value = "";
  byId("manW").value = "";
  byId("manQty").value = "1";
  byId("manName").focus();
}

/* Lignes collées d'un tableur : toutes ajoutées d'un coup, avec le sens fixe coché ou non. */
function addFromPaste(text) {
  const result = parsePastedParts(text, lengthUnits()),
    fixed = byId("manFixed").checked;
  const parts = result.parts.map(function (p) {
    return newManualPart(Object.assign({ fixed: fixed }, p));
  });
  if (parts.length) addManualParts(parts);
  showMessage(
    [
      parts.length ? translate("manual.added", { n: parts.length }) : translate("manual.pasteNone"),
      result.skipped ? translate("manual.skipped", { n: result.skipped }) : ""
    ]
      .filter(Boolean)
      .join(" ")
  );
}

export function bindManualPartsPanel() {
  byId("srcChoice").addEventListener("click", function (e) {
    const b = e.target.closest("[data-src]");
    if (b) showSource(b.dataset.src);
  });
  byId("manualForm").addEventListener("submit", function (e) {
    e.preventDefault();
    addFromForm();
  });
  // un collage de plusieurs cellules ou lignes, dans n'importe quel champ, ajoute les pièces
  byId("manualForm").addEventListener("paste", function (e) {
    const text = e.clipboardData && e.clipboardData.getData("text/plain");
    if (!text || !/[\t\r\n]/.test(text.trim())) return;
    e.preventDefault();
    addFromPaste(text);
  });
}

/* Unités changées dans les réglages : les champs de cotes suivent. */
export function renderManualPartsPanel() {
  if (!byId("manualForm").hidden) prepareLengthFields();
}
