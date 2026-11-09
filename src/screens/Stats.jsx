import { Screen } from '../components/ui.jsx';
import { useData } from '../data.jsx';

// Les tableaux de bord arrivent à l'étape 4 : filtres, taux de victoire, difficulté des objectifs, unités.
export default function Stats() {
  const { parties } = useData();
  return (
    <Screen title="Stats">
      <div className="empty">
        <p>Les statistiques arrivent à une prochaine étape.</p>
        <p className="small">
          {parties.length} partie(s) sont déjà enregistrées et seront prises en compte : taux de victoire, difficulté des
          objectifs, unités les plus et les moins utiles, points moyens par tour.
        </p>
      </div>
    </Screen>
  );
}
