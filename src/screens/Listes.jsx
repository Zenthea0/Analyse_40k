import { useState } from 'react';
import { Screen, Notice, Badge } from '../components/ui.jsx';
import ListeEditor from '../components/ListeEditor.jsx';
import ListeImportFlow from '../components/ListeImportFlow.jsx';
import { useData } from '../data.jsx';
import { partiesOfListe, updateListe, deleteListe } from '../lib/store.js';
import { listeWarnings } from '../lib/validation.js';
import { analyseListe } from '../lib/signature.js';
import { formatCountLines, formatDate, getMe, getOpp } from '../lib/format.js';
import { NoticeList } from '../components/ui.jsx';

export function Listes() {
  const { listes, parties } = useData();
  const sorted = [...listes].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return (
    <Screen title="Listes">
      <div className="actions">
        <a className="btn btn-primary" href="#/listes/importer">
          + Importer une liste
        </a>
      </div>
      {sorted.length === 0 ? (
        <div className="empty">
          <p>Aucune liste enregistrée.</p>
          <p className="small">Les listes s'importent aussi au début de la saisie d'une partie.</p>
        </div>
      ) : (
        sorted.map((l) => {
          const n = partiesOfListe(parties, l.id).length;
          return (
            <a key={l.id} className="card" href={`#/listes/${l.id}`}>
              <div className="card-row">
                <div className="card-title">{l.name}</div>
                <div className="card-title">{l.total_points} pts</div>
              </div>
              <div className="card-sub">
                {l.faction} · {l.detachments.join(' + ')}
              </div>
              <div className="badges">
                <Badge kind="neutral">{l.units.length} unités</Badge>
                <Badge kind={n > 0 ? 'comp' : 'neutral'}>
                  {n} partie{n > 1 ? 's' : ''}
                  {n > 0 ? ' · verrouillée' : ''}
                </Badge>
              </div>
            </a>
          );
        })
      )}
    </Screen>
  );
}

export function ListeImportScreen() {
  return (
    <Screen title="Importer une liste" back="#/listes">
      <ListeImportFlow onDone={(id) => (window.location.hash = `#/listes/${id}`)} />
    </Screen>
  );
}

export function ListeDetail({ id }) {
  const { listes, parties, loading } = useData();
  const liste = listes.find((l) => l.id === Number(id));
  if (loading) return <Screen title="Liste" back="#/listes"><p className="muted">Chargement…</p></Screen>;
  if (!liste)
    return (
      <Screen title="Liste introuvable" back="#/listes">
        <p>Cette liste n'existe pas (ou plus).</p>
      </Screen>
    );
  return <Inner key={liste.id} liste={liste} played={partiesOfListe(parties, liste.id)} />;
}

