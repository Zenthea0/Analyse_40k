import { useEffect, useRef, useState } from 'react';
import { Screen, Notice, Field } from '../components/ui.jsx';
import { useData } from '../data.jsx';
import {
  exportBackup,
  backupFileName,
  checkBackup,
  restoreBackup,
  addLabel,
  renameLabel,
  deleteLabel,
} from '../lib/store.js';
import { parseJsonText } from '../lib/validation.js';
import { downloadJson } from '../lib/download.js';
import { isPersisted, requestPersistence } from '../lib/db.js';

export default function Settings() {
  const { labels, listes, parties, reload } = useData();
  const [msg, setMsg] = useState(null);
  const [persisted, setPersisted] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    isPersisted().then(setPersisted);
  }, []);

  const fail = (e) => setMsg({ kind: 'error', text: e.message || String(e) });

  async function onRestore(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const { data, error } = parseJsonText(await f.text());
      if (error) throw new Error(error);
      const s = checkBackup(data);
      const when = s.exported_at ? new Date(s.exported_at).toLocaleString('fr-FR') : 'date inconnue';
      const ok = window.confirm(
        `Remplacer toutes les données actuelles par cette sauvegarde (${when}) ?\n${s.parties} partie(s), ${s.listes} liste(s), ${s.labels} étiquette(s).\nLes données actuelles seront perdues.`
      );
      if (!ok) return;
      await restoreBackup(data);
      await reload();
      setMsg({ kind: 'ok', text: `Sauvegarde restaurée : ${s.parties} partie(s), ${s.listes} liste(s).` });
    } catch (err) {
      fail(err);
    }
  }

  return (
    <Screen title="Réglages">
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <h2>Sauvegarde</h2>
      <p className="muted small">
        Les données restent dans ce navigateur. Une purge du cache peut les effacer : la sauvegarde est ton filet de
        sécurité. Elle est téléchargée automatiquement après chaque partie enregistrée.
      </p>
      <p className="small">
        {listes.length} liste(s) · {parties.length} partie(s)
      </p>
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            try {
              downloadJson(backupFileName(), await exportBackup());
              setMsg({ kind: 'ok', text: 'Sauvegarde téléchargée.' });
            } catch (e) {
              fail(e);
            }
          }}
        >
          Télécharger une sauvegarde
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onRestore} />
        <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
          Restaurer depuis un fichier
        </button>
      </div>
      <p className="small">
        Stockage persistant : <b>{persisted === null ? '…' : persisted ? 'accordé' : 'non accordé'}</b>
      </p>
      {persisted === false && (
        <div className="actions">
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              await requestPersistence();
              setPersisted(await isPersisted());
            }}
          >
            Demander le stockage persistant
          </button>
        </div>
      )}

      <h2>Étiquettes personnalisées</h2>
      <p className="muted small">
        Chaque partie peut recevoir une valeur libre par étiquette (par exemple « Lieu » ou « Format »). Elles serviront de
        filtres dans les statistiques. Le type compétitive / fun est déjà intégré.
      </p>
      {labels.map((l) => (
        <LabelRow key={l.id} label={l} onError={fail} onChanged={reload} />
      ))}
      <Field label="Nouvelle étiquette">
        <input
          className="input"
          value={newLabel}
          placeholder="Nom de l'étiquette"
          onChange={(e) => setNewLabel(e.target.value)}
        />
      </Field>
      <div className="actions">
        <button
          type="button"
          className="btn"
          disabled={!newLabel.trim()}
          onClick={async () => {
            try {
              await addLabel(newLabel);
              setNewLabel('');
              await reload();
            } catch (e) {
              fail(e);
            }
          }}
        >
          Ajouter l'étiquette
        </button>
      </div>

      <h2>Listes</h2>
      <div className="actions">
        <a className="btn" href="#/listes/importer">
          Importer une liste seule
        </a>
      </div>

      <hr />
      <p className="muted small">Analyse 40k · version 0.1 · format de données 1.0 · aucune donnée ne quitte ton appareil.</p>
    </Screen>
  );
}

function LabelRow({ label, onError, onChanged }) {
  const [name, setName] = useState(label.name);
  return (
    <div className="card">
      <div className="row2" style={{ gridTemplateColumns: '1fr auto auto' }}>
        <input className="input" aria-label="Nom de l'étiquette" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          type="button"
          className="btn btn-sm"
          disabled={!name.trim() || name.trim() === label.name}
          onClick={async () => {
            try {
              await renameLabel(label.id, name);
              await onChanged();
            } catch (e) {
              onError(e);
            }
          }}
        >
          Renommer
        </button>
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={async () => {
            if (!window.confirm(`Supprimer l'étiquette « ${label.name} » et ses valeurs dans toutes les parties ?`)) return;
            try {
              await deleteLabel(label.id);
              await onChanged();
            } catch (e) {
              onError(e);
            }
          }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
