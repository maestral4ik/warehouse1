import express from 'express';
import cors from 'cors';
import { initDatabase, getCategoriesWithItems, queryAll, queryOne, execute, saveDatabase } from './database';
import { StockMovement } from './types';
import { filterCategoriesByMonth, getCurrentMonth, calculateMonthlyBalance } from './services/inventoryFilter';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Helper to sort movements by date descending
function sortMovementsByDate(movements: StockMovement[]): StockMovement[] {
  return [...movements].sort((a, b) => {
    const [dayA, monthA, yearA] = a.date.split('.').map(Number);
    const [dayB, monthB, yearB] = b.date.split('.').map(Number);
    const dateA = new Date(yearA, monthA - 1, dayA);
    const dateB = new Date(yearB, monthB - 1, dayB);
    return dateB.getTime() - dateA.getTime();
  });
}

// GET spare parts with optional month filter
app.get('/api/spare-parts', (req, res) => {
  const month = (req.query.month as string) || getCurrentMonth();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    return;
  }

  const categories = getCategoriesWithItems('spare_parts');
  const filtered = filterCategoriesByMonth(categories as any, month);
  res.json(filtered);
});

// GET MO items with optional month filter
app.get('/api/mo', (req, res) => {
  const month = (req.query.month as string) || getCurrentMonth();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    return;
  }

  const categories = getCategoriesWithItems('mo');
  const filtered = filterCategoriesByMonth(categories as any, month);
  res.json(filtered);
});

// GET unique suppliers from all items
app.get('/api/suppliers', (req, res) => {
  const suppliers = queryAll<{ supplier: string }>(
    `SELECT DISTINCT supplier FROM items WHERE supplier IS NOT NULL AND supplier != '' ORDER BY supplier`
  );
  res.json(suppliers.map(s => s.supplier));
});

// === MOVEMENT ROUTES ===

// GET movements for spare part
app.get('/api/spare-parts/:itemId/movements', (req, res) => {
  const { itemId } = req.params;
  const item = queryOne<{ id: string }>(`SELECT id FROM items WHERE id = ?`, [itemId]);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const movements = queryAll<StockMovement>(
    `SELECT id, date, type, quantity, price_per_unit as pricePerUnit, supplier, ttn_number as ttnNumber, notes
     FROM movements WHERE item_id = ?`,
    [itemId]
  );
  res.json(sortMovementsByDate(movements));
});

// GET movements for MO item
app.get('/api/mo/:itemId/movements', (req, res) => {
  const { itemId } = req.params;
  const item = queryOne<{ id: string }>(`SELECT id FROM items WHERE id = ?`, [itemId]);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const movements = queryAll<StockMovement>(
    `SELECT id, date, type, quantity, price_per_unit as pricePerUnit, supplier, ttn_number as ttnNumber, notes
     FROM movements WHERE item_id = ?`,
    [itemId]
  );
  res.json(sortMovementsByDate(movements));
});

// POST create movement for spare part
app.post('/api/spare-parts/:itemId/movements', (req, res) => {
  const { itemId } = req.params;
  const movementData = req.body as Omit<StockMovement, 'id'>;

  const item = queryOne<{ id: string }>(`SELECT id FROM items WHERE id = ?`, [itemId]);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  if (!movementData.date || !movementData.type || !movementData.quantity) {
    res.status(400).json({ error: 'Missing required fields: date, type, quantity' });
    return;
  }

  const newId = `m-${Date.now()}`;
  execute(
    `INSERT INTO movements (id, item_id, date, type, quantity, price_per_unit, supplier, ttn_number, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      itemId,
      movementData.date,
      movementData.type,
      movementData.quantity,
      movementData.pricePerUnit || null,
      movementData.supplier || null,
      movementData.ttnNumber || null,
      movementData.notes || null
    ]
  );

  // Recalculate item quantity from all movements
  recalculateItemQuantity(itemId);

  res.status(201).json({ id: newId, ...movementData });
});

// POST create movement for MO item
app.post('/api/mo/:itemId/movements', (req, res) => {
  const { itemId } = req.params;
  const movementData = req.body as Omit<StockMovement, 'id'>;

  const item = queryOne<{ id: string }>(`SELECT id FROM items WHERE id = ?`, [itemId]);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  if (!movementData.date || !movementData.type || !movementData.quantity) {
    res.status(400).json({ error: 'Missing required fields: date, type, quantity' });
    return;
  }

  const newId = `m-${Date.now()}`;
  execute(
    `INSERT INTO movements (id, item_id, date, type, quantity, price_per_unit, supplier, ttn_number, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      itemId,
      movementData.date,
      movementData.type,
      movementData.quantity,
      movementData.pricePerUnit || null,
      movementData.supplier || null,
      movementData.ttnNumber || null,
      movementData.notes || null
    ]
  );

  // Recalculate item quantity from all movements
  recalculateItemQuantity(itemId);

  res.status(201).json({ id: newId, ...movementData });
});

