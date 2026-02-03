import { initDatabase, execute, queryOne, saveDatabase } from './database';
import { sparePartsData } from './data/sparePartsData';
import { moData } from './data/moData';

async function seed() {
  console.log('Initializing database...');
  await initDatabase();

  // Check if data already exists
  const existingCategory = queryOne<{ count: number }>('SELECT COUNT(*) as count FROM categories');
  if (existingCategory && existingCategory.count > 0) {
    console.log('Database already contains data. Skipping seed.');
    return;
  }

  console.log('Seeding spare parts data...');
  seedCategories(sparePartsData, 'spare_parts');

  console.log('Seeding MO data...');
  seedCategories(moData, 'mo');

  saveDatabase();
  console.log('Seed completed successfully!');
}

function seedCategories<T extends Record<string, unknown>>(
  categories: { name: string; subcategories: { name: string; items: T[] }[] }[],
  type: 'spare_parts' | 'mo'
) {
  for (const category of categories) {
    // Insert category
    execute(
      `INSERT INTO categories (name, type) VALUES (?, ?)`,
      [category.name, type]
    );

    const categoryRow = queryOne<{ id: number }>(
      `SELECT id FROM categories WHERE name = ? AND type = ?`,
      [category.name, type]
    );

    if (!categoryRow) continue;

    for (const subcategory of category.subcategories) {
      // Insert subcategory
      execute(
        `INSERT INTO subcategories (name, category_id) VALUES (?, ?)`,
        [subcategory.name, categoryRow.id]
      );

      const subcategoryRow = queryOne<{ id: number }>(
        `SELECT id FROM subcategories WHERE name = ? AND category_id = ?`,
        [subcategory.name, categoryRow.id]
      );

      if (!subcategoryRow) continue;

      for (const item of subcategory.items) {
        // Handle field name differences between spare parts and MO
        const lastMovementDate = (item.lastMovementDate || item.lastUseDate || '') as string;

        // Insert item
        execute(
          `INSERT INTO items (id, name, quantity, unit, price, supplier, ttn_number, last_movement_date, status, written_off_date, subcategory_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.name,
            item.quantity,
            item.unit,
            item.price,
            item.supplier || null,
            item.ttnNumber || null,
            lastMovementDate || null,
            item.status || 'in stock',
            item.writtenOffDate || null,
            subcategoryRow.id
          ]
        );

        // Insert movements
        const movements = (item.movements || []) as {
          id: string;
          date: string;
          type: string;
          quantity: number;
          pricePerUnit?: number;
          supplier?: string;
          ttnNumber?: string;
          notes?: string;
        }[];

        for (const movement of movements) {
          execute(
            `INSERT INTO movements (id, item_id, date, type, quantity, price_per_unit, supplier, ttn_number, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              movement.id,
              item.id,
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
    }
  }
}

seed().catch(console.error);
