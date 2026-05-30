import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import schema from './schema';
import Transaction from './models/Transaction';

const adapter = new SQLiteAdapter({
  schema,
  onSetUpError: (error) => {
    console.error('Falha ao configurar SQLite:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Transaction],
});