// Helper to recalculate item quantity from movements
function recalculateItemQuantity(itemId: string): number {
  const movements = queryAll<{ type: string; quantity: number }>(
    `SELECT type, quantity FROM movements WHERE item_id = ?`,
    [itemId]
  );

  let total = 0;
  for (const m of movements) {
    if (m.type === 'incoming') {
      total += m.quantity;
    } else if (m.type === 'outgoing') {
      total -= m.quantity;
    }
  }

  const finalQty = Math.max(0, total);
  execute(`UPDATE items SET quantity = ? WHERE id = ?`, [finalQty, itemId]);
  return finalQty;
}

// Recalculate ALL items' quantities from their movements (run at startup)
function recalculateAllItemQuantities(): void {
  const items = queryAll<{ id: string }>(`SELECT id FROM items`);
  for (const item of items) {
    recalculateItemQuantity(item.id);
  }
  console.log(`Recalculated quantities for ${items.length} items`);
}

// PUT update movement for spare part
app.put('/api/spare-parts/:itemId/movements/:movementId', (req, res) => {
  const { itemId, movementId } = req.params;
  const updates = req.body as Partial<StockMovement>;

  const movement = queryOne<StockMovement>(
    `SELECT id FROM movements WHERE id = ? AND item_id = ?`,
    [movementId, itemId]
  );
  if (!movement) {
    res.status(404).json({ error: 'Movement not found' });
    return;
  }

  execute(
    `UPDATE movements SET
      date = COALESCE(?, date),
      type = COALESCE(?, type),
      quantity = COALESCE(?, quantity),
      price_per_unit = COALESCE(?, price_per_unit),
      supplier = COALESCE(?, supplier),
      ttn_number = COALESCE(?, ttn_number),
      notes = COALESCE(?, notes)
     WHERE id = ?`,
    [
      updates.date ?? null,
      updates.type ?? null,
      updates.quantity ?? null,
      updates.pricePerUnit ?? null,
      updates.supplier ?? null,
      updates.ttnNumber ?? null,
      updates.notes ?? null,
      movementId
    ]
  );

  // Recalculate item quantity from all movements
  recalculateItemQuantity(itemId);

  const updated = queryOne<StockMovement>(
    `SELECT id, date, type, quantity, price_per_unit as pricePerUnit, supplier, ttn_number as ttnNumber, notes
     FROM movements WHERE id = ?`,
    [movementId]
  );
  res.json(updated);
});

// PUT update movement for MO item
app.put('/api/mo/:itemId/movements/:movementId', (req, res) => {
  const { itemId, movementId } = req.params;
  const updates = req.body as Partial<StockMovement>;

  const movement = queryOne<StockMovement>(
    `SELECT id FROM movements WHERE id = ? AND item_id = ?`,
    [movementId, itemId]
  );
  if (!movement) {
    res.status(404).json({ error: 'Movement not found' });
    return;
  }

  execute(
    `UPDATE movements SET
      date = COALESCE(?, date),
      type = COALESCE(?, type),
      quantity = COALESCE(?, quantity),
      price_per_unit = COALESCE(?, price_per_unit),
      supplier = COALESCE(?, supplier),
      ttn_number = COALESCE(?, ttn_number),
      notes = COALESCE(?, notes)
     WHERE id = ?`,
    [
      updates.date ?? null,
      updates.type ?? null,
      updates.quantity ?? null,
      updates.pricePerUnit ?? null,
      updates.supplier ?? null,
      updates.ttnNumber ?? null,
      updates.notes ?? null,
      movementId
    ]
  );

  // Recalculate item quantity from all movements
  recalculateItemQuantity(itemId);

  const updated = queryOne<StockMovement>(
    `SELECT id, date, type, quantity, price_per_unit as pricePerUnit, supplier, ttn_number as ttnNumber, notes
     FROM movements WHERE id = ?`,
    [movementId]
  );
  res.json(updated);
});

