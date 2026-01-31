import express from 'express';
import cors from 'cors';
import { sparePartsData } from './data/sparePartsData';
import { moData } from './data/moData';
import { SparePartItem, MOItem } from './types';
import { filterCategoriesByMonth, getCurrentMonth } from './services/inventoryFilter';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
