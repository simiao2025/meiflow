import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import Transaction from './models/Transaction';

const adapter = new SQLiteAdapter({
  schema,
  // (Opcional) Migrações futuras entram aqui
  jsi: true, // Performance aprimorada
  onSetUpError: error => {
    console.error('Falha ao configurar WatermelonDB:', error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [
    Transaction,
  ],
});
