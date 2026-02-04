import { readFileSync } from 'fs';
import { initDatabase, execute, queryOne, saveDatabase } from './database';

interface Movement {
  id: string;
  date: string;
  type: 'incoming' | 'outgoing' | 'transfer';
  quantity: number;
  pricePerUnit?: number;
  supplier?: string;
  ttnNumber?: string;
  notes?: string;
}

interface Item {
  id?: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  supplier?: string;
  ttnNumber?: string;
  lastMovementDate?: string;
  lastUseDate?: string;
  status?: string;
  writtenOffDate?: string;
  movements?: Movement[];
}

interface Subcategory {
  name: string;
  items?: Item[];
}

interface Category {
  name: string;
  subcategories: Subcategory[];
}

interface ImportData {
  spare_parts?: Category[];
  mo?: Category[];
  clearExisting?: boolean;
  defaultMovementDate?: string; // Default date for incoming movements, e.g. "01.01.2026"
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function importFromJson(jsonPath: string) {
  console.log(`Reading JSON file: ${jsonPath}`);

  const fileContent = readFileSync(jsonPath, 'utf-8');
  const data: ImportData = JSON.parse(fileContent);

  console.log('Initializing database...');
  await initDatabase();

  if (data.clearExisting) {
    console.log('Clearing existing data...');
    execute('DELETE FROM movements');
    execute('DELETE FROM items');
    execute('DELETE FROM subcategories');
    execute('DELETE FROM categories');
  }

  const defaultDate = data.defaultMovementDate || '01.01.2026';

  if (data.spare_parts && data.spare_parts.length > 0) {
    console.log('Importing spare parts...');
    importCategories(data.spare_parts, 'spare_parts', defaultDate);
  }

  if (data.mo && data.mo.length > 0) {
    console.log('Importing MO data...');
    importCategories(data.mo, 'mo', defaultDate);
  }

  saveDatabase();
  console.log('Import completed successfully!');
}

function importCategories(categories: Category[], type: 'spare_parts' | 'mo', defaultDate: string) {
  for (const category of categories) {
    // Check if category exists
    let categoryRow = queryOne<{ id: number }>(
      `SELECT id FROM categories WHERE name = ? AND type = ?`,
      [category.name, type]
    );

    if (!categoryRow) {
      // Insert new category
      execute(
        `INSERT INTO categories (name, type) VALUES (?, ?)`,
        [category.name, type]
      );
      categoryRow = queryOne<{ id: number }>(
        `SELECT id FROM categories WHERE name = ? AND type = ?`,
        [category.name, type]
      );
    }

    if (!categoryRow) {
      console.error(`Failed to create category: ${category.name}`);
      continue;
    }

    console.log(`  Category: ${category.name} (id: ${categoryRow.id})`);

    for (const subcategory of category.subcategories) {
      // Check if subcategory exists
      let subcategoryRow = queryOne<{ id: number }>(
        `SELECT id FROM subcategories WHERE name = ? AND category_id = ?`,
        [subcategory.name, categoryRow.id]
      );

      if (!subcategoryRow) {
        // Insert new subcategory
        execute(
          `INSERT INTO subcategories (name, category_id) VALUES (?, ?)`,
          [subcategory.name, categoryRow.id]
        );
        subcategoryRow = queryOne<{ id: number }>(
          `SELECT id FROM subcategories WHERE name = ? AND category_id = ?`,
          [subcategory.name, categoryRow.id]
        );
      }

      if (!subcategoryRow) {
        console.error(`Failed to create subcategory: ${subcategory.name}`);
        continue;
      }

      console.log(`    Subcategory: ${subcategory.name} (id: ${subcategoryRow.id})`);

      if (!subcategory.items) continue;

      for (const item of subcategory.items) {
        const itemId = item.id || generateId(type === 'spare_parts' ? 'sp' : 'mo');
        const lastMovementDate = item.lastMovementDate || item.lastUseDate || null;

        // Convert empty strings to null
        const supplier = item.supplier && item.supplier.trim() !== '' ? item.supplier : null;
        const ttnNumber = item.ttnNumber && item.ttnNumber.trim() !== '' ? item.ttnNumber : null;
        const writtenOffDate = item.writtenOffDate && item.writtenOffDate.trim() !== '' ? item.writtenOffDate : null;

        // Check if item exists
        const existingItem = queryOne<{ id: string }>(
          `SELECT id FROM items WHERE id = ?`,
          [itemId]
        );

        if (existingItem) {
          // Update existing item
          execute(
            `UPDATE items SET name = ?, quantity = ?, unit = ?, price = ?, supplier = ?,
             ttn_number = ?, last_movement_date = ?, status = ?, written_off_date = ?, subcategory_id = ?
             WHERE id = ?`,
            [
              item.name,
              item.quantity,
              item.unit,
              item.price,
              supplier,
              ttnNumber,
              lastMovementDate,
              item.status || 'in stock',
              writtenOffDate,
              subcategoryRow.id,
              itemId
            ]
          );
          console.log(`      Updated item: ${item.name}`);
        } else {
          // Insert new item
          execute(
            `INSERT INTO items (id, name, quantity, unit, price, supplier, ttn_number, last_movement_date, status, written_off_date, subcategory_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              item.name,
              item.quantity,
              item.unit,
              item.price,
              supplier,
              ttnNumber,
              lastMovementDate,
              item.status || 'in stock',
              writtenOffDate,
              subcategoryRow.id
            ]
          );
          console.log(`      Added item: ${item.name}`);
        }

        // Import movements if provided, or create default incoming movement
        if (item.movements && item.movements.length > 0) {
          for (const movement of item.movements) {
            const movementId = movement.id || generateId('m');

            const existingMovement = queryOne<{ id: string }>(
              `SELECT id FROM movements WHERE id = ?`,
              [movementId]
            );

            if (!existingMovement) {
              execute(
                `INSERT INTO movements (id, item_id, date, type, quantity, price_per_unit, supplier, ttn_number, notes)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  movementId,
                  itemId,
                  movement.date,
                  movement.type,
                  movement.quantity,
                  movement.pricePerUnit || null,
                  movement.supplier || null,
                  movement.ttnNumber || null,
                  movement.notes || null
                ]
              );
            }
          }
        } else if (!existingItem && item.quantity > 0) {
          // Create default incoming movement for new items with quantity
          const movementId = generateId('m');
          const movementDate = item.lastMovementDate || item.lastUseDate || defaultDate;

          execute(
            `INSERT INTO movements (id, item_id, date, type, quantity, price_per_unit, supplier, ttn_number, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              movementId,
              itemId,
              movementDate,
              'incoming',
              item.quantity,
              item.price || null,
              supplier,
              ttnNumber,
              'Первоначальное поступление'
            ]
          );
          console.log(`        Created incoming movement: ${item.quantity} ${item.unit}`);
        }
      }
    }
  }
}

// Get JSON file path from command line args
const jsonPath = process.argv[2];

if (!jsonPath) {
  console.log('Usage: npx ts-node src/import-json.ts <path-to-json-file>');
  console.log('');
  console.log('JSON format example:');
  console.log(`{
  "clearExisting": false,
  "spare_parts": [
    {
      "name": "Запчасти",
      "subcategories": [
        {
          "name": "Склад",
          "items": [
            {
              "name": "Item name",
              "quantity": 10,
              "unit": "шт",
              "price": 100.50,
              "supplier": "Supplier",
              "ttnNumber": "TTN-123",
              "status": "in stock",
              "movements": [
                {
                  "date": "01.01.2026",
                  "type": "incoming",
                  "quantity": 10
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "mo": []
}`);
  process.exit(1);
}

importFromJson(jsonPath).catch(console.error);
