/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* Projet en cours : pièces, fichiers importés, panneaux et réglages de calcul. */

import { createExampleProject } from "./example.js";

export const state = createExampleProject();

state.rotAll = "quarter";

// kits nommés : [{ id, name, fill }] (voir src/project/kits.js) ; une pièce y entre par type.kit = id
state.kits = [];

state.sort = "file";

// fichier .nestor du dossier choisi d'où vient le projet (voir src/project/folder-store.js), ou null
state.folderFile = null;
