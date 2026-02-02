import React, { useState, useRef } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Box,
  Button,
  IconButton,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import HistoryIcon from '@mui/icons-material/History';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PrintIcon from '@mui/icons-material/Print';
import * as XLSX from 'xlsx';
import { Category, ColumnConfig, SparePartStatus, MOStatus, ComputeContext } from '../types';
import AddItemDialog, { ItemFormData } from './AddItemDialog';
import WriteOffDialog, { WriteOffData } from './WriteOffDialog';

const MONTH_NAMES_RU: Record<string, string> = {
  '01': 'январь',
  '02': 'февраль',
  '03': 'март',
  '04': 'апрель',
  '05': 'май',
  '06': 'июнь',
  '07': 'июль',
  '08': 'август',
  '09': 'сентябрь',
  '10': 'октябрь',
  '11': 'ноябрь',
  '12': 'декабрь',
};

function formatMonthYear(selectedMonth: string): string {
  if (!selectedMonth) return '';
  const [year, month] = selectedMonth.split('-');
  const monthName = MONTH_NAMES_RU[month] || month;
  return `${monthName} ${year}г.`;
}

type StatusType = SparePartStatus | MOStatus;

function calculateSubtotals<T>(items: T[], columns: ColumnConfig[], context: ComputeContext): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const col of columns) {
    if (col.summable && col.compute) {
      sums[col.id] = items.reduce((acc, item) => {
        const val = col.compute!(item as Record<string, unknown>, context);
        return acc + (typeof val === 'number' ? val : parseFloat(String(val)) || 0);
      }, 0);
    }
  }
  return sums;
}

interface CategoryTableProps<T extends Record<string, unknown>> {
  category: Category<T>;
  columns: ColumnConfig[];
  statusField: keyof T;
  selectedMonth?: string;
  categoryName?: string;
  onRefresh?: () => void;
  onAddItem?: (subcategoryName: string, item: ItemFormData) => Promise<void>;
  onEditItem?: (item: T, subcategoryName: string) => void;
  onWriteOff?: (item: T, data: WriteOffData) => Promise<void>;
  onViewMovements?: (item: T) => void;
}

function getStatusColor(status: StatusType): 'success' | 'error' | 'warning' {
  switch (status) {
    case 'in stock':
      return 'success';
    case 'consumed':
      return 'error';
    case 'written off':
      return 'warning';
    default:
      return 'success';
  }
}

