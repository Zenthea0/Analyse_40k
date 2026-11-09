import { useState } from 'react';
import { Screen, Steps, Notice, NoticeList, Check } from '../components/ui.jsx';
import ImportBox from '../components/ImportBox.jsx';
import ListeImportFlow from '../components/ListeImportFlow.jsx';
import PartieEditor from '../components/PartieEditor.jsx';
import ExtrasForm, { emptyExtras } from '../components/ExtrasForm.jsx';
import { useData } from '../data.jsx';
import {
  normalizePartie,
  declaredSnapshot,
  applyDerived,
  checkCoherence,
  compareDeclared,
  findDuplicateParties,
} from '../lib/validation.js';
import { savePartie, exportBackup, backupFileName, partiesOfListe } from '../lib/store.js';
import { downloadJson } from '../lib/download.js';
import { formatDate } from '../lib/format.js';

const LABELS = ['Liste jouée', 'Détail de la partie', 'Vérification', 'Compléments'];

export default function Wizard() {
  const { listes, parties, reload } = useData();
  const [step, setStep] = useState('liste');
  const [importingListe, setImportingListe] = useState(false);
  const [listeId, setListeId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [declared, setDeclared] = useState(null);
  const [fileWarnings, setFileWarnings] = useState([]);
  const [ackWarn, setAckWarn] = useState(false);
  const [acceptDup, setAcceptDup] = useState(false);
  const [extras, setExtras] = useState(emptyExtras());
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const liste = listes.find((l) => l.id === listeId);
  const stepIndex = { liste: 0, import: 1, review: 2, extras: 3, done: 3 }[step];

  function chooseListe(id) {
    setListeId(id);
    setImportingListe(false);
    setStep('import');
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const id = await savePartie({ ...applyDerived(draft), liste_id: listeId, ...extras });
      await reload();
      let backupOk = true;
      try {
        downloadJson(backupFileName(), await exportBackup());
      } catch {
        backupOk = false;
      }
      setSaved({ id, backupOk });
      setStep('done');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  // ------------------------------------------------------------ 1. Liste
  if (step === 'liste') {
    const sorted = [...listes].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    return (
      <Screen title="Nouvelle partie" back="#/parties">
        <Steps current={0} labels={LABELS} />
        {importingListe ? (
          <>
            <h2>Importer une liste</h2>
            <ListeImportFlow onDone={chooseListe} />
            <div className="actions">
              <button type="button" className="btn btn-ghost" onClick={() => setImportingListe(false)}>
                ← Retour au choix de la liste
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Quelle liste as-tu jouée ?</p>
            {sorted.length > 0 && (
              <>
                <h2>Réutiliser une liste existante</h2>
                {sorted.map((l) => (
                  <button key={l.id} type="button" className="card" onClick={() => chooseListe(l.id)}>
                    <div className="card-title">{l.name}</div>
                    <div className="card-sub">
                      {l.faction} · {l.total_points} pts · {partiesOfListe(parties, l.id).length} partie(s)
                    </div>
                  </button>
                ))}
                <hr />
              </>
            )}
            <button type="button" className="btn btn-primary btn-block" onClick={() => setImportingListe(true)}>
              Importer une nouvelle liste (JSON)
            </button>
          </>
        )}
      </Screen>
    );
  }

  // ------------------------------------------------------------ 2. Import de la partie
  if (step === 'import') {
    return (
      <Screen title="Nouvelle partie" back="#/parties">
        <Steps current={1} labels={LABELS} />
        <div className="card">
          <div className="card-row">
            <div>
              <div className="card-sub">Liste jouée</div>
              <div className="card-title">{liste?.name}</div>
            </div>
            <button type="button" className="btn btn-sm" onClick={() => setStep('liste')}>
              Changer
            </button>
          </div>
        </div>
        <h2>Importer le détail de la partie</h2>
        <ImportBox
          kind="partie"
          onData={(obj) => {
            const { partie, fileWarnings: fw } = normalizePartie(obj);
            setDraft(partie);
            setDeclared(declaredSnapshot(partie));
            setFileWarnings(fw);
            setAckWarn(false);
            setAcceptDup(false);
            setStep('review');
          }}
        />
      </Screen>
    );
  }

  // ------------------------------------------------------------ 3. Revue
  if (step === 'review') {
    const coherence = checkCoherence(draft);
    const diffs = compareDeclared(declared, draft);
    const ecarts = [...coherence, ...diffs];
    const dups = findDuplicateParties(draft, parties);
    const blocked =
      ecarts.length > 0 || (fileWarnings.length > 0 && !ackWarn) || (dups.length > 0 && !acceptDup);

    return (
      <Screen title="Vérification" back="#/parties">
        <Steps current={2} labels={LABELS} />
        <NoticeList kind="warn" title="Avertissements du fichier" items={fileWarnings} />
        {fileWarnings.length > 0 && (
          <Check checked={ackWarn} onChange={setAckWarn}>
            J'ai pris connaissance des avertissements.
          </Check>
        )}
        {dups.length > 0 && (
          <Notice kind="warn" title="Doublon possible">
            Une partie du {formatDate(dups[0].game_date)} contre les mêmes joueurs est déjà enregistrée.
            <Check checked={acceptDup} onChange={setAcceptDup}>
              Importer quand même.
            </Check>
          </Notice>
        )}
        {ecarts.length > 0 ? (
          <NoticeList
            kind="error"
            title={`${ecarts.length} écart(s) à corriger avant l'enregistrement`}
            items={ecarts}
          />
        ) : (
          <Notice kind="ok" title="Aucun écart">
            Plafonds, totaux, issue et missions sont cohérents.
          </Notice>
        )}
        {diffs.length > 0 && (
          <div className="actions">
            <button
              type="button"
              className="btn"
              onClick={() => setDeclared(declaredSnapshot(applyDerived(draft)))}
            >
              Adopter les valeurs recalculées
            </button>
          </div>
        )}
        {diffs.length > 0 && (
          <p className="muted small">
            Corrige les valeurs brutes (tours, secondaires…) pour retrouver les totaux du fichier, ou adopte le recalcul
            si c'est le fichier qui se trompe.
          </p>
        )}

        <PartieEditor partie={draft} onChange={setDraft} />

        <div className="actions">
          <button type="button" className="btn" onClick={() => setStep('import')}>
            Retour
          </button>
          <button type="button" className="btn btn-primary" disabled={blocked} onClick={() => setStep('extras')}>
            Continuer
          </button>
        </div>
      </Screen>
    );
  }

  // ------------------------------------------------------------ 4. Compléments
  if (step === 'extras') {
    const same = extras.most_useful_unit_id && extras.most_useful_unit_id === extras.least_useful_unit_id;
    return (
      <Screen title="Compléments" back="#/parties">
        <Steps current={3} labels={LABELS} />
        <ExtrasForm liste={liste} value={extras} onChange={setExtras} />
        {error && <Notice kind="error">{error}</Notice>}
        <div className="actions">
          <button type="button" className="btn" onClick={() => setStep('review')}>
            Retour
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !extras.game_type || !!same} onClick={save}>
            Enregistrer la partie
          </button>
        </div>
        <p className="muted small">Une sauvegarde complète est téléchargée après l'enregistrement.</p>
      </Screen>
    );
  }

  // ------------------------------------------------------------ Terminé
  return (
    <Screen title="Partie enregistrée">
      <Notice kind="ok" title="C'est enregistré">
        {saved?.backupOk
          ? 'Une sauvegarde complète vient d\'être téléchargée.'
          : 'La sauvegarde automatique n\'a pas pu être créée : télécharge-la depuis les Réglages.'}
      </Notice>
      <div className="actions">
        <a className="btn btn-primary" href={`#/parties/${saved?.id}`}>
          Voir la partie
        </a>
        <button
          type="button"
          className="btn"
          onClick={async () => downloadJson(backupFileName(), await exportBackup())}
        >
          Télécharger la sauvegarde
        </button>
        <a className="btn" href="#/parties">
          Retour aux parties
        </a>
      </div>
    </Screen>
  );
}
