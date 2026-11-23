/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Projet en cours : pièces, fichiers importés, panneaux et réglages de calcul. */

import { createExampleProject } from "./example.js";

export const state = createExampleProject();

state.rotAll = "quarter";

// remplissage par kits (pièces cochées « Kit ») : { row, how } comme « Remplir », ou null : un seul kit
state.kitFill = null;

state.sort = "file";
