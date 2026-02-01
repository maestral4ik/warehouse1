import express from 'express';
import cors from 'cors';
import { sparePartsData } from './data/sparePartsData';
import { moData } from './data/moData';
import { SparePartItem, MOItem, StockMovement } from './types';
import { filterCategoriesByMonth, getCurrentMonth, calculateCurrentStock, calculateMonthlyBalance } from './services/inventoryFilter';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Helper to find item in spare parts data
function findSparePartById(itemId: string): SparePartItem | null {
  for (const category of sparePartsData) {
    for (const subcategory of category.subcategories) {
      const item = subcategory.items.find(item => item.id === itemId);
      if (item) return item;
    }
  }
  return null;
}

// Helper to find item in MO data
function findMOItemById(itemId: string): MOItem | null {
  for (const category of moData) {
    for (const subcategory of category.subcategories) {
      const item = subcategory.items.find(item => item.id === itemId);
      if (item) return item;
    }
  }
  return null;
}

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
// Example: GET /api/spare-parts?month=2026-01
app.get('/api/spare-parts', (req, res) => {
  const month = (req.query.month as string) || getCurrentMonth();

  // Validate month format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    return;
  }

  const filtered = filterCategoriesByMonth(sparePartsData, month);
  res.json(filtered);
});

// GET unique suppliers from all items
app.get('/api/suppliers', (req, res) => {
  const suppliers = new Set<string>();

  // Collect suppliers from spare parts
  for (const category of sparePartsData) {
    for (const subcategory of category.subcategories) {
      for (const item of subcategory.items) {
        if (item.supplier && item.supplier.trim()) {
          suppliers.add(item.supplier.trim());
        }
      }
    }
  }

  // Collect suppliers from MO items
  for (const category of moData) {
    for (const subcategory of category.subcategories) {
      for (const item of subcategory.items) {
        if (item.supplier && item.supplier.trim()) {
          suppliers.add(item.supplier.trim());
        }
      }
    }
  }

  // Return sorted array
  res.json(Array.from(suppliers).sort());
});

// GET MO items with optional month filter
// Example: GET /api/mo?month=2026-01
app.get('/api/mo', (req, res) => {
  const month = (req.query.month as string) || getCurrentMonth();

  // Validate month format (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'Invalid month format. Use YYYY-MM' });
    return;
  }

  const filtered = filterCategoriesByMonth(moData, month);
  res.json(filtered);
});

// === MOVEMENT ROUTES (defined before :id routes to ensure correct matching) ===

