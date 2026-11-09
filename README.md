# Analyse 40k

Application mobile (PWA, thème sombre, portrait) pour analyser mes parties de Warhammer 40,000 V11.
Tout tourne dans le navigateur : les données restent dans IndexedDB, sans serveur ni IA.

Cadrage et format de données : `docs/analyse-parties-w40k.md` et `docs/modele-donnees.md` (format 1.0).

## État d'avancement

**Étape 1 (livrée)** : import des listes et des parties, vérification (structure, plafonds, totaux, issue, missions),
détection des doublons, revue modifiable, compléments (type compétitive/fun, unités utile/moins utile, archétype
adverse, étiquettes), sauvegarde et restauration, fiche partie avec graphiques, fiches listes.

**À venir** : saisie fine, puis tableaux de bord (onglet Stats : taux de victoire, difficulté des objectifs, unités,
filtres).

## Règles retenues

- Une partie est toujours rattachée à une liste : on choisit ou importe la liste d'abord.
- Une liste est identifiée par son contenu. Contenu identique = même liste (réutilisation proposée). Moindre
  modification = autre liste. Même nom avec un contenu différent : renommage obligatoire.
- Une liste reste modifiable tant qu'aucune partie n'y est rattachée, puis elle est verrouillée.
- À l'import d'une partie, tout écart de calcul ou de cohérence bloque l'enregistrement tant qu'il n'est pas corrigé
  (ou que les valeurs recalculées ne sont pas adoptées explicitement). Un doublon (même date, mêmes pseudos) demande
  une confirmation.
- Plafonds : 15 points par tour et 45 par partie, séparément pour le primaire et les secondaires.
- Une sauvegarde complète est téléchargée après chaque partie enregistrée.

## Développement

```bash
npm install
npm run dev      # serveur local
npm test         # 22 tests (validation, listes, stockage, sauvegarde)
npm run build    # production dans dist/
```

## Publier sur GitHub Pages

1. Créer un dépôt public nommé `Analyse_40k` sur GitHub.
2. Dans ce dossier :
   ```bash
   git remote add origin https://github.com/<compte>/Analyse_40k.git
   git push -u origin main
   ```
3. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
4. Le workflow `.github/workflows/deploy.yml` teste, construit et déploie à chaque push sur `main`.
   L'application sera disponible sur `https://<compte>.github.io/Analyse_40k/`.
5. Sur le Pixel, ouvrir l'adresse dans Chrome puis « Installer l'application ».

Le dépôt est public mais ne contient aucune donnée personnelle : les parties et les listes restent dans le
navigateur de l'appareil.