// DELETE movement for spare part
app.delete('/api/spare-parts/:itemId/movements/:movementId', (req, res) => {
  const { itemId, movementId } = req.params;

  const movement = queryOne<{ id: string }>(
    `SELECT id FROM movements WHERE id = ? AND item_id = ?`,
    [movementId, itemId]
  );
  if (!movement) {
    res.status(404).json({ error: 'Movement not found' });
    return;
  }

  execute(`DELETE FROM movements WHERE id = ?`, [movementId]);

  // Recalculate item quantity from remaining movements
  recalculateItemQuantity(itemId);

  res.json({ success: true, message: 'Movement deleted' });
});

// DELETE movement for MO item
app.delete('/api/mo/:itemId/movements/:movementId', (req, res) => {
  const { itemId, movementId } = req.params;

  const movement = queryOne<{ id: string }>(
    `SELECT id FROM movements WHERE id = ? AND item_id = ?`,
    [movementId, itemId]
  );
  if (!movement) {
    res.status(404).json({ error: 'Movement not found' });
    return;
  }

  execute(`DELETE FROM movements WHERE id = ?`, [movementId]);

  // Recalculate item quantity from remaining movements
  recalculateItemQuantity(itemId);

  res.json({ success: true, message: 'Movement deleted' });
});

// === ITEM ROUTES ===

// DELETE spare part by ID
app.delete('/api/spare-parts/:id', (req, res) => {
  const { id } = req.params;

  const item = queryOne<{ id: string }>(`SELECT id FROM items WHERE id = ?`, [id]);
  if (!item) {
    res.status(404).json({ success: false, message: 'Item not found' });
    return;
  }

  execute(`DELETE FROM movements WHERE item_id = ?`, [id]);
  execute(`DELETE FROM items WHERE id = ?`, [id]);
  res.json({ success: true, message: 'Item deleted' });
});

// DELETE MO item by ID
app.delete('/api/mo/:id', (req, res) => {
  const { id } = req.params;

  const item = queryOne<{ id: string }>(`SELECT id FROM items WHERE id = ?`, [id]);
  if (!item) {
    res.status(404).json({ success: false, message: 'Item not found' });
    return;
  }

  execute(`DELETE FROM movements WHERE item_id = ?`, [id]);
  execute(`DELETE FROM items WHERE id = ?`, [id]);
  res.json({ success: true, message: 'Item deleted' });
});