function CategoryTable<T extends Record<string, unknown>>({
  category,
  columns,
  statusField,
  selectedMonth,
  categoryName,
  onRefresh,
  onAddItem,
  onEditItem,
  onWriteOff,
  onViewMovements,
}: CategoryTableProps<T>) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [writeOffDialogOpen, setWriteOffDialogOpen] = useState(false);
  const [writeOffItem, setWriteOffItem] = useState<T | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  const handleSortToggle = () => {
    setSortOrder((prev) => {
      if (prev === null) return 'asc';
      if (prev === 'asc') return 'desc';
      return null;
    });
  };

  const sortItems = (items: T[]) => {
    if (sortOrder === null) return items;
    return [...items].sort((a, b) => {
      const nameA = String(a.name || '').toLowerCase();
      const nameB = String(b.name || '').toLowerCase();
      return sortOrder === 'asc'
        ? nameA.localeCompare(nameB, 'ru')
        : nameB.localeCompare(nameA, 'ru');
    });
  };

  const handleOpenAddDialog = (subcategoryName: string) => {
    setSelectedSubcategory(subcategoryName);
    setAddDialogOpen(true);
  };

  const handleAddItem = async (item: ItemFormData) => {
    if (onAddItem) {
      await onAddItem(selectedSubcategory, item);
      onRefresh?.();
    }
  };

  const handleOpenWriteOffDialog = (item: T) => {
    setWriteOffItem(item);
    setWriteOffDialogOpen(true);
  };

  const handleWriteOff = async (data: WriteOffData) => {
    if (onWriteOff && writeOffItem) {
      await onWriteOff(writeOffItem, data);
      onRefresh?.();
    }
  };

  const hasActions = onEditItem || onWriteOff || onViewMovements;
  const tableRef = useRef<HTMLTableElement>(null);

  const getReportHeader = () => {
    const monthYear = formatMonthYear(selectedMonth || '');
    return `Отчет о движении продукции и материалов за ${monthYear}\nМатериально ответственное лицо Плашкевич Е В.`;
  };

  const buildExportData = () => {
    const context = { selectedMonth: selectedMonth || '' };
    const rows: (string | number)[][] = [];

    // Header columns (exclude Actions column)
    const headers = columns.map(col => col.label);
    rows.push(headers);

    // Data rows
    category.subcategories.forEach((subcategory) => {
      // Subcategory header row
      const subcatRow = new Array(columns.length).fill('');
      subcatRow[0] = subcategory.name;
      rows.push(subcatRow);

      // Items
      sortItems(subcategory.items).forEach((item) => {
        const row = columns.map((col) => {
          if (col.compute) {
            const val = col.compute(item as Record<string, unknown>, context);
            return val;
          }
          return String(item[col.id as keyof T] || '');
        });
        rows.push(row);
      });

      // Subtotal row
      const subtotals = calculateSubtotals(subcategory.items, columns, context);
      const subtotalRow = columns.map((col, idx) => {
        if (idx === 0) return `Итого по ${subcategory.name}`;
        if (col.summable) return subtotals[col.id]?.toFixed(2) || '';
        return '';
      });
      rows.push(subtotalRow);
    });

    // Grand total row
    const allItems = category.subcategories.flatMap(sub => sub.items);
    const grandTotals = calculateSubtotals(allItems, columns, context);
    const grandTotalRow = columns.map((col, idx) => {
      if (idx === 0) return 'Итого по категории';
      if (col.summable) return grandTotals[col.id]?.toFixed(2) || '';
      return '';
    });
    rows.push(grandTotalRow);

    return rows;
  };

  const handleExportCSV = () => {
    const header = getReportHeader();
    const data = buildExportData();

    const csvContent = [
      header,
      '',
      ...data.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${selectedMonth || 'all'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleExportExcel = () => {
    const header = getReportHeader();
    const data = buildExportData();

    const wsData = [
      [header],
      [],
      ...data
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Отчет');
    XLSX.writeFile(wb, `report_${selectedMonth || 'all'}.xlsx`);
  };

  const handlePrint = () => {
    const header = getReportHeader();
    const context = { selectedMonth: selectedMonth || '' };
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Filter out status column for print
    const printColumns = columns.filter(col => col.id !== statusField);

    // Build clean table HTML without sort indicators, action buttons, or status column
    let tableHtml = '<table><thead><tr>';

    // Headers (exclude Actions and Status columns)
    printColumns.forEach(col => {
      tableHtml += `<th>${col.label}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    // Data rows
    category.subcategories.forEach((subcategory) => {
      // Subcategory header
      tableHtml += `<tr class="subcategory"><td colspan="${printColumns.length}">${subcategory.name}</td></tr>`;

      // Items (no sorting applied - original order)
      subcategory.items.forEach((item) => {
        tableHtml += '<tr>';
        printColumns.forEach((col) => {
          const value = col.compute
            ? col.compute(item as Record<string, unknown>, context)
            : String(item[col.id as keyof T] || '');
          tableHtml += `<td>${value}</td>`;
        });
        tableHtml += '</tr>';
      });

      // Subtotal
      const subtotals = calculateSubtotals(subcategory.items, printColumns, context);
      tableHtml += '<tr class="subtotal">';
      printColumns.forEach((col, idx) => {
        const value = idx === 0
          ? `Итого по ${subcategory.name}`
          : col.summable ? (subtotals[col.id]?.toFixed(2) || '') : '';
        tableHtml += `<td>${value}</td>`;
      });
      tableHtml += '</tr>';
    });

    // Grand total
    const allItems = category.subcategories.flatMap(sub => sub.items);
    const grandTotals = calculateSubtotals(allItems, printColumns, context);
    tableHtml += '<tr class="grand-total">';
    printColumns.forEach((col, idx) => {
      const value = idx === 0
        ? 'Итого по категории'
        : col.summable ? (grandTotals[col.id]?.toFixed(2) || '') : '';
      tableHtml += `<td>${value}</td>`;
    });
    tableHtml += '</tr></tbody></table>';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Печать отчета</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; white-space: pre-line; font-weight: bold; }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th, td { border: 1px solid #000; padding: 4px 8px; text-align: left; }
          th { background-color: #f0f0f0; }
          .subcategory { background-color: #eceff1; font-weight: 600; }
          .subtotal { background-color: #f5f5f5; font-weight: bold; }
          .grand-total { background-color: #e0e0e0; font-weight: bold; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">${header}</div>
        ${tableHtml}
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Box>
      <AddItemDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSubmit={handleAddItem}
        subcategoryName={selectedSubcategory}
      />

      {writeOffItem && (
        <WriteOffDialog
          open={writeOffDialogOpen}
          onClose={() => setWriteOffDialogOpen(false)}
          onSubmit={handleWriteOff}
          itemName={String(writeOffItem.name || '')}
          maxQuantity={Number(writeOffItem.endingQty ?? writeOffItem.quantity) || 0}
          unit={String(writeOffItem.unit || 'шт')}
          month={selectedMonth}
          categoryName={categoryName}
        />
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportCSV}
        >
          CSV
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FileDownloadIcon />}
          onClick={handleExportExcel}
        >
          Excel
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
        >
          Печать
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table size="small" ref={tableRef}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  style={{ minWidth: column.minWidth }}
                  sortDirection={column.id === 'name' && sortOrder ? sortOrder : false}
                >
                  {column.id === 'name' ? (
                    <TableSortLabel
                      active={sortOrder !== null}
                      direction={sortOrder || 'asc'}
                      onClick={handleSortToggle}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
              {hasActions && (
                <TableCell align="center" style={{ minWidth: 140 }}>
                  Действия
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {category.subcategories.map((subcategory, subIndex) => (
              <React.Fragment key={`subcategory-${subIndex}-${subcategory.name}`}>
                <TableRow>
                  <TableCell
                    colSpan={hasActions ? columns.length + 1 : columns.length}
                    sx={{
                      backgroundColor: '#eceff1',
                      fontWeight: 600,
                      color: 'secondary.dark',
                      py: 1.5,
                    }}
                  >
                    {subcategory.name}
                  </TableCell>
                </TableRow>
                {sortItems(subcategory.items).map((item, index) => (
                  <TableRow key={`item-${index}`}>
                    {columns.map((column) => (
                      <TableCell key={column.id} align={column.align || 'left'}>
                        {column.id === statusField ? (
                          <Chip
                            label={String(item[column.id as keyof T])}
                            color={getStatusColor(item[statusField] as StatusType)}
                            size="small"
                            sx={{ fontWeight: 500 }}
                          />
                        ) : (
                          column.compute
                            ? column.compute(item as Record<string, unknown>, { selectedMonth: selectedMonth || '' })
                            : String(item[column.id as keyof T])
                        )}
                      </TableCell>
                    ))}
                    {hasActions && (
                      <TableCell align="center">
                        {onViewMovements && (
                          <IconButton
                            size="small"
                            onClick={() => onViewMovements(item)}
                            title="История движений"
                            color="primary"
                          >
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        )}
                        {onEditItem && (
                          <IconButton
                            size="small"
                            onClick={() => onEditItem(item, subcategory.name)}
                            title="Редактировать"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        )}
                        {onWriteOff && (
                          <IconButton
                            size="small"
                            onClick={() => handleOpenWriteOffDialog(item)}
                            title="Списать"
                            disabled={Number(item.quantity) <= 0}
                            color="warning"
                          >
                            <RemoveCircleOutlineIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {onAddItem && (
                  <TableRow>
                    <TableCell
                      colSpan={hasActions ? columns.length + 1 : columns.length}
                      sx={{ py: 1 }}
                    >
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenAddDialog(subcategory.name)}
                      >
                        Добавить товар
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
                {/* Subtotal row for subcategory */}
                {(() => {
                  const subtotals = calculateSubtotals(subcategory.items, columns, { selectedMonth: selectedMonth || '' });
                  return (
                    <TableRow sx={{ backgroundColor: '#f5f5f5', borderBottom: subIndex < category.subcategories.length - 1 ? 2 : 1, borderColor: 'divider' }}>
                      {columns.map((column, colIndex) => (
                        <TableCell key={column.id} align={column.align || 'left'} sx={{ fontWeight: 600 }}>
                          {colIndex === 0
                            ? `Итого по ${subcategory.name}`
                            : column.summable
                              ? subtotals[column.id]?.toFixed(2) || ''
                              : ''
                          }
                        </TableCell>
                      ))}
                      {hasActions && <TableCell />}
                    </TableRow>
                  );
                })()}
              </React.Fragment>
            ))}
            {/* Grand total row for entire category */}
            {(() => {
              const allItems = category.subcategories.flatMap(sub => sub.items);
              const grandTotals = calculateSubtotals(allItems, columns, { selectedMonth: selectedMonth || '' });
              return (
                <TableRow sx={{ backgroundColor: '#e0e0e0' }}>
                  {columns.map((column, colIndex) => (
                    <TableCell key={column.id} align={column.align || 'left'} sx={{ fontWeight: 600 }}>
                      {colIndex === 0
                        ? 'Итого по категории'
                        : column.summable
                          ? grandTotals[column.id]?.toFixed(2) || ''
                          : ''
                      }
                    </TableCell>
                  ))}
                  {hasActions && <TableCell />}
                </TableRow>
              );
            })()}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default CategoryTable;
