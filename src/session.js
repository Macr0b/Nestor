/* Nestor — Copyright 2026 Robin Philippe (Macr0b) — Licence Nestor 1.0 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* État de la session partagé entre modules : dernier résultat calculé, dernière erreur. */

/* signalement de bug : ouvre un nouveau ticket GitHub prérempli (le fichier n'est jamais envoyé) */
// état de la session partagé entre modules : dernier résultat calculé, dernière erreur (pour le signalement de bug)
export const session = { lastResult: null, lastError: "" };