// UPDATE spare part by ID
app.put('/api/spare-parts/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const item = queryOne<{ id: string; quantity: number }>(`SELECT id, quantity FROM items WHERE id = ?`, [id]);
  if (!item) {
    res.status(404).json({ success: false, message: 'Item not found' });
    return;
  }

  // If quantity is being updated, adjust movements
  if (updates.quantity !== undefined && updates.quantity !== item.quantity) {
    const newQty = updates.quantity;

    // Find the initial incoming movement
    const initialMovement = queryOne<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM movements WHERE item_id = ? AND type = 'incoming' AND notes = 'Первоначальное поступление'`,
      [id]
    );

    if (initialMovement) {
      // Calculate current total from all movements
      const currentTotal = recalculateItemQuantity(id);
      // Calculate what the initial movement quantity should be
      const diff = newQty - currentTotal;
      const newInitialQty = initialMovement.quantity + diff;

      if (newInitialQty >= 0) {
        execute(`UPDATE movements SET quantity = ? WHERE id = ?`, [newInitialQty, initialMovement.id]);
      }
    } else {
      // No initial movement found, create an adjustment movement
      const currentTotal = recalculateItemQuantity(id);
      const diff = newQty - currentTotal;

      if (diff !== 0) {
        const today = new Date();
        const dateStr = today.toLocaleDateString('ru-RU', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        }).replace(/\//g, '.');

        const movementId = `m-${Date.now()}`;
        execute(
          `INSERT INTO movements (id, item_id, date, type, quantity, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [movementId, id, dateStr, diff > 0 ? 'incoming' : 'outgoing', Math.abs(diff), 'Корректировка количества']
        );
      }
    }
  }

  execute(
    `UPDATE items SET
      name = COALESCE(?, name),
      quantity = COALESCE(?, quantity),
      unit = COALESCE(?, unit),
      price = COALESCE(?, price),
      supplier = COALESCE(?, supplier),
      ttn_number = COALESCE(?, ttn_number),
      status = COALESCE(?, status)
     WHERE id = ?`,
    [
      updates.name,
      updates.quantity,
      updates.unit,
      updates.price,
      updates.supplier,
      updates.ttnNumber,
      updates.status,
      id
    ]
  );

  // Recalculate quantity from movements to ensure consistency
  recalculateItemQuantity(id);

  const updated = queryOne(`SELECT * FROM items WHERE id = ?`, [id]);
  res.json({ success: true, item: updated });
});

