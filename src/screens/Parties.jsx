import { Screen, ResultBadge, TypeBadge } from '../components/ui.jsx';
import { useData } from '../data.jsx';
import { formatDate, getMe, getOpp } from '../lib/format.js';

export default function Parties() {
  const { parties } = useData();
  const sorted = [...parties].sort(
    (a, b) => b.game_date.localeCompare(a.game_date) || b.id - a.id
  );
  return (
    <Screen title="Parties">
      <div className="actions">
        <a className="btn btn-primary" href="#/parties/nouvelle">
          + Nouvelle partie
        </a>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">
          <p>Aucune partie enregistrée.</p>
          <p className="small">
            Importe d'abord la liste jouée, puis le détail de la partie : l'application vérifie les totaux et les plafonds
            avant d'enregistrer.
          </p>
        </div>
      ) : (
        sorted.map((p) => {
          const me = getMe(p);
          const opp = getOpp(p);
          return (
            <a key={p.id} className="card" href={`#/parties/${p.id}`}>
              <div className="card-row">
                <div className="card-title">
                  {formatDate(p.game_date)} · {opp.name}
                </div>
                <div className="card-title" aria-label={`Score ${me.tournament_score} à ${opp.tournament_score}`}>
                  {me.tournament_score}–{opp.tournament_score}
                </div>
              </div>
              <div className="card-sub">
                {me.faction} contre {opp.faction}
              </div>
              <div className="badges">
                <ResultBadge result={me.tournament_result} />
                <TypeBadge type={p.game_type} />
              </div>
            </a>
          );
        })
      )}
    </Screen>
  );
}
