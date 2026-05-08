import { synchronize } from '@nozbe/watermelondb/sync';
import { database } from '../database';
import { supabase } from './supabase';

export async function syncData() {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) => {
      // 1. Puxar mudanças do Supabase
      const { data, error } = await supabase.rpc('pull_watermelon_changes', {
        last_pulled_at: lastPulledAt || 0,
        schema_version: schemaVersion,
      });

      if (error) {
        throw new Error(`Falha no Pull: ${error.message}`);
      }

      return {
        changes: data.changes,
        timestamp: data.timestamp,
      };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      // 2. Enviar mudanças locais para o Supabase
      const { error } = await supabase.rpc('push_watermelon_changes', {
        changes,
        last_pulled_at: lastPulledAt,
      });

      if (error) {
        throw new Error(`Falha no Push: ${error.message}`);
      }
    },
    migrationsEnabledAtVersion: 1,
  });
}
