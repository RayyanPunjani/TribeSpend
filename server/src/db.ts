import Database from 'better-sqlite3'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const DB_PATH = process.env.DATABASE_URL || './tribespend.db'
const db = new Database(path.resolve(DB_PATH))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS plaid_items (
    id TEXT PRIMARY KEY,
    access_token TEXT NOT NULL,
    item_id TEXT NOT NULL UNIQUE,
    institution_id TEXT,
    institution_name TEXT,
    last_cursor TEXT,
    last_synced_at TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS plaid_accounts (
    id TEXT PRIMARY KEY,
    plaid_item_id TEXT NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
    plaid_account_id TEXT NOT NULL UNIQUE,
    card_id TEXT,
    name TEXT,
    official_name TEXT,
    type TEXT,
    subtype TEXT,
    mask TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS synced_transaction_ids (
    plaid_transaction_id TEXT PRIMARY KEY,
    plaid_account_id TEXT NOT NULL,
    synced_at TEXT DEFAULT (datetime('now'))
  );
`)

// ── Typed row interfaces ──────────────────────────────────────────────────────

export interface PlaidItemRow {
  id: string
  access_token: string
  item_id: string
  institution_id: string | null
  institution_name: string | null
  last_cursor: string | null
  last_synced_at: string | null
  status: string
  created_at: string
}

export interface PlaidAccountRow {
  id: string
  plaid_item_id: string
  plaid_account_id: string
  card_id: string | null
  name: string | null
  official_name: string | null
  type: string | null
  subtype: string | null
  mask: string | null
  created_at: string
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export const itemQueries = {
  insert: db.prepare<[string, string, string, string | null, string | null]>(`
    INSERT INTO plaid_items (id, access_token, item_id, institution_id, institution_name)
    VALUES (?, ?, ?, ?, ?)
  `),

  findAll: db.prepare<[], PlaidItemRow>(`
    SELECT * FROM plaid_items WHERE status = 'active' ORDER BY created_at DESC
  `),

  findById: db.prepare<[string], PlaidItemRow>(`
    SELECT * FROM plaid_items WHERE id = ?
  `),

  findByItemId: db.prepare<[string], PlaidItemRow>(`
    SELECT * FROM plaid_items WHERE item_id = ?
  `),

  updateCursor: db.prepare<[string, string], void>(`
    UPDATE plaid_items SET last_cursor = ?, last_synced_at = datetime('now') WHERE id = ?
  `),

  updateStatus: db.prepare<[string, string], void>(`
    UPDATE plaid_items SET status = ? WHERE id = ?
  `),

  delete: db.prepare<[string], void>(`
    DELETE FROM plaid_items WHERE id = ?
  `),
}

export const accountQueries = {
  insert: db.prepare<[string, string, string, string | null, string | null, string | null, string | null, string | null]>(`
    INSERT INTO plaid_accounts (id, plaid_item_id, plaid_account_id, name, official_name, type, subtype, mask)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `),

  findByItem: db.prepare<[string], PlaidAccountRow>(`
    SELECT * FROM plaid_accounts WHERE plaid_item_id = ?
  `),

  findByPlaidId: db.prepare<[string], PlaidAccountRow>(`
    SELECT * FROM plaid_accounts WHERE plaid_account_id = ?
  `),

  setCardId: db.prepare<[string, string], void>(`
    UPDATE plaid_accounts SET card_id = ? WHERE plaid_account_id = ?
  `),

  deleteByItem: db.prepare<[string], void>(`
    DELETE FROM plaid_accounts WHERE plaid_item_id = ?
  `),
}

export const syncedIdQueries = {
  insert: db.prepare<[string, string], void>(`
    INSERT OR IGNORE INTO synced_transaction_ids (plaid_transaction_id, plaid_account_id)
    VALUES (?, ?)
  `),

  has: db.prepare<[string], { count: number }>(`
    SELECT COUNT(*) as count FROM synced_transaction_ids WHERE plaid_transaction_id = ?
  `),

  delete: db.prepare<[string], void>(`
    DELETE FROM synced_transaction_ids WHERE plaid_transaction_id = ?
  `),
}

export default db
