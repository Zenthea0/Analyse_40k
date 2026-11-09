import { useEffect, useState } from 'react';
import { DataProvider, useData } from './data.jsx';
import Parties from './screens/Parties.jsx';
import PartieDetail from './screens/PartieDetail.jsx';
import Wizard from './screens/Wizard.jsx';
import { Listes, ListeDetail, ListeImportScreen } from './screens/Listes.jsx';
import Stats from './screens/Stats.jsx';
import Settings from './screens/Settings.jsx';
import { Screen, Notice } from './components/ui.jsx';

function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const f = () => {
      setParts(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return parts;
}

const ICONS = {
  parties: <path d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3" />,
  listes: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  stats: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  reglages: <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" />,
};
const TABS = [
  ['parties', 'Parties'],
  ['listes', 'Listes'],
  ['stats', 'Stats'],
  ['reglages', 'Réglages'],
];

function TabBar({ current }) {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      <div className="tabbar-inner">
        {TABS.map(([key, label]) => (
          <a key={key} href={`#/${key}`} aria-current={current === key ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[key]}</svg>
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function Routes() {
  const { loading, error } = useData();
  const [tab = 'parties', sub] = useRoute();

  let view;
  if (loading) view = <Screen title="Analyse 40k"><p className="muted">Chargement…</p></Screen>;
  else if (error)
    view = (
      <Screen title="Erreur">
        <Notice kind="error" title="Impossible d'ouvrir la base locale">
          {error}
        </Notice>
        <p className="muted small">
          Le navigateur bloque peut-être le stockage local (navigation privée ?). Ouvre l'application dans une fenêtre
          normale.
        </p>
      </Screen>
    );
  else if (tab === 'parties') {
    view = sub === 'nouvelle' ? <Wizard /> : sub ? <PartieDetail id={sub} /> : <Parties />;
  } else if (tab === 'listes') {
    view = sub === 'importer' ? <ListeImportScreen /> : sub ? <ListeDetail id={sub} /> : <Listes />;
  } else if (tab === 'stats') view = <Stats />;
  else if (tab === 'reglages') view = <Settings />;
  else view = <Parties />;

  return (
    <>
      {view}
      <TabBar current={tab} />
    </>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Routes />
    </DataProvider>
  );
}
