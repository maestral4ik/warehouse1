import { ColumnConfig } from '../types';

export const moColumns: ColumnConfig[] = [
  { id: 'name', label: 'Наименование', minWidth: 200 },
  { id: 'quantity', label: 'Кол-во', minWidth: 80, align: 'right' },
  { id: 'unit', label: 'Ед. изм.', minWidth: 70 },
  { id: 'price', label: 'Цена за ед.', minWidth: 100, align: 'right' },
  { id: 'total', label: 'Сумма', minWidth: 100, align: 'right', compute: (item) => (Number(item.quantity) * Number(item.price)).toFixed(2) },
  { id: 'supplier', label: 'Поставщик', minWidth: 140 },
  { id: 'ttnNumber', label: 'Номер ТТН', minWidth: 130 },
  { id: 'lastUseDate', label: 'Дата использования', minWidth: 120 },
  { id: 'status', label: 'Статус', minWidth: 120 },
];
