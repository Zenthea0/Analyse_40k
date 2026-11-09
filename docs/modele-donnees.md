# Modèle de données : fichiers JSON (format 1.0)

Ce document décrit les deux fichiers produits par les skills et importés dans l'application d'analyse. Il sert de contrat : le skill écrit ce format, l'application le lit.

## Principes communs

- Chaque fichier commence par `schema_version` (`"1.0"`) et `type` (`"liste"` ou `"partie"`).
- Un fichier de liste = une version de liste. Un fichier de partie = une partie.
- Les noms (unités, équipements, secondaires, disposition, mission) sont conservés tels qu'écrits dans la source. Pas de normalisation, pas de traduction.
- Les valeurs sont celles de la source. Les totaux sont recalculés par le script du skill, et les écarts avec l'affichage sont signalés dans `warnings`.
- Une valeur absente vaut `null` et n'est jamais inventée.
- Il n'y a pas d'identifiant stable de liste ou de partie dans le fichier. L'application attribue ses propres identifiants à l'import.

## Fichier « liste » (`type: "liste"`)

Produit par le skill « liste » (script `parse_liste.py`), à partir d'un export texte.

| Champ | Type | Règle |
|---|---|---|
| `schema_version` | string | `"1.0"` |
| `type` | string | `"liste"` |
| `name` | string | Nom de la liste, tel qu'exporté (y compris « En entraînement » le cas échéant) |
| `faction` | string | Faction |
| `detachments` | string[] | 1 à 3 détachements, sans points de détachement |
| `strategy` | string | Disposition stratégique (« Éliminez l'Adversaire »), libellé source |
| `battle_size` | integer \| null | Taille de bataille (ex. 2000) |
| `total_points` | integer | Total de l'en-tête (référence) |
| `source` | object | `app_version` (string \| null), `data_version` (string \| null) |
| `attached_groups` | object[] | `{ group: string, members: string[] }`, où `members` contient des identifiants `uNN` |
| `units` | Unit[] | Toutes les unités, quelle que soit leur section |
| `warnings` | string[] | Phrases en français. Vide si aucun problème |

### Unit

| Champ | Type | Règle |
|---|---|---|
| `id` | string | `uNN`, unique dans le fichier, numéroté dans l'ordre d'apparition |
| `name` | string | Nom de l'unité |
| `points` | integer \| null | `null` si l'export ne donne pas de points (signalé) |
| `role` | string \| null | Rôle d'attachement (« Meneur », « Gardes du Corps », « Appui »). `null` si pas d'attachement |
| `unit_type` | string \| null | Type entre parenthèses (« Personnage »). Le suffixe « Ligne » est ignoré (`null`) |
| `warlord` | boolean | `true` pour le seigneur de guerre |
| `models` | `{ count: integer, name: string }[]` | Groupes de figurines avec effectif. `[]` pour une unité à une figurine |
| `wargear` | `{ count: integer, name: string }[]` | Équipement rattaché à l'unité entière, sans découpage par figurine |
| `options` | `{ type: "optimisation" \| "amélioration", name: string }[]` | Optimisations et améliorations |

### Règles de cohérence (liste)

- Exactement un `warlord: true`. Sinon, un avertissement est présent dans `warnings`.
- La somme des `points` est égale à `total_points`. Sinon, un avertissement est présent.
- Chaque `id` est unique, et chaque identifiant de `attached_groups.members` existe dans `units`.

## Fichier « partie » (`type: "partie"`)

Produit par le skill « synthèse » (script `valider_synthese.py`), à partir d'une image V11. Les synthèses V10 ne produisent aucun fichier.

| Champ | Type | Règle |
|---|---|---|
| `schema_version` | string | `"1.0"` |
| `type` | string | `"partie"` |
| `game_date` | string | Format `YYYY-MM-DD` |
| `edition` | string | Toujours `"11e"` |
| `rules_source` | string | « Core Rulebook Missions » |
| `mission_pack` | string | Ex. « Default Missions ». Peut varier dans l'année |
| `deployment` | string | Nom du déploiement (« Tipping Point », « Search and Destroy ») |
| `special_rules` | string | Ex. « None » (aucune règle spéciale en tournoi) |
| `missions` | string[2] | Mission principale de chaque joueur, dans l'ordre de `players` |
| `players` | Player[2] | Exactement deux joueurs |
| `warnings` | string[] | Phrases en français. Vide si aucun problème |

### Player

| Champ | Type | Règle |
|---|---|---|
| `name` | string | Pseudo, tel qu'affiché |
| `is_me` | boolean | `true` pour Zenthea. Exactement un joueur sur deux |
| `faction` | string | Faction |
| `disposition` | string | Disposition des forces (« Purge The Foe »), libellé source |
| `went_first` | boolean | Exactement un joueur sur deux |
| `tournament_score` | integer | Score de tournoi (ex. 14 pour « 14-6 ») |
| `tournament_result` | `"victory"` \| `"draw"` \| `"defeat"` | Issue. Cohérente avec le score |
| `primary` | object | `{ name: string, per_turn: integer[5], raw_total: integer, total: integer }` |
| `secondaries` | object[] | `{ name: string, per_turn: integer[5], total: integer }`, une entrée par secondaire |
| `secondaries_total` | integer | Total plafonné à 45 |
| `battle_ready` | `0` \| `10` | Binaire |
| `battle_points` | integer | `primary.total + secondaries_total + battle_ready` |
| `points_by_turn` | object[5] | `{ tour: 1..5, primaire, secondaires, total, cumul }` |

### Règles de calcul (partie)

- `per_turn` : toujours 5 entiers positifs ou nuls (`-` et case vide valent `0`). Valeurs brutes.
- Primaire : chaque manche plafonnée à 15, puis total plafonné à 45. `primary.raw_total` garde la somme brute.
- Secondaires : pour chaque manche, somme de toutes les secondaires plafonnée à 15 ; le total est plafonné à 45. Le plafond de 15 est indépendant de celui du primaire.
- `points_by_turn[t].cumul` : cumul des points primaires et secondaires, chaque catégorie plafonnée à 45. Le Battle Ready n'est pas réparti par tour.
- `tournament_result` : victoire si `tournament_score` est supérieur à celui de l'adversaire, nul si égal, défaite sinon. Les points de bataille ne décident pas de l'issue.

### Règles de cohérence (partie)

- Exactement un `is_me: true` (Zenthea) et exactement un `went_first: true`.
- `missions[i]` = `players[i].primary.name` pour chaque joueur.
- Tout écart entre un total affiché et le total recalculé est présent dans `warnings`.

## Règles d'import dans l'application

1. Lire `type` et `schema_version`. Refuser si le type ne correspond pas à l'import demandé, ou si la version majeure n'est pas reconnue.
2. Vérifier la structure : champs obligatoires présents, types corrects, tableaux de longueur attendue (5 pour `per_turn`, 2 pour `players` et `missions`).
3. Si `warnings` n'est pas vide, afficher les avertissements et demander une confirmation avant d'enregistrer.
4. Pour une partie, proposer le rattachement à une liste : nouveau JSON de liste, ou liste déjà importée.
5. Vérifier les règles de calcul : plafonds, totaux, Battle Ready, points de bataille, cohérence de l'issue et des `missions`. Un écart bloque l'enregistrement tant qu'il n'est pas corrigé, car il signale un fichier modifié ou mal produit.
6. Vérifier les doublons : une partie est en doublon si une partie déjà enregistrée a la même `game_date` et les mêmes deux joueurs (pseudos). L'application signale le doublon et laisse le choix : annuler, ou importer quand même.
7. Après import, laisser l'utilisateur modifier manuellement tous les champs de la liste et de la partie. Une modification manuelle ne réexécute pas les contrôles du script, mais l'application doit recalculer les totaux dérivés (points de bataille, `points_by_turn`) à partir des valeurs modifiées, et réafficher les écarts éventuels.

## Versionnement

- Format `MAJEUR.MINEUR`.
- Un changement de forme (champ renommé, type changé, champ supprimé) incrémente le majeur. L'application refuse les fichiers d'un autre majeur.
- Un ajout de champ optionnel incrémente le mineur. L'application accepte les fichiers du même majeur.

## Décisions

- **Vérification arithmétique à l'import** : oui. Les règles de calcul sont vérifiées à l'import, et un écart bloque l'enregistrement tant qu'il n'est pas corrigé.
- **Doublons** : oui. Une partie est en doublon si elle a la même `game_date` et les mêmes deux joueurs. L'utilisateur choisit d'annuler ou d'importer quand même.
- **Modification manuelle après import** : oui. L'utilisateur peut modifier tous les champs. Les valeurs dérivées (totaux, points de bataille, `points_by_turn`) sont recalculées à partir des valeurs modifiées, et les écarts sont réaffichés.