function Inner({ liste, played }) {
  const { listes, reload } = useData();
  const [editing, setEditing] = useState(false);
  const locked = played.length > 0;

  if (editing) return <Edit liste={liste} listes={listes} onDone={async (c) => { if (c) await reload(); setEditing(false); }} />;

  const byId = new Map(liste.units.map((u) => [u.id, u]));
  return (
    <Screen title={liste.name} back="#/listes">
      <div className="card">
        <dl className="kv">
          <dt>Faction</dt>
          <dd>{liste.faction}</dd>
          <dt>Détachements</dt>
          <dd>{liste.detachments.join(' + ') || '—'}</dd>
          <dt>Disposition</dt>
          <dd>{liste.strategy}</dd>
          <dt>Points</dt>
          <dd>
            {liste.total_points} pts (bataille de {liste.battle_size ?? '?'})
          </dd>
        </dl>
      </div>

      {locked ? (
        <Notice kind="info" title="Liste verrouillée">
          {played.length} partie(s) sont rattachées à cette liste : elle n'est plus modifiable. Une liste modifiée, même
          légèrement, est une autre liste : importe-la à nouveau.
        </Notice>
      ) : (
        <Notice kind="info">Aucune partie n'est encore rattachée : tu peux encore corriger cette liste.</Notice>
      )}

      <h2>Unités ({liste.units.length})</h2>
      {liste.units.map((u) => (
        <details className="acc" key={u.id}>
          <summary>
            <span className="wrap">
              {u.warlord ? '★ ' : ''}
              {u.name} <span className="muted small">· {u.points ?? '?'} pts</span>
            </span>
          </summary>
          <div className="acc-body">
            <div className="card-sub">
              {[u.unit_type, u.role].filter(Boolean).join(' · ') || 'Unité seule'}
              {liste.attached_groups
                .filter((g) => g.members.includes(u.id))
                .map((g) => ` · avec ${g.members.filter((m) => m !== u.id).map((m) => byId.get(m)?.name).join(', ')}`)}
            </div>
            {u.models.length > 0 && (
              <>
                <h3>Figurines</h3>
                <pre className="small wrap" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{formatCountLines(u.models)}</pre>
              </>
            )}
            {u.wargear.length > 0 && (
              <>
                <h3>Équipement</h3>
                <pre className="small wrap" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{formatCountLines(u.wargear)}</pre>
              </>
            )}
            {u.options.length > 0 && (
              <>
                <h3>Options</h3>
                <p className="small">{u.options.map((o) => `${o.name} (${o.type})`).join(', ')}</p>
              </>
            )}
          </div>
        </details>
      ))}

      <h2>Parties jouées</h2>
      {played.length === 0 ? (
        <p className="muted small">Aucune partie pour l'instant.</p>
      ) : (
        [...played]
          .sort((a, b) => b.game_date.localeCompare(a.game_date))
          .map((p) => (
            <a key={p.id} className="card" href={`#/parties/${p.id}`}>
              <div className="card-title">
                {formatDate(p.game_date)} · {getOpp(p).name}
              </div>
              <div className="card-sub">
                {getMe(p).tournament_score}–{getOpp(p).tournament_score}
              </div>
            </a>
          ))
      )}

      <hr />
      <div className="actions">
        <button type="button" className="btn" disabled={locked} onClick={() => setEditing(true)}>
          Modifier la liste
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={locked}
          onClick={async () => {
            if (!window.confirm(`Supprimer définitivement la liste « ${liste.name} » ?`)) return;
            await deleteListe(liste.id);
            await reload();
            window.location.hash = '#/listes';
          }}
        >
          Supprimer la liste
        </button>
      </div>
      {locked && (
        <p className="muted small">
          Pour modifier ou supprimer cette liste, supprime d'abord les parties qui lui sont rattachées (ou rattache-les à
          une autre liste depuis leur fiche).
        </p>
      )}
    </Screen>
  );
}

function Edit({ liste, listes, onDone }) {
  const [draft, setDraft] = useState(() => structuredClone(liste));
  const [error, setError] = useState(null);
  const { duplicateOf, nameConflict } = analyseListe(draft, listes, liste.id);
  const warnings = listeWarnings(draft);
  return (
    <Screen title="Modifier la liste">
      <NoticeList kind="warn" title="Points d'attention" items={warnings} />
      {duplicateOf && (
        <Notice kind="error" title="Liste identique">
          Le contenu est identique à celui de « {duplicateOf.name} » : ce serait la même liste.
        </Notice>
      )}
      {nameConflict && !duplicateOf && (
        <Notice kind="error" title="Nom déjà utilisé">
          Une liste différente s'appelle déjà « {nameConflict.name} ».
        </Notice>
      )}
      <ListeEditor liste={draft} onChange={setDraft} />
      {error && <Notice kind="error">{error}</Notice>}
      <div className="actions">
        <button type="button" className="btn" onClick={() => onDone(false)}>
          Annuler
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!!duplicateOf || !!nameConflict || !draft.name.trim()}
          onClick={async () => {
            try {
              await updateListe(liste.id, draft);
              onDone(true);
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          Enregistrer
        </button>
      </div>
    </Screen>
  );
}
