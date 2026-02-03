import { ColumnConfig, OUTGOING_REASONS, DEFAULT_OUTGOING_REASON, StockMovement } from '../types';

// Color palette for different write-off reason groups
const GROUP_COLORS = [
  '#e3f2fd', // light blue
  '#fce4ec', // light pink
  '#e8f5e9', // light green
  '#fff3e0', // light orange
  '#f3e5f5', // light purple
  '#e0f7fa', // light cyan
  '#fffde7', // light yellow
  '#efebe9', // light brown
  '#eceff1', // light blue-grey
];

// Helper function to check if a date string is in a given month
function isInMonth(dateStr: string, month: string): boolean {
  // dateStr: "DD.MM.YYYY", month: "YYYY-MM"
  const parts = dateStr.split('.');
  if (parts.length !== 3) return false;
  const [, m, year] = parts;
  return `${year}-${m}` === month;
}

// Helper function to calculate issued quantity by reason for a given month
function getIssuedByReason(item: Record<string, unknown>, reason: string, selectedMonth?: string): number {
  const movements = item.movements as StockMovement[] | undefined;
  if (!movements) return 0;

  return movements
    .filter(m =>
      m.type === 'outgoing' &&
      m.notes === reason &&
      (!selectedMonth || isInMonth(m.date, selectedMonth))
    )
    .reduce((sum, m) => sum + m.quantity, 0);
}

// Generate issued columns based on category configuration
function generateIssuedColumns(categoryName?: string): ColumnConfig[] {
  const reasons = categoryName
    ? (OUTGOING_REASONS[categoryName] || [DEFAULT_OUTGOING_REASON])
    : [DEFAULT_OUTGOING_REASON];

  const isDefault = reasons.length === 1 && reasons[0] === DEFAULT_OUTGOING_REASON;
  const isSingleNonDefault = reasons.length === 1 && reasons[0] !== DEFAULT_OUTGOING_REASON;

  if (isDefault) {
    // Keep original behavior - single "Выбыло кол-во" column
    return [
      {
        id: 'issuedQty',
        label: 'Выбыло кол-во',
        minWidth: 100,
        align: 'right',
        compute: (item) => {
          const qty = Number(item.issuedQty) || 0;
          return qty > 0 ? qty : '';
        }
      },
      {
        id: 'issuedAmount',
        label: 'Сумма расхода',
        minWidth: 100,
        align: 'right',
        summable: true,
        compute: (item) => {
          const qty = Number(item.issuedQty) || 0;
          if (qty <= 0) return '';
          return (qty * Number(item.price)).toFixed(2);
        }
      },
    ];
  } else if (isSingleNonDefault) {
    // Single non-default reason - rename column to include reason name
    return [
      {
        id: 'issuedQty',
        label: `Выбыло кол-во, ${reasons[0]}`,
        minWidth: 100,
        align: 'right',
        compute: (item) => {
          const qty = Number(item.issuedQty) || 0;
          return qty > 0 ? qty : '';
        }
      },
      {
        id: 'issuedAmount',
        label: 'Сумма расхода',
        minWidth: 100,
        align: 'right',
        summable: true,
        compute: (item) => {
          const qty = Number(item.issuedQty) || 0;
          if (qty <= 0) return '';
          return (qty * Number(item.price)).toFixed(2);
        }
      },
    ];
  } else {
    // Multiple reasons - create columns per reason + total amount
    const cols: ColumnConfig[] = [];

    for (let i = 0; i < reasons.length; i++) {
      const reason = reasons[i];
      const groupColor = GROUP_COLORS[i % GROUP_COLORS.length];
      cols.push({
        id: `issued_${reason}`,
        label: 'кол-во',
        minWidth: 70,
        align: 'right',
        group: reason,
        groupColor,
        compute: (item, context) => {
          const qty = getIssuedByReason(item, reason, context?.selectedMonth);
          return qty > 0 ? qty : '';
        }
      });
      cols.push({
        id: `issuedAmount_${reason}`,
        label: 'сумма',
        minWidth: 80,
        align: 'right',
        summable: true,
        group: reason,
        groupColor,
        compute: (item, context) => {
          const qty = getIssuedByReason(item, reason, context?.selectedMonth);
          if (qty <= 0) return '';
          return (qty * Number(item.price)).toFixed(2);
        }
      });
    }

    // Total amount column at the end
    cols.push({
      id: 'issuedAmount',
      label: 'Сумма расхода',
      minWidth: 100,
      align: 'right',
      summable: true,
      compute: (item) => {
        const qty = Number(item.issuedQty) || 0;
        if (qty <= 0) return '';
        return (qty * Number(item.price)).toFixed(2);
      }
    });

    return cols;
  }
}

// Base columns before issued section
const baseColumnsBefore: ColumnConfig[] = [
  { id: 'name', label: 'Наименование', minWidth: 200 },
  { id: 'unit', label: 'Ед. изм.', minWidth: 70 },
  {
    id: 'openingQty',
    label: 'Остаток на начало месяца',
    minWidth: 80,
    align: 'right',
    compute: (item) => {
      const qty = Number(item.openingQty) || 0;
      return qty > 0 ? qty : '';
    }
  },
  { id: 'price', label: 'Цена за ед.', minWidth: 70, align: 'right' },
  {
    id: 'openingAmount',
    label: 'Сумма на начало',
    minWidth: 70,
    align: 'right',
    summable: true,
    compute: (item) => {
      const qty = Number(item.openingQty) || 0;
      if (qty <= 0) return '';
      return (qty * Number(item.price)).toFixed(2);
    }
  },
  { id: 'supplier', label: 'Поставщик', minWidth: 100 },
  { id: 'ttnNumber', label: 'Номер ТТН', minWidth: 100 },
  {
    id: 'incomingQty',
    label: 'Приход кол-во',
    minWidth: 100,
    align: 'right',
    compute: (item) => {
      const qty = Number(item.incomingQty) || 0;
      return qty > 0 ? qty : '';
    }
  },
  {
    id: 'incomingAmount',
    label: 'Сумма прихода',
    minWidth: 100,
    align: 'right',
    summable: true,
    compute: (item) => {
      const qty = Number(item.incomingQty) || 0;
      if (qty <= 0) return '';
      return (qty * Number(item.price)).toFixed(2);
    }
  },
];

// Base columns after issued section
const baseColumnsAfter: ColumnConfig[] = [
  {
    id: 'endingQty',
    label: 'Остаток на конец',
    minWidth: 100,
    align: 'right',
    compute: (item) => {
      const qty = Number(item.endingQty) || 0;
      return qty;
    }
  },
  {
    id: 'endingAmount',
    label: 'Сумма на конец',
    minWidth: 100,
    align: 'right',
    summable: true,
    compute: (item) => {
      const qty = Number(item.endingQty) || 0;
      return (qty * Number(item.price)).toFixed(2);
    }
  },
];

// Function to get columns for a specific category
export function getMOColumns(categoryName?: string): ColumnConfig[] {
  return [
    ...baseColumnsBefore,
    ...generateIssuedColumns(categoryName),
    ...baseColumnsAfter,
  ];
}

// Export default columns for backwards compatibility
export const moColumns: ColumnConfig[] = getMOColumns();
