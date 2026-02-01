export type SparePartStatus = 'in stock' | 'written off';

export type MovementType = 'incoming' | 'outgoing' | 'transfer';

export interface StockMovement {
  id: string;
  date: string;
  type: MovementType;
  quantity: number;
  pricePerUnit?: number;
  supplier?: string;
  ttnNumber?: string;
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
  movements?: StockMovement[];
  [key: string]: string | number | StockMovement[] | undefined;
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
  movements?: StockMovement[];
  [key: string]: string | number | StockMovement[] | undefined;
}

export interface Subcategory<T> {
  name: string;
  items: T[];
}

export interface Category<T> {
  name: string;
  subcategories: Subcategory<T>[];
}

export interface ComputeContext {
  selectedMonth: string; // Format: YYYY-MM
}

export interface ColumnConfig {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  compute?: (item: Record<string, unknown>, context?: ComputeContext) => string | number;
  summable?: boolean;
}