// GET movements for spare part
app.get('/api/spare-parts/:itemId/movements', (req, res) => {
  const { itemId } = req.params;
  const item = findSparePartById(itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  res.json(sortMovementsByDate(item.movements || []));
});

// GET movements for MO item
app.get('/api/mo/:itemId/movements', (req, res) => {
  const { itemId } = req.params;
  const item = findMOItemById(itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }
  res.json(sortMovementsByDate(item.movements || []));
});

// POST create movement for spare part
app.post('/api/spare-parts/:itemId/movements', (req, res) => {
  const { itemId } = req.params;
  const movementData = req.body as Omit<StockMovement, 'id'>;

  const item = findSparePartById(itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  if (!movementData.date || !movementData.type || !movementData.quantity) {
    res.status(400).json({ error: 'Missing required fields: date, type, quantity' });
    return;
  }

  const newMovement: StockMovement = {
    id: `m-${Date.now()}`,
    ...movementData,
  };

  item.movements.push(newMovement);
  res.status(201).json(newMovement);
});

// POST create movement for MO item
app.post('/api/mo/:itemId/movements', (req, res) => {
  const { itemId } = req.params;
  const movementData = req.body as Omit<StockMovement, 'id'>;

  const item = findMOItemById(itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  if (!movementData.date || !movementData.type || !movementData.quantity) {
    res.status(400).json({ error: 'Missing required fields: date, type, quantity' });
    return;
  }

  const newMovement: StockMovement = {
    id: `m-${Date.now()}`,
    ...movementData,
  };

  item.movements.push(newMovement);
  res.status(201).json(newMovement);
});

// PUT update movement for spare part
app.put('/api/spare-parts/:itemId/movements/:movementId', (req, res) => {
  const { itemId, movementId } = req.params;
  const updates = req.body as Partial<StockMovement>;

  const item = findSparePartById(itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const movementIndex = item.movements.findIndex((m: StockMovement) => m.id === movementId);
  if (movementIndex === -1) {
    res.status(404).json({ error: 'Movement not found' });
    return;
  }

  item.movements[movementIndex] = { ...item.movements[movementIndex], ...updates, id: movementId };
  res.json(item.movements[movementIndex]);
});

// PUT update movement for MO item
app.put('/api/mo/:itemId/movements/:movementId', (req, res) => {
  const { itemId, movementId } = req.params;
  const updates = req.body as Partial<StockMovement>;

  const item = findMOItemById(itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const movementIndex = item.movements.findIndex((m: StockMovement) => m.id === movementId);
  if (movementIndex === -1) {
    res.status(404).json({ error: 'Movement not found' });
    return;
  }

  item.movements[movementIndex] = { ...item.movements[movementIndex], ...updates, id: movementId };
  res.json(item.movements[movementIndex]);
});

// DELETE movement for spare part
app.delete('/api/spare-parts/:itemId/movements/:movementId', (req, res) => {
  const { itemId, movementId } = req.params;

  const item = findSparePartById(itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const movementIndex = item.movements.findIndex((m: StockMovement) => m.id === movementId);
  if (movementIndex === -1) {
    res.status(404).json({ error: 'Movement not found' });
    return;
  }

  item.movements.splice(movementIndex, 1);
  res.json({ success: true, message: 'Movement deleted' });
});

// DELETE movement for MO item
app.delete('/api/mo/:itemId/movements/:movementId', (req, res) => {
  const { itemId, movementId } = req.params;

  const item = findMOItemById(itemId);
  if (!item) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const movementIndex = item.movements.findIndex((m: StockMovement) => m.id === movementId);
  if (movementIndex === -1) {
    res.status(404).json({ error: 'Movement not found' });
    return;
  }

  item.movements.splice(movementIndex, 1);
  res.json({ success: true, message: 'Movement deleted' });
});

// === END MOVEMENT ROUTES ===

// DELETE spare part by ID
app.delete('/api/spare-parts/:id', (req, res) => {
  const { id } = req.params;

  for (const category of sparePartsData) {
    for (const subcategory of category.subcategories) {
      const index = subcategory.items.findIndex(item => item.id === id);
      if (index !== -1) {
        subcategory.items.splice(index, 1);
        res.json({ success: true, message: 'Item deleted' });
        return;
      }
    }
  }

  res.status(404).json({ success: false, message: 'Item not found' });
});

// DELETE MO item by ID
app.delete('/api/mo/:id', (req, res) => {
  const { id } = req.params;

  for (const category of moData) {
    for (const subcategory of category.subcategories) {
      const index = subcategory.items.findIndex(item => item.id === id);
      if (index !== -1) {
        subcategory.items.splice(index, 1);
        res.json({ success: true, message: 'Item deleted' });
        return;
      }
    }
  }

  res.status(404).json({ success: false, message: 'Item not found' });
});

// UPDATE spare part by ID
app.put('/api/spare-parts/:id', (req, res) => {
  const { id } = req.params;
  const updates: Partial<SparePartItem> = req.body;

  for (const category of sparePartsData) {
    for (const subcategory of category.subcategories) {
      const item = subcategory.items.find(item => item.id === id);
      if (item) {
        Object.assign(item, updates);
        res.json({ success: true, item });
        return;
      }
    }
  }

  res.status(404).json({ success: false, message: 'Item not found' });
});

// UPDATE MO item by ID
app.put('/api/mo/:id', (req, res) => {
  const { id } = req.params;
  const updates: Partial<MOItem> = req.body;

  for (const category of moData) {
    for (const subcategory of category.subcategories) {
      const item = subcategory.items.find(item => item.id === id);
      if (item) {
        Object.assign(item, updates);
        res.json({ success: true, item });
        return;
      }
    }
  }

  res.status(404).json({ success: false, message: 'Item not found' });
});

// CREATE spare part
app.post('/api/spare-parts', (req, res) => {
  const { categoryName, subcategoryName, item } = req.body;

  const category = sparePartsData.find(c => c.name === categoryName);
  if (!category) {
    res.status(404).json({ success: false, message: 'Category not found' });
    return;
  }

  const subcategory = category.subcategories.find(s => s.name === subcategoryName);
  if (!subcategory) {
    res.status(404).json({ success: false, message: 'Subcategory not found' });
    return;
  }

  const newItem: SparePartItem = {
    id: `sp-${Date.now()}`,
    movements: [],
    ...item,
  };

  subcategory.items.push(newItem);
  res.status(201).json({ success: true, item: newItem });
});

// CREATE MO item
app.post('/api/mo', (req, res) => {
  const { categoryName, subcategoryName, item } = req.body;

  const category = moData.find(c => c.name === categoryName);
  if (!category) {
    res.status(404).json({ success: false, message: 'Category not found' });
    return;
  }

  const subcategory = category.subcategories.find(s => s.name === subcategoryName);
  if (!subcategory) {
    res.status(404).json({ success: false, message: 'Subcategory not found' });
    return;
  }

  const newItem: MOItem = {
    id: `mo-${Date.now()}`,
    movements: [],
    ...item,
  };

  subcategory.items.push(newItem);
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

  // Generate date for the movement (last day of selected month or today)
  let dateStr: string;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNum] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();
    dateStr = `${String(lastDay).padStart(2, '0')}.${String(monthNum).padStart(2, '0')}.${year}`;
  } else {
    const today = new Date();
    dateStr = today.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
  }

  for (const category of sparePartsData) {
    for (const subcategory of category.subcategories) {
      const item = subcategory.items.find(item => item.id === id);
      if (item) {
        // Calculate available stock up to the selected month
        const targetMonth = month || getCurrentMonth();
        const balance = calculateMonthlyBalance(item.movements, targetMonth);
        const availableQty = balance.openingQty + balance.incomingQty - balance.issuedQty;

        if (quantity > availableQty) {
          res.status(400).json({ success: false, message: `Write-off quantity exceeds available quantity (${availableQty})` });
          return;
        }

        // Add outgoing movement for write-off
        const movement = {
          id: `m-${Date.now()}`,
          date: dateStr,
          type: 'outgoing' as const,
          quantity,
          notes: notes || 'Списание',
        };
        item.movements.push(movement);

        res.json({ success: true, item });
        return;
      }
    }
  }

  res.status(404).json({ success: false, message: 'Item not found' });
});

// WRITE-OFF MO item by ID
app.post('/api/mo/:id/write-off', (req, res) => {
  const { id } = req.params;
  const { quantity, notes, month } = req.body as { quantity: number; notes?: string; month?: string };

  if (!quantity || quantity <= 0) {
    res.status(400).json({ success: false, message: 'Invalid quantity' });
    return;
  }

  // Generate date for the movement (last day of selected month or today)
  let dateStr: string;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, monthNum] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();
    dateStr = `${String(lastDay).padStart(2, '0')}.${String(monthNum).padStart(2, '0')}.${year}`;
  } else {
    const today = new Date();
    dateStr = today.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
  }

  for (const category of moData) {
    for (const subcategory of category.subcategories) {
      const item = subcategory.items.find(item => item.id === id);
      if (item) {
        // Calculate available stock up to the selected month
        const targetMonth = month || getCurrentMonth();
        const balance = calculateMonthlyBalance(item.movements, targetMonth);
        const availableQty = balance.openingQty + balance.incomingQty - balance.issuedQty;

        if (quantity > availableQty) {
          res.status(400).json({ success: false, message: `Write-off quantity exceeds available quantity (${availableQty})` });
          return;
        }

        // Add outgoing movement for write-off
        const movement = {
          id: `m-${Date.now()}`,
          date: dateStr,
          type: 'outgoing' as const,
          quantity,
          notes: notes || 'Списание',
        };
        item.movements.push(movement);

        res.json({ success: true, item });
        return;
      }
    }
  }

  res.status(404).json({ success: false, message: 'Item not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
