import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const idOf = (client) => client.id || client._id;

/** Organizations a superadmin can switch between, kept in one place for the bar and the picker. */
export function useClientOptions(enabled) {
  const { activeClientId, selectActiveClient } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/clients');
      const next = response.data?.data?.clients || [];
      setClients(next);
      return next;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
    else setClients([]);
  }, [enabled, reload]);

  /** A tenant that was removed or deactivated can no longer stay selected. */
  useEffect(() => {
    if (!enabled || !activeClientId || clients.length === 0) return;
    const still = clients.some((client) => idOf(client) === activeClientId && client.isActive !== false);
    if (!still) selectActiveClient('');
  }, [clients, activeClientId, enabled, selectActiveClient]);

  const selected = clients.find((client) => idOf(client) === activeClientId) || null;
  return { clients, selected, loading, reload, select: selectActiveClient };
}
