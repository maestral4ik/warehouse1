// eslint-disable-next-line @typescript-eslint/no-var-requires
const initSqlJs = require('sql.js');

interface Database {
  run(sql: string, params?: unknown[]): Database;
  prepare(sql: string): Statement;
  export(): Uint8Array;
  close(): void;
}

interface Statement {
  bind(params?: unknown[]): boolean;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): boolean;
}
import * as fs from 'fs';
import * as path from 'path';

const DB_PATH = path.join(__dirname, '..', 'warehouse.db');

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer) as Database;
  } else {
    db = new SQL.Database() as Database;
    createTables(db);
  }

  return db;
}

function createTables(db: Database): void {
  // Categories table
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK(type IN ('spare_parts', 'mo'))
    )
  `);

  // Subcategories table
  db.run(`
    CREATE TABLE IF NOT EXISTS subcategories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(name, category_id)
    )
  `);

  // Items table (unified for both spare parts and MO items)
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'pcs',
      price REAL NOT NULL DEFAULT 0,
      supplier TEXT,
      ttn_number TEXT,
      last_movement_date TEXT,
      status TEXT NOT NULL DEFAULT 'in stock',
      written_off_date TEXT,
      subcategory_id INTEGER NOT NULL,
      FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE
    )
  `);

  // Movements table
  db.run(`
    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('incoming', 'outgoing', 'transfer')),
      quantity INTEGER NOT NULL,
      price_per_unit REAL,
      supplier TEXT,
      ttn_number TEXT,
      notes TEXT,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better query performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_subcategory ON items(subcategory_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_movements_item ON movements(item_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id)`);

  saveDatabase();
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function saveDatabase(): void {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Helper function to run a query and get all results
export function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDatabase().prepare(sql);
  stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// Helper function to run a query and get first result
export function queryOne<T>(sql: string, params: unknown[] = []): T | null {
  const results = queryAll<T>(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper function to run an insert/update/delete
export function execute(sql: string, params: unknown[] = []): void {
  getDatabase().run(sql, params);
  saveDatabase();
}

// Get categories with subcategories and items structured for API response
export function getCategoriesWithItems(type: 'spare_parts' | 'mo'): {
  name: string;
  subcategories: {
    name: string;
    items: Record<string, unknown>[];
  }[];
}[] {
  const categories = queryAll<{ id: number; name: string }>(
    `SELECT id, name FROM categories WHERE type = ?`,
    [type]
  );

  return categories.map(cat => {
    const subcategories = queryAll<{ id: number; name: string }>(
      `SELECT id, name FROM subcategories WHERE category_id = ?`,
      [cat.id]
    );

    return {
      name: cat.name,
      subcategories: subcategories.map(sub => {
        const items = queryAll<Record<string, unknown>>(
          `SELECT
            id, name, quantity, unit, price, supplier,
            ttn_number as ttnNumber,
            last_movement_date as lastMovementDate,
            status,
            written_off_date as writtenOffDate
          FROM items WHERE subcategory_id = ?`,
          [sub.id]
        );

        // Add movements to each item
        const itemsWithMovements = items.map(item => {
          const movements = queryAll<Record<string, unknown>>(
            `SELECT
              id, date, type, quantity,
              price_per_unit as pricePerUnit,
              supplier,
              ttn_number as ttnNumber,
              notes
            FROM movements WHERE item_id = ?
            ORDER BY date DESC`,
            [item.id]
          );
          return { ...item, movements };
        });

        return {
          name: sub.name,
          items: itemsWithMovements,
        };
      }),
    };
  });
}