// UPDATE MO item by ID
app.put('/api/mo/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const item = queryOne<{ id: string; quantity: number }>(`SELECT id, quantity FROM items WHERE id = ?`, [id]);
  if (!item) {
    res.status(404).json({ success: false, message: 'Item not found' });
    return;
  }

  // If quantity is being updated, adjust movements
  if (updates.quantity !== undefined && updates.quantity !== item.quantity) {
    const newQty = updates.quantity;

    // Find the initial incoming movement
    const initialMovement = queryOne<{ id: string; quantity: number }>(
      `SELECT id, quantity FROM movements WHERE item_id = ? AND type = 'incoming' AND notes = 'Первоначальное поступление'`,
      [id]
    );

    if (initialMovement) {
      // Calculate current total from all movements
      const currentTotal = recalculateItemQuantity(id);
      // Calculate what the initial movement quantity should be
      const diff = newQty - currentTotal;
      const newInitialQty = initialMovement.quantity + diff;

      if (newInitialQty >= 0) {
        execute(`UPDATE movements SET quantity = ? WHERE id = ?`, [newInitialQty, initialMovement.id]);
      }
    } else {
      // No initial movement found, create an adjustment movement
      const currentTotal = recalculateItemQuantity(id);
      const diff = newQty - currentTotal;

      if (diff !== 0) {
        const today = new Date();
        const dateStr = today.toLocaleDateString('ru-RU', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        }).replace(/\//g, '.');

        const movementId = `m-${Date.now()}`;
        execute(
          `INSERT INTO movements (id, item_id, date, type, quantity, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [movementId, id, dateStr, diff > 0 ? 'incoming' : 'outgoing', Math.abs(diff), 'Корректировка количества']
        );
      }
    }
  }

  execute(
    `UPDATE items SET
      name = COALESCE(?, name),
      quantity = COALESCE(?, quantity),
      unit = COALESCE(?, unit),
      price = COALESCE(?, price),
      supplier = COALESCE(?, supplier),
      ttn_number = COALESCE(?, ttn_number),
      status = COALESCE(?, status)
     WHERE id = ?`,
    [
      updates.name,
      updates.quantity,
      updates.unit,
      updates.price,
      updates.supplier,
      updates.ttnNumber,
      updates.status,
      id
    ]
  );

  // Recalculate quantity from movements to ensure consistency
  recalculateItemQuantity(id);

  const updated = queryOne(`SELECT * FROM items WHERE id = ?`, [id]);
  res.json({ success: true, item: updated });
});

// CREATE spare part
app.post('/api/spare-parts', (req, res) => {
  const { categoryName, subcategoryName, item } = req.body;

  // Find subcategory
  const subcategory = queryOne<{ id: number }>(
    `SELECT s.id FROM subcategories s
     JOIN categories c ON s.category_id = c.id
     WHERE c.name = ? AND c.type = 'spare_parts' AND s.name = ?`,
    [categoryName, subcategoryName]
  );

  if (!subcategory) {
    res.status(404).json({ success: false, message: 'Category or subcategory not found' });
    return;
  }

  const newId = `sp-${Date.now()}`;
  execute(
    `INSERT INTO items (id, name, quantity, unit, price, supplier, ttn_number, last_movement_date, status, subcategory_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      item.name,
      item.quantity || 0,
      item.unit || 'pcs',
      item.price || 0,
      item.supplier || '',
      item.ttnNumber || '',
      item.lastMovementDate || '',
      item.status || 'in stock',
      subcategory.id
    ]
  );

  // Create initial incoming movement if quantity > 0
  if (item.quantity && item.quantity > 0) {
    const movementId = `m-${Date.now()}`;
    const today = new Date();
    const dateStr = today.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).replace(/\//g, '.');

    execute(
      `INSERT INTO movements (id, item_id, date, type, quantity, price_per_unit, supplier, ttn_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movementId,
        newId,
        dateStr,
        'incoming',
        item.quantity,
        item.price || 0,
        item.supplier || '',
        item.ttnNumber || '',
        'Первоначальное поступление'
      ]
    );
  }

  const newItem = queryOne(`SELECT * FROM items WHERE id = ?`, [newId]);
  res.status(201).json({ success: true, item: newItem });
});

// CREATE MO item
app.post('/api/mo', (req, res) => {
  const { categoryName, subcategoryName, item } = req.body;

  // Find subcategory
  const subcategory = queryOne<{ id: number }>(
    `SELECT s.id FROM subcategories s
     JOIN categories c ON s.category_id = c.id
     WHERE c.name = ? AND c.type = 'mo' AND s.name = ?`,
    [categoryName, subcategoryName]
  );

  if (!subcategory) {
    res.status(404).json({ success: false, message: 'Category or subcategory not found' });
    return;
  }

  const newId = `mo-${Date.now()}`;
  execute(
    `INSERT INTO items (id, name, quantity, unit, price, supplier, ttn_number, last_movement_date, status, subcategory_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId,
      item.name,
      item.quantity || 0,
      item.unit || 'шт',
      item.price || 0,
      item.supplier || '',
      item.ttnNumber || '',
      item.lastUseDate || '',
      item.status || 'in stock',
      subcategory.id
    ]
  );

  // Create initial incoming movement if quantity > 0
  if (item.quantity && item.quantity > 0) {
    const movementId = `m-${Date.now()}`;
    const today = new Date();
    const dateStr = today.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).replace(/\//g, '.');

    execute(
      `INSERT INTO movements (id, item_id, date, type, quantity, price_per_unit, supplier, ttn_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        movementId,
        newId,
        dateStr,
        'incoming',
        item.quantity,
        item.price || 0,
        item.supplier || '',
        item.ttnNumber || '',
        'Первоначальное поступление'
      ]
    );
  }

  const newItem = queryOne(`SELECT * FROM items WHERE id = ?`, [newId]);
  res.status(201).json({ success: true, item: newItem });
});

// WRITE-OFF spare part by ID
app.post('/api/spare-parts/:id/write-off', (req, res) => {
  const { id } = req.params;
  const { quantity, notes, month } = req.body as { quantity: number; notes?: string; month?: string };

  if (!quantity || quantity <= 0) {
    res.status(400).json({ success: false, message: 'Invalid quantity' });
    return;
  }

  const item = queryOne<{ id: string }>(`SELECT id FROM items WHERE id = ?`, [id]);
  if (!item) {
    res.status(404).json({ success: false, message: 'Item not found' });
    return;
  }

  // Get movements for balance calculation
  const movements = queryAll<StockMovement>(
    `SELECT id, date, type, quantity FROM movements WHERE item_id = ?`,
    [id]
  );

  const targetMonth = month || getCurrentMonth();
  const balance = calculateMonthlyBalance(movements, targetMonth);
  const availableQty = balance.openingQty + balance.incomingQty - balance.issuedQty;

  if (quantity > availableQty) {
    res.status(400).json({ success: false, message: `Write-off quantity exceeds available quantity (${availableQty})` });
    return;
  }

  // Generate date for the movement based on smart logic
  let dateStr: string;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNum] = month.split('-').map(Number);
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed

    if (year === currentYear && monthNum === currentMonth) {
      // Current month → use today's date
      dateStr = today.toLocaleDateString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).replace(/\//g, '.');
    } else if (year < currentYear || (year === currentYear && monthNum < currentMonth)) {
      // Previous month → use last day of that month
      const lastDay = new Date(year, monthNum, 0).getDate();
      dateStr = `${String(lastDay).padStart(2, '0')}.${String(monthNum).padStart(2, '0')}.${year}`;
    } else {
      // Future month → use first day of that month
      dateStr = `01.${String(monthNum).padStart(2, '0')}.${year}`;
    }
  } else {
    // No month provided → use today
    const today = new Date();
    dateStr = today.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).replace(/\//g, '.');
  }

  const newMovementId = `m-${Date.now()}`;
  execute(
    `INSERT INTO movements (id, item_id, date, type, quantity, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    [newMovementId, id, dateStr, 'outgoing', quantity, notes || 'Списание']
  );

  res.json({ success: true, item: queryOne(`SELECT * FROM items WHERE id = ?`, [id]) });
});

// WRITE-OFF MO item by ID
app.post('/api/mo/:id/write-off', (req, res) => {
  const { id } = req.params;
  const { quantity, notes, month } = req.body as { quantity: number; notes?: string; month?: string };

  if (!quantity || quantity <= 0) {
    res.status(400).json({ success: false, message: 'Invalid quantity' });
    return;
  }

  const item = queryOne<{ id: string }>(`SELECT id FROM items WHERE id = ?`, [id]);
  if (!item) {
    res.status(404).json({ success: false, message: 'Item not found' });
    return;
  }

  // Get movements for balance calculation
  const movements = queryAll<StockMovement>(
    `SELECT id, date, type, quantity FROM movements WHERE item_id = ?`,
    [id]
  );

  const targetMonth = month || getCurrentMonth();
  const balance = calculateMonthlyBalance(movements, targetMonth);
  const availableQty = balance.openingQty + balance.incomingQty - balance.issuedQty;

  if (quantity > availableQty) {
    res.status(400).json({ success: false, message: `Write-off quantity exceeds available quantity (${availableQty})` });
    return;
  }

  // Generate date for the movement based on smart logic
  let dateStr: string;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNum] = month.split('-').map(Number);
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed

    if (year === currentYear && monthNum === currentMonth) {
      // Current month → use today's date
      dateStr = today.toLocaleDateString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).replace(/\//g, '.');
    } else if (year < currentYear || (year === currentYear && monthNum < currentMonth)) {
      // Previous month → use last day of that month
      const lastDay = new Date(year, monthNum, 0).getDate();
      dateStr = `${String(lastDay).padStart(2, '0')}.${String(monthNum).padStart(2, '0')}.${year}`;
    } else {
      // Future month → use first day of that month
      dateStr = `01.${String(monthNum).padStart(2, '0')}.${year}`;
    }
  } else {
    // No month provided → use today
    const today = new Date();
    dateStr = today.toLocaleDateString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    }).replace(/\//g, '.');
  }

  const newMovementId = `m-${Date.now()}`;
  execute(
    `INSERT INTO movements (id, item_id, date, type, quantity, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    [newMovementId, id, dateStr, 'outgoing', quantity, notes || 'Списание']
  );

  res.json({ success: true, item: queryOne(`SELECT * FROM items WHERE id = ?`, [id]) });
});

// Initialize database and start server
initDatabase()
  .then(() => {
    // Recalculate all item quantities from movements at startup
    recalculateAllItemQuantities();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log('Database initialized successfully');
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
