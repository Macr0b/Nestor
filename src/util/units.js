/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Unités d'affichage des longueurs : millimètres (par défaut), pouces décimaux ou pouces en fractions.
   Tout reste en millimètres dans l'appli (pièces, panneaux, calculs, fichiers exportés) : seules la saisie et
   l'affichage sont convertis, donc changer d'unités ne change jamais la taille de rien. */

export const MM_PER_INCH = 25.4;
export const UNIT_SYSTEMS = ["mm", "inch", "fraction"];
export const FRACTION_STEPS = [8, 16, 32, 64];

const UNITS_KEY = "nestor.unites";
const DEFAULT_UNITS = { system: "mm", step: 16 };

function cleanUnits(saved) {
  const units = Object.assign({}, DEFAULT_UNITS);
  if (saved && UNIT_SYSTEMS.includes(saved.system)) units.system = saved.system;
  if (saved && FRACTION_STEPS.includes(saved.step)) units.step = saved.step;
  return units;
}

// unités en cours, relues sur l'appareil au chargement
let current = (function () {
  try {
    return cleanUnits(JSON.parse(localStorage.getItem(UNITS_KEY) || "null"));
  } catch (e) {
    return cleanUnits(null);
  }
})();

export function lengthUnits() {
  return current;
}

export function setLengthUnits(system, step) {
  current = cleanUnits({ system: system, step: step });
  try {
    localStorage.setItem(UNITS_KEY, JSON.stringify(current));
  } catch (e) {}
  return current;
}

export function isImperial(units) {
  return (units || current).system !== "mm";
}

/* Pouces en fraction : 48,8125 → "48 13/16" ; arrondi au pas choisi (1/16 par défaut), fraction réduite. */
export function inchFraction(inches, step) {
  const sign = inches < 0 ? "-" : "";
  let steps = Math.round(Math.abs(inches) * step);
  const whole = Math.floor(steps / step);
  let numerator = steps - whole * step,
    denominator = step;
  while (numerator && numerator % 2 === 0) {
    numerator /= 2;
    denominator /= 2;
  }
  if (!numerator) return sign + whole;
  return sign + (whole ? whole + " " : "") + numerator + "/" + denominator;
}

/* Longueur à afficher (sans unité), dans la langue donnée.
   decimal : pouces toujours en décimal, pour les petites valeurs (copeau par dent…). */
export function formatLength(mm, options) {
  const opts = options || {};
  const units = opts.units || current;
  if (!isFinite(mm)) return "";
  if (units.system === "fraction" && !opts.decimal) return inchFraction(mm / MM_PER_INCH, units.step);
  const value = units.system === "mm" ? mm : mm / MM_PER_INCH;
  const digits = opts.digits != null ? opts.digits : units.system === "mm" ? 1 : 3;
  return new Intl.NumberFormat(opts.locale || "fr-FR", { maximumFractionDigits: digits }).format(value);
}

/* Vitesse d'avance à afficher : mm/min ou pouces/min. */
export function formatFeed(mmPerMinute, options) {
  const opts = options || {};
  const units = opts.units || current;
  const value = units.system === "mm" ? mmPerMinute : mmPerMinute / MM_PER_INCH;
  const digits = units.system === "mm" ? 0 : 1;
  return new Intl.NumberFormat(opts.locale || "fr-FR", { maximumFractionDigits: digits }).format(value);
}

/* Valeur à mettre dans un champ de saisie (point décimal, sans séparateur de milliers). */
export function lengthFieldValue(mm, units) {
  const u = units || current;
  if (mm === "" || mm == null || !isFinite(mm)) return "";
  if (u.system === "fraction") return inchFraction(mm / MM_PER_INCH, u.step);
  if (u.system === "inch") return String(Math.round((mm / MM_PER_INCH) * 10000) / 10000);
  return String(Math.round(mm * 1000) / 1000);
}

function fractionValue(text) {
  const [numerator, denominator] = text.split("/").map(Number);
  return denominator ? numerator / denominator : NaN;
}

/* Lecture d'une longueur saisie, rendue en mm (NaN si illisible).
   Accepte la virgule, les fractions (« 48 13/16 », « 3/4 », « 1-1/2 »), et une unité écrite
   (« 12 mm », « 2 in », « 2" ») qui l'emporte sur les unités choisies. */
export function parseLength(text, units) {
  const u = units || current;
  let s = String(text).trim().toLowerCase().replace(/,/g, ".");
  let unit = u.system === "mm" ? "mm" : "in";
  const suffix = s.match(/\s*(mm|in|inch|inches|″|")$/);
  if (suffix) {
    unit = suffix[1] === "mm" ? "mm" : "in";
    s = s.slice(0, suffix.index).trim();
  }
  const negative = s.startsWith("-");
  if (negative) s = s.slice(1).trim();
  const DECIMAL = /^(\d+(\.\d*)?|\.\d+)$/;
  const FRACTION = /^(\d+)\/(\d+)$/;
  let value = NaN;
  // nombre entier et fraction séparés par une espace ou un tiret : « 48 13/16 », « 1-1/2 »
  const parts = s.split(/[\s-]+/);
  if (parts.length === 1 && DECIMAL.test(parts[0])) value = parseFloat(parts[0]);
  else if (parts.length === 1 && FRACTION.test(parts[0])) value = fractionValue(parts[0]);
  else if (parts.length === 2 && /^\d+$/.test(parts[0]) && FRACTION.test(parts[1]))
    value = parseInt(parts[0], 10) + fractionValue(parts[1]);
  if (negative) value = -value;
  if (!isFinite(value)) return NaN;
  return unit === "mm" ? value : value * MM_PER_INCH;
}

/* Vitesse saisie (mm/min ou pouces/min selon les unités), rendue en mm/min. */
export function parseFeed(text, units) {
  const u = units || current;
  const value = parseFloat(String(text).replace(",", "."));
  if (!isFinite(value)) return NaN;
  return u.system === "mm" ? value : value * MM_PER_INCH;
}

export function feedFieldValue(mmPerMinute, units) {
  const u = units || current;
  if (!isFinite(mmPerMinute)) return "";
  return String(u.system === "mm" ? Math.round(mmPerMinute) : Math.round((mmPerMinute / MM_PER_INCH) * 10) / 10);
}
