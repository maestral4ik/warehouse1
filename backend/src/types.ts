export type SparePartStatus = 'in stock' | 'out of stock' | 'written off';

export type MovementType = 'incoming' | 'outgoing' | 'transfer' | 'write-off';

export interface StockMovement {
  id: string;
  date: string; // Format: DD.MM.YYYY
  type: MovementType;
  quantity: number;
  notes?: string;
}

export interface SparePartItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  supplier: string;
  ttnNumber: string;
  lastMovementDate: string;
  status: SparePartStatus;
  movements: StockMovement[];
  writtenOffDate?: string; // Date when fully written off (DD.MM.YYYY)
}

export type MOStatus = 'in stock' | 'consumed' | 'written off';

export interface MOItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  price: number;
  supplier: string;
  ttnNumber: string;
  lastUseDate: string;
  status: MOStatus;
  movements: StockMovement[];
  writtenOffDate?: string;
}

export interface Subcategory<T> {
  name: string;
  items: T[];
}

export interface Category<T> {
  name: string;
  subcategories: Subcategory<T>[];
}
