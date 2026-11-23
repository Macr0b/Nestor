# Compteur d'exports de Nestor

Petit serveur qui compte, de façon anonyme, les fichiers exportés depuis le site officiel de Nestor
(nombre par jour, par format et par version). Il tourne chez Cloudflare (offre gratuite), pas sur un serveur à soi :
réinstaller un ordinateur ou un serveur n'y change rien.

## Ce qui est compté, et ce qui ne l'est pas

- L'appli envoie, à chaque export, un message de trois informations : `{"e":"export","f":"dxf","v":"1.10.0"}`.
- Le serveur ajoute 1 au total de la ligne (jour, format, version). C'est tout ce qui est gardé.
- Pas de cookie, pas d'identifiant, pas d'adresse IP, pas de nom de fichier ni de contenu de projet, pas de journal
  des requêtes (`observability` coupé dans `wrangler.toml`).
- Rien n'est envoyé depuis une copie de l'appli, depuis la version Claude, hors connexion, ou si la case
  « Compter mes exports, anonymement » est décochée dans les Réglages.
- Seuls les sites `https://macr0b.github.io` et `https://nestor.rophistudio.fr` peuvent envoyer ; tout message mal
  formé ou trop long est refusé.
- Les chiffres (`/` et `/counts.csv`) ne s'affichent qu'au propriétaire, derrière Cloudflare Access. Si Access
  n'est pas réglé, la page reste fermée à tous.

## Fichiers

| Fichier | Rôle |
|---|---|
| `worker.js` | Le serveur : réception des exports (`POST /e`), page des chiffres et fichier CSV |
| `schema.sql` | La table de la base D1 : `counts(day, kind, version, n)` |
| `wrangler.toml` | Réglages du déploiement (adresse, base, Access) |

Les tests sont dans `tests/stats/` (lancés avec `npm test`).

## Mise en place (une seule fois)

L'ordre compte, surtout pour le DNSSEC : sinon le domaine peut devenir injoignable quelques heures.

1. **Compte Cloudflare** : créer un compte gratuit sur cloudflare.com.
2. **Ajouter le domaine** `rophistudio.fr` dans Cloudflare (offre Free). Cloudflare reprend les lignes DNS
   existantes : vérifier qu'elles y sont toutes (site, courriel…).
3. **DNSSEC chez OVH** : le désactiver d'abord (Domaines → rophistudio.fr → DNSSEC), puis attendre que ce soit fait.
4. **Serveurs DNS chez OVH** : remplacer ceux d'OVH par les deux serveurs donnés par Cloudflare. Attendre que
   Cloudflare affiche le domaine « Actif ».
5. **DNSSEC chez Cloudflare** : l'activer (DNS → Settings), puis recopier l'enregistrement DS donné par Cloudflare
   dans la zone DNSSEC d'OVH.
6. **Base D1** : dans ce dossier, `npx wrangler login`, puis `npx wrangler d1 create nestor-stats` ; recopier
   l'identifiant affiché dans `wrangler.toml` (`database_id`), puis
   `npx wrangler d1 execute nestor-stats --remote --file=schema.sql`.
7. **Cloudflare Access** (Zero Trust, offre gratuite) : créer une application « Self-hosted » pour
   `stats.nestor.rophistudio.fr`, accès réservé à ton adresse e-mail, avec une seconde règle « Bypass » pour tout
   le monde sur le chemin `/e` (sinon les exports ne pourraient pas être comptés). Recopier dans `wrangler.toml` le
   nom de l'équipe (`ACCESS_TEAM`, le début de `xxx.cloudflareaccess.com`) et l'identifiant AUD de l'application
   (`ACCESS_AUD`).
8. **Déployer** : `npx wrangler deploy`. L'adresse `stats.nestor.rophistudio.fr` est créée toute seule.
9. **Vérifier** : exporter un fichier depuis le site, puis ouvrir `https://stats.nestor.rophistudio.fr` (connexion
   Access par e-mail) : la ligne du jour doit apparaître.

Un programme qui met à jour les DNS chez OVH (par exemple pour un serveur maison) doit être arrêté ou réglé pour
Cloudflare après l'étape 4 : les DNS ne sont plus chez OVH.
