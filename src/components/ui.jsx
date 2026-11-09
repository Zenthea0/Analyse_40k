import { useState } from 'react';
import { RESULT_LABELS } from '../lib/constants.js';

export function Badge({ kind = 'neutral', children }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

export function ResultBadge({ result }) {
  const kind = { victory: 'win', draw: 'draw', defeat: 'loss' }[result] ?? 'neutral';
  return <Badge kind={kind}>{RESULT_LABELS[result] ?? '?'}</Badge>;
}

export function TypeBadge({ type }) {
  if (!type) return null;
  return <Badge kind={type === 'fun' ? 'fun' : 'comp'}>{type === 'fun' ? 'Fun' : 'Compétitive'}</Badge>;
}

export function Notice({ kind = 'info', title, children }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

export function NoticeList({ kind, title, items }) {
  if (!items.length) return null;
  return (
    <Notice kind={kind} title={title}>
      <ul>
        {items.map((m, i) => (
          <li key={i} className="wrap">{m}</li>
        ))}
      </ul>
    </Notice>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function TextInput({ value, onChange, ...rest }) {
  return <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />;
}

export function NumInput({ value, onChange, label }) {
  return (
    <input
      className="input num"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label={label}
      value={String(value ?? '')}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, '');
        onChange(d === '' ? 0 : parseInt(d, 10));
      }}
    />
  );
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Check({ checked, onChange, children }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Steps({ current, labels }) {
  return (
    <>
      <div className="step-label">
        Étape {current + 1} sur {labels.length} · {labels[current]}
      </div>
      <ol className="steps" aria-hidden="true">
        {labels.map((_, i) => (
          <li key={i} className={i <= current ? 'on' : ''} />
        ))}
      </ol>
    </>
  );
}

export function Screen({ title, back, children }) {
  return (
    <div className="screen">
      <div className="screen-head">
        {back && (
          <a className="back" href={back} aria-label="Retour">
            ←
          </a>
        )}
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}

/** Zone de texte dont le contenu est analysé ; ne remonte la valeur que si elle est valide. */
export function ParsedTextarea({ initial, parse, onValid, rows = 3, label }) {
  const [text, setText] = useState(initial);
  const [errors, setErrors] = useState([]);
  return (
    <>
      <textarea
        className="input"
        rows={rows}
        aria-label={label}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const r = parse(e.target.value);
          setErrors(r.errors);
          if (!r.errors.length) onValid(r.items);
        }}
      />
      {errors.map((m, i) => (
        <span key={i} className="field-hint" style={{ color: 'var(--loss)' }}>
          {m}
        </span>
      ))}
    </>
  );
}
