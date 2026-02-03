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
  group?: string; // Group name for two-level headers
  groupColor?: string; // Background color for grouped columns
}

export const OUTGOING_REASONS: Record<string, string[]> = {
  // Spare Parts
  'Запчасти': [
    'трактора 241006',
    'с/х техника 241007',
    'автомобили 231001',
    'кормоуб.тех.241008',
    'КЗС 241009',
    'Голосятина склад',
    'Возврат',
  ],
  'Б.У. Запчасти': ['Выдача'],
  'Шины, камеры, АКБ': [
    'трактора 105001',
    'с/х техника 105002',
    'автомобили 105000',
    'МТК',
  ],
  // MO
  'Столовая/мастерские': [
    'столовая',
    'р.м.городняны',
    'контора',
    'зерносклад',
    'МТК Городняны',
    'стройбригада',
    'под.очет',
    'МТФ Семенча',
    'р.м. Голосятина',
  ],
  'сч.101; 106': ['Выдача'],
  'сч.109; фермы': ['МТК Городняны'],
  'сч.120; спец.одежда': [
    'Р.м. Городняны',
    'Р.м. Голосятина',
    'МТК Городняны',
    'Столовая',
    'Стройбригада',
    'Под.отчет',
    'Зерносклад',
  ],
};

export const DEFAULT_OUTGOING_REASON = 'Выдача';
