import { Category, SparePartItem, MOItem, StockMovement } from '../types';

const API_URL = 'http://localhost:3001/api';

export async function fetchSpareParts(month?: string): Promise<Category<SparePartItem>[]> {
  const url = month ? `${API_URL}/spare-parts?month=${month}` : `${API_URL}/spare-parts`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch spare parts');
  return response.json();
}

export async function fetchMOItems(month?: string): Promise<Category<MOItem>[]> {
  const url = month ? `${API_URL}/mo?month=${month}` : `${API_URL}/mo`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch MO items');
  return response.json();
}

export async function fetchSuppliers(): Promise<string[]> {
  const response = await fetch(`${API_URL}/suppliers`);
  if (!response.ok) throw new Error('Failed to fetch suppliers');
  return response.json();
}

export async function deleteSparePart(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/spare-parts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete spare part');
}

export async function deleteMOItem(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/mo/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete MO item');
}

export async function updateSparePart(id: string, updates: Partial<SparePartItem>): Promise<SparePartItem> {
  const response = await fetch(`${API_URL}/spare-parts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update spare part');
  const data = await response.json();
  return data.item;
}

export async function updateMOItem(id: string, updates: Partial<MOItem>): Promise<MOItem> {
  const response = await fetch(`${API_URL}/mo/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update MO item');
  const data = await response.json();
  return data.item;
}

export async function createSparePart(
  categoryName: string,
  subcategoryName: string,
  item: Omit<SparePartItem, 'id'>
): Promise<SparePartItem> {
  const response = await fetch(`${API_URL}/spare-parts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryName, subcategoryName, item }),
  });
  if (!response.ok) throw new Error('Failed to create spare part');
  const data = await response.json();
  return data.item;
}

export async function createMOItem(
  categoryName: string,
  subcategoryName: string,
  item: Omit<MOItem, 'id'>
): Promise<MOItem> {
  const response = await fetch(`${API_URL}/mo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryName, subcategoryName, item }),
  });
  if (!response.ok) throw new Error('Failed to create MO item');
  const data = await response.json();
  return data.item;
}

// Helper to get current month in YYYY-MM format
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Helper to format month for display (YYYY-MM -> Январь 2026)
export function formatMonthDisplay(month: string): string {
  const [year, monthNum] = month.split('-');
  const date = new Date(parseInt(year), parseInt(monthNum) - 1);
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

// Generate list of months for selector (past 24 months + current + next 12)
export function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();

  for (let i = -6; i <= 4; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const value = `${year}-${month}`;
    const label = date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }

  return options;
}

export async function writeOffItem(
  type: 'spare-parts' | 'mo',
  itemId: string,
  data: { quantity: number; notes?: string; month?: string }
): Promise<SparePartItem | MOItem> {
  const response = await fetch(`${API_URL}/${type}/${itemId}/write-off`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to write off item');
  const result = await response.json();
  return result.item;
}

// Movement CRUD operations
export async function fetchItemMovements(
  type: 'spare-parts' | 'mo',
  itemId: string
): Promise<StockMovement[]> {
  const response = await fetch(`${API_URL}/${type}/${itemId}/movements`);
  if (!response.ok) throw new Error('Failed to fetch movements');
  return response.json();
}

export async function createMovement(
  type: 'spare-parts' | 'mo',
  itemId: string,
  data: Omit<StockMovement, 'id'>
): Promise<StockMovement> {
  const response = await fetch(`${API_URL}/${type}/${itemId}/movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create movement');
  return response.json();
}

export async function updateMovement(
  type: 'spare-parts' | 'mo',
  itemId: string,
  movementId: string,
  data: Partial<StockMovement>
): Promise<StockMovement> {
  const response = await fetch(`${API_URL}/${type}/${itemId}/movements/${movementId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to update movement');
  return response.json();
}

export async function deleteMovement(
  type: 'spare-parts' | 'mo',
  itemId: string,
  movementId: string
): Promise<void> {
  const response = await fetch(`${API_URL}/${type}/${itemId}/movements/${movementId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete movement');
}
