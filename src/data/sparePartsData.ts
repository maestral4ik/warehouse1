import { ColumnConfig } from '../types';

// Columns now use backend-computed values for rolling monthly balances:
// - openingQty: balance before the month
// - incomingQty: incoming during the month
// - issuedQty: outgoing during the month
// - endingQty: balance at end of month

export const sparePartsColumns: ColumnConfig[] = [
  { id: 'name', label: 'Наименование', minWidth: 200 },
  {
    id: 'openingQty',
    label: 'Остаток на начало',
    minWidth: 100,
    align: 'right',
    compute: (item) => {
      const qty = Number(item.openingQty) || 0;
      return qty > 0 ? qty : '';
    }
  },
  { id: 'unit', label: 'Ед. изм.', minWidth: 70 },
  { id: 'price', label: 'Цена за ед.', minWidth: 100, align: 'right' },
  {
    id: 'openingAmount',
    label: 'Сумма на начало',
    minWidth: 100,
    align: 'right',
    summable: true,
    compute: (item) => {
      const qty = Number(item.openingQty) || 0;
      if (qty <= 0) return '';
      return (qty * Number(item.price)).toFixed(2);
    }
  },
  { id: 'supplier', label: 'Поставщик', minWidth: 140 },
  { id: 'ttnNumber', label: 'Номер ТТН', minWidth: 130 },
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
