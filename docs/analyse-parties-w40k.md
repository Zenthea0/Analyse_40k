# Projet : Analyseur de parties Warhammer 40K

## Objectif

Transformer mes listes d'armée et mes synthèses de fin de partie en données structurées, pour :

1. **Comprendre la méta** et construire des listes performantes, malgré des évolutions qui arrivent presque tous les mois.
2. **Mieux décider quand sacrifier une unité**, en identifiant les situations où je sacrifie trop tôt. Ce point est traité en V2.

## Contexte du joueur

- Joueur compétitif (Necrons), coach de l'équipe AdD.
- Joue en français. L'interface de l'application est en français.
- L'application est utilisée **avant ou après** la partie, jamais pendant.
- Consultation principale sur smartphone (Google Pixel 10A), en format portrait.
- Préfère un projet complet, développé en vibe coding.

## Sources de données

- **Synthèses de partie** : images générées par Tabletop Battles App. L'application ne propose pas d'export structuré. Seules les synthèses **V11** sont traitées. Une synthèse V10 est refusée.
- **Listes d'armée** : export texte copié depuis l'application officielle Games Workshop, via le presse-papiers.
- **Listes adverses** : jamais saisies. Pour chaque partie, je renseigne seulement l'archétype de la liste adverse (voir ci-dessous).

## Architecture

Deux skills Claude produisent deux fichiers JSON. L'application les importe, sans IA.

1. **Skill « liste »** : lit l'export texte et produit un JSON par liste. Livré avec son script `scripts/parse_liste.py`.
2. **Skill « synthèse »** : lit l'image V11 et produit un JSON par partie. Les totaux sont recalculés et contrôlés par `scripts/valider_synthese.py`.

Il n'y a pas de skill d'import. L'application importe directement les deux JSON.

Le format de chaque fichier est décrit dans **`modele-donnees.md`** (version 1.0). Ce document fait référence pour les champs, les types et les règles de calcul.

## Import et saisie dans l'application

- Une partie se crée à partir de son JSON de détail, puis se rattache à une liste : nouveau JSON importé, ou liste déjà importée et réutilisée.
- À l'import, l'application vérifie la structure, les règles de calcul et les doublons (même date, mêmes deux joueurs). Un écart bloque l'enregistrement tant qu'il n'est pas corrigé.
- Après import, tous les champs sont modifiables manuellement. Les valeurs dérivées sont recalculées à partir des valeurs modifiées.
- Les étiquettes personnalisées (voir « Filtres ») sont propres à l'application : elles ne figurent pas dans les JSON.
- Une liste n'est **pas modifiable après une partie**. Une nouvelle version de liste passe par un nouvel import.

**Champs saisis à la main, par partie (facultatifs) :**
- **Unité la plus utile** : une seule, choisie parmi les unités de la liste jouée.
- **Unité la moins utile** : une seule, choisie parmi les unités de la liste jouée.
- **Archétype de la liste adverse** : une seule valeur parmi corps à corps, tir, placement, polyvalence.

## Stockage et sauvegarde

- Les données sont conservées dans le navigateur (IndexedDB), avec demande de stockage persistant.
- L'application propose une **sauvegarde complète dans un fichier** (téléchargeable), et une restauration à partir de ce fichier.
- Une sauvegarde est créée **après chaque import des détails d'une partie**.
- La sauvegarde est le filet de sécurité : une purge du cache peut effacer les données du navigateur, la restauration les remet en place.

## Périmètre de la V1

1. **Import** des deux JSON (liste et partie), avec vérification, détection des doublons et rattachement à une liste.
2. **Modification manuelle** de tous les champs après import, avec recalcul des valeurs dérivées.
3. **Saisie** des trois champs par partie (unité la plus utile, unité la moins utile, archétype adverse).
4. **Sauvegarde et restauration** complètes dans un fichier.
5. **Progression de la partie** : score tour par tour, pour moi et l'adversaire, avec le cumul.
6. **Difficulté des objectifs** :
   - **Secondaires** : chaque secondaire est évalué indépendamment des autres, sous son propre nom. Pour chaque partie, sa valeur est son total final sur les cinq tours (0 s'il n'a jamais été marqué). Sa difficulté est calculée sur la moyenne de ces valeurs, sur toutes les parties où il figure dans la synthèse. Classement : **facile** si la moyenne est supérieure ou égale à 4, **difficile** si elle est inférieure ou égale à 2, **moyenne** sinon. Exemple : « Cleanse » finit à 5 le 21 août, et « No Prisoners » finit à 2 ; avec une seule partie, le premier est facile et le second difficile.
   - **Primaires** : pour chaque mission, moyenne du total primaire final de chaque partie (plafonné à 45). Classement : **facile** si la moyenne est supérieure ou égale à 40, **difficile** si elle est inférieure ou égale à 25, **moyenne** sinon.
   - Pour chaque objectif, le nombre de parties et la moyenne sont affichés avec le classement.
