import { useRef, useState } from 'react';
import { parseJsonText, checkListeStructure, checkPartieStructure } from '../lib/validation.js';
import { formatDate } from '../lib/format.js';
import { Notice } from './ui.jsx';

const CHECKS = { liste: checkListeStructure, partie: checkPartieStructure };

function describe(kind, obj) {
  if (!obj || typeof obj !== 'object') return 'Entrée invalide';
  if (kind === 'liste') return `${obj.name ?? '?'} · ${obj.faction ?? '?'}`;
  const noms = Array.isArray(obj.players) ? obj.players.map((p) => p?.name).join(' vs ') : '?';
  return `${formatDate(obj.game_date)} · ${noms}`;
}

/**
 * Import d'un JSON par fichier ou par collage. Vérifie la structure puis appelle onData(objet).
 * Un fichier contenant plusieurs entrées propose d'en choisir une (import une par une).
 */
export default function ImportBox({ kind, onData }) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState([]);
  const [choices, setChoices] = useState(null);
  const fileRef = useRef(null);
  const check = CHECKS[kind];
  const noun = kind === 'liste' ? 'liste' : 'partie';

  function analyse(raw) {
    setErrors([]);
    setChoices(null);
    const { data, error } = parseJsonText(raw);
    if (error) return setErrors([error]);
    const candidates = Array.isArray(data) ? data : [data];
    if (!candidates.length) return setErrors(['Le fichier ne contient aucune entrée.']);
    const rows = candidates.map((c) => ({ obj: c, errors: check(c) }));
    if (rows.every((r) => r.errors.length > 0)) {
      // Aucune entrée exploitable : un message clair plutôt qu'une liste de choix grisés.
      return setErrors([...new Set(rows.flatMap((r) => r.errors))].slice(0, 6));
    }
    if (rows.length === 1) return onData(rows[0].obj);
    setChoices(rows);
  }

  async function onFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const t = await f.text();
      setText('');
      analyse(t);
    } catch {
      setErrors(['Impossible de lire ce fichier.']);
    }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFile} />
      <button type="button" className="btn btn-primary btn-block" onClick={() => fileRef.current?.click()}>
        Choisir un fichier JSON
      </button>
      <p className="muted small" style={{ textAlign: 'center' }}>ou coller le contenu du JSON</p>
      <textarea
        className="input"
        rows={5}
        placeholder={`{ "schema_version": "1.0", "type": "${kind}", … }`}
        aria-label={`Contenu JSON de la ${noun}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="actions">
        <button type="button" className="btn" disabled={!text.trim()} onClick={() => analyse(text)}>
          Analyser le texte collé
        </button>
      </div>

      {errors.length > 0 && (
        <Notice kind="error" title="Import impossible">
          <ul>
            {errors.map((m, i) => (
              <li key={i} className="wrap">{m}</li>
            ))}
          </ul>
        </Notice>
      )}

      {choices && (
        <div>
          <Notice kind="info" title={`Ce fichier contient ${choices.length} entrées`}>
            Les entrées s'importent une par une : choisis celle à importer maintenant.
          </Notice>
          {choices.map((c, i) => (
            <button
              key={i}
              type="button"
              className="card"
              disabled={c.errors.length > 0}
              onClick={() => onData(c.obj)}
              style={c.errors.length ? { opacity: 0.55 } : undefined}
            >
              <div className="card-title">{describe(kind, c.obj)}</div>
              {c.errors.length > 0 && <div className="card-sub">Invalide : {c.errors[0]}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
