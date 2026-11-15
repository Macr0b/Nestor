/* Nestor — Copyright 2026 Macr0b — PolyForm Perimeter 1.0.1 (voir LICENSE). Nom et logos réservés (voir TRADEMARK.md). */
/* État de la session partagé entre modules : dernier résultat calculé, dernière erreur. */

/* signalement de bug : ouvre un nouveau ticket GitHub prérempli (le fichier n'est jamais envoyé) */
// état de la session partagé entre modules : dernier résultat calculé, dernière erreur (pour le signalement de bug)
export const session = { lastResult: null, lastError: "" };
