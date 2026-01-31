import { ColumnConfig } from '../types';

// Helper to extract YYYY-MM from DD.MM.YYYY date string
function getMonthFromDate(dateStr: string): string {
  const parts = dateStr.split('.');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}`; // YYYY-MM
  }
  return '';
}

// Helper to check if incoming movement was in specific month
function isIncomingInMonth(item: Record<string, unknown>, targetMonth: string): boolean {
  const movements = item.movements as Array<{ date: string; type: string }> | undefined;
  if (movements) {
    const incomingMovement = movements.find(m => m.type === 'incoming');
    if (incomingMovement) {
      return getMonthFromDate(incomingMovement.date) === targetMonth;
    }
  }
  // Fallback: use lastMovementDate
  const lastDate = item.lastMovementDate as string;
  return lastDate ? getMonthFromDate(lastDate) === targetMonth : false;
}

export const sparePartsColumns: ColumnConfig[] = [
  { id: 'name', label: 'Наименование', minWidth: 200 },
  { id: 'quantity', label: 'Кол-во', minWidth: 80, align: 'right' },
  { id: 'unit', label: 'Ед. изм.', minWidth: 70 },
  { id: 'price', label: 'Цена за ед.', minWidth: 100, align: 'right' },
  {
    id: 'total',
    label: 'Сумма',
    minWidth: 100,
    align: 'right',
    compute: (item, context) => {
      // Show value only if incoming was in a PREVIOUS month
      if (context?.selectedMonth && isIncomingInMonth(item, context.selectedMonth)) {
        return ''; // Empty - show in "Сумма прихода" instead
      }
      return (Number(item.quantity) * Number(item.price)).toFixed(2);
    }
  },
  {
    id: 'incomingTotal',
    label: 'Сумма прихода',
    minWidth: 100,
    align: 'right',
    compute: (item, context) => {
      // Show value only if incoming was in the CURRENT selected month
      if (context?.selectedMonth && isIncomingInMonth(item, context.selectedMonth)) {
        return (Number(item.quantity) * Number(item.price)).toFixed(2);
      }
      return ''; // Empty - value is in "Сумма" column
    }
  },
  { id: 'supplier', label: 'Поставщик', minWidth: 140 },
  { id: 'ttnNumber', label: 'Номер ТТН', minWidth: 130 },
  { id: 'lastMovementDate', label: 'Дата движения', minWidth: 120 },
  { id: 'status', label: 'Статус', minWidth: 120 },
];