7. **Unités** : nombre de fois où chaque unité est désignée la plus utile, et la moins utile, toutes parties confondues.
8. **Filtres** : l'utilisateur crée ses propres étiquettes (par exemple « fun » ou « compétitive »), avec des valeurs libres. Chaque partie reçoit une valeur par étiquette. Tous les tableaux de bord et statistiques acceptent un ou plusieurs filtres, combinés par « et ». Les étiquettes sont saisies dans l'application et ne figurent pas dans les JSON.
9. **Taux de victoire** (victoires, nuls, défaites et pourcentage de victoires), filtrables, selon :
   - le fait d'avoir commencé ou non,
   - ma faction,
   - la faction adverse,
   - mon adversaire (pseudo),
   - la mission et le type de déploiement,
   - la version de liste jouée,
   - l'archétype adverse.
10. **Affichage portrait** sur smartphone, sans défilement horizontal, avec une marge de 16 px.

## Hors périmètre de la V1

- Carnet des décisions de sacrifice, avec le contexte de chaque décision (V2).
- Filtres sur les unités, les archétypes adverses ou les étiquettes dans le carnet des décisions (V2).
- Saisie ou import des listes adverses.
- Calcul automatique de la meilleure liste.
- Utilisation pendant la partie.
- Partage des données entre joueurs, base commune et synchronisation en temps réel.
- Modification d'une liste après une partie jouée.

## Critères de réussite

- Saisir une partie, de l'import à l'enregistrement, prend moins de deux minutes.
- Aucune incohérence de données ne passe inaperçue.
- L'application répond à ces questions :
  - À quel tour est-ce que je perds ou je gagne des points dans une partie ?
  - Quelles missions et quels objectifs sont faciles ou difficiles pour moi ?
  - Quelles unités sont les plus et les moins utiles ?
  - Avec quelle liste, contre quelle faction et dans quelles conditions ai-je gagné ou perdu ?
- Les données survivent à une purge du cache du navigateur, grâce à la sauvegarde.

## Décisions

- **Secondaires** : une seule valeur par partie en V1, son total sur les cinq tours. Les secondaires « fixes » seront traités en V2.
- **Primaires** : difficulté selon le total final moyen par mission. Facile à 40 ou plus, difficile à 25 ou moins, moyenne sinon.
- **Sauvegarde** : après chaque import des détails d'une partie.
- **Unité utile et moins utile** : une seule désignation de chaque, par partie.

## Points à confirmer

- **Unité de mesure des secondaires** : les seuils de 4 et 2 s'appliquent-ils à la moyenne du total par partie (recommandé), ou à la moyenne par tour ? Par tour, un secondaire facile donnerait en moyenne 20 points par partie, ce qui dépasse le plafond de 15 par manche, donc le seuil ne serait pratiquement jamais atteint.

## Prochaines étapes

1. Porter les deux scripts en JavaScript pour l'application, ou les garder en Python si l'application les appelle. À trancher dans la conversation de développement.
2. Rédiger le modèle de données de l'application (tables locales, index, sauvegarde) à partir de `modele-donnees.md`.
3. Développer l'application en étapes : import et validation, puis saisie, puis sauvegarde, puis tableaux de bord.
4. Tester chaque étape avec les trois parties réelles (21 août, 25 septembre, 30 octobre 2026) et la liste L3, la liste World Eaters et la liste fun CK.

## Notes pour la conversation de développement

- Avancer par étapes : d'abord l'import et la validation, ensuite la saisie, puis les tableaux de bord.
- Tester chaque étape avec les données réelles avant de passer à la suivante.
- Les skills « liste » et « synthèse » sont déjà testés. Ne pas les modifier sans nouveau test.
- Le format des JSON est figé en version 1.0. Toute évolution de forme passe par une mise à jour du modèle de données.
