import { useState } from 'react';
import ImportBox from './ImportBox.jsx';
import ListeEditor from './ListeEditor.jsx';
import { Check, Notice, NoticeList } from './ui.jsx';
import { normalizeListe, listeWarnings } from '../lib/validation.js';
import { analyseListe } from '../lib/signature.js';
import { saveListe } from '../lib/store.js';
import { useData } from '../data.jsx';

/**
 * Import d'une liste : fichier ou collage -> revue modifiable -> enregistrement.
 * - même contenu qu'une liste existante : on propose de la réutiliser (c'est la même liste) ;
 * - même nom mais contenu différent : renommage obligatoire.
 * onDone(listeId) est appelé quand une liste est enregistrée ou réutilisée.
 */
export default function ListeImportFlow({ onDone }) {
  const { listes, reload } = useData();
  const [draft, setDraft] = useState(null);
  const [fileWarnings, setFileWarnings] = useState([]);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!draft) {
    return (
      <ImportBox
        kind="liste"
        onData={(obj) => {
          const { liste, fileWarnings: fw } = normalizeListe(obj);
          setDraft(liste);
          setFileWarnings(fw);
          setAck(false);
          setError(null);
        }}
      />
    );
  }

  const live = listeWarnings(draft);
  const { duplicateOf, nameConflict } = analyseListe(draft, listes);
  const needAck = (fileWarnings.length > 0 || live.length > 0) && !duplicateOf;
  const emptyName = !draft.name.trim();

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const id = await saveListe(draft);
      await reload();
      onDone(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <NoticeList kind="warn" title="Avertissements du fichier" items={fileWarnings} />
      <NoticeList kind="warn" title="Contrôles actuels de la liste" items={live} />
      {duplicateOf && (
        <Notice kind="info" title="Cette liste existe déjà">
          Son contenu est identique à celui de « {duplicateOf.name} » : c'est la même liste. Si tu la modifies même
          légèrement, elle deviendra une liste différente.
        </Notice>
      )}
      {nameConflict && !duplicateOf && (
        <Notice kind="error" title="Nom déjà utilisé">
          Une liste différente s'appelle déjà « {nameConflict.name} ». Renomme celle-ci avant de l'enregistrer.
        </Notice>
      )}

      <ListeEditor liste={draft} onChange={setDraft} />

      {needAck && <Check checked={ack} onChange={setAck}>J'ai pris connaissance des avertissements.</Check>}
      {error && <Notice kind="error">{error}</Notice>}

      <div className="actions">
        <button type="button" className="btn" onClick={() => setDraft(null)}>
          Importer un autre fichier
        </button>
        {duplicateOf ? (
          <button type="button" className="btn btn-primary" onClick={() => onDone(duplicateOf.id)}>
            Utiliser « {duplicateOf.name} »
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || emptyName || !!nameConflict || (needAck && !ack)}
            onClick={save}
          >
            Enregistrer la liste
          </button>
        )}
      </div>
    </div>
  );
}
