import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { loadAll } from './lib/store.js';
import { requestPersistence } from './lib/db.js';

const Ctx = createContext(null);

export function DataProvider({ children }) {
  const [state, setState] = useState({ loading: true, error: null, listes: [], parties: [], labels: [] });

  const reload = useCallback(async () => {
    try {
      const d = await loadAll();
      setState({ loading: false, error: null, ...d });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message || String(e) }));
    }
  }, []);

  useEffect(() => {
    reload();
    requestPersistence();
  }, [reload]);

  return <Ctx.Provider value={{ ...state, reload }}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);
