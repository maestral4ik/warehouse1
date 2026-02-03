import React, { useState, useRef, useCallback } from 'react';
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

const stickyStyles = {
  position: 'sticky',
  left: -24,
  borderRight: '2px solid #bdbdbd',
} as const;

const cellBorderStyle = {
  border: '1px solid #e0e0e0',
} as const;

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
  const cellRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());

  // Build flat list of all data rows for keyboard navigation
  const getAllRows = useCallback(() => {
    const rows: { subcategoryIndex: number; itemIndex: number }[] = [];
    category.subcategories.forEach((subcategory, subIndex) => {
      sortItems(subcategory.items).forEach((_, itemIndex) => {
        rows.push({ subcategoryIndex: subIndex, itemIndex });
      });
    });
    return rows;
  }, [category.subcategories, sortOrder]);

  const handleCellKeyDown = useCallback((
    e: React.KeyboardEvent,
    rowIndex: number,
    colIndex: number,
    totalCols: number
  ) => {
    const allRows = getAllRows();
    const totalRows = allRows.length;

    let newRowIndex = rowIndex;
    let newColIndex = colIndex;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        newRowIndex = Math.max(0, rowIndex - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        newRowIndex = Math.min(totalRows - 1, rowIndex + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newColIndex = Math.max(0, colIndex - 1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        newColIndex = Math.min(totalCols - 1, colIndex + 1);
        break;
      default:
        return;
    }

    const cellKey = `${newRowIndex}-${newColIndex}`;
    const cell = cellRefs.current.get(cellKey);
    if (cell) {
      cell.focus();
    }
  }, [getAllRows]);

  const setCellRef = useCallback((rowIndex: number, colIndex: number, el: HTMLTableCellElement | null) => {
    const key = `${rowIndex}-${colIndex}`;
    if (el) {
      cellRefs.current.set(key, el);
    } else {
      cellRefs.current.delete(key);
    }
  }, []);

  const getReportHeader = () => {
    const monthYear = formatMonthYear(selectedMonth || '');
    return `Отчет о движении продукции и материалов за ${monthYear}\nМатериально ответственное лицо Плашкевич Е В.`;
  };

  const buildExportData = () => {
    const context = { selectedMonth: selectedMonth || '' };
    const rows: (string | number)[][] = [];

    // Check if there are grouped columns
    const hasGroups = columns.some(col => col.group);

    if (!hasGroups) {
      // Single header row
      const headers = columns.map(col => col.label);
      rows.push(headers);
    } else {
      // Two header rows for grouped columns
      // First row: Group names (or column label for non-grouped)
      const groupRow: string[] = [];
      let prevGroup: string | null = null;
      columns.forEach((col) => {
        if (col.group) {
          if (col.group !== prevGroup) {
            groupRow.push(col.group);
            prevGroup = col.group;
          } else {
            groupRow.push(''); // Empty for merged cells in same group
          }
        } else {
          groupRow.push(col.label);
          prevGroup = null;
        }
      });
      rows.push(groupRow);

      // Second row: Sub-headers (кол-во/сумма for grouped, empty for non-grouped)
      const subHeaderRow: string[] = columns.map(col => col.group ? col.label : '');
      rows.push(subHeaderRow);
    }

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

      // Subtotal row - only if more than one subcategory
      if (category.subcategories.length > 1) {
        const subtotals = calculateSubtotals(subcategory.items, columns, context);
        const subtotalRow = columns.map((col, idx) => {
          if (idx === 0) return `Итого по ${subcategory.name}`;
          if (col.summable) return subtotals[col.id]?.toFixed(2) || '';
          return '';
        });
        rows.push(subtotalRow);
      }
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

    // Check if there are grouped columns
    const hasGroups = printColumns.some(col => col.group);

    // Build clean table HTML without sort indicators, action buttons, or status column
    let tableHtml = '<table><thead>';

    if (!hasGroups) {
      // Single row header
      tableHtml += '<tr>';
      printColumns.forEach(col => {
        tableHtml += `<th>${col.label}</th>`;
      });
      tableHtml += '</tr>';
    } else {
      // Two-row header for grouped columns
      const headerGroups: { group: string | null; colSpan: number; startIdx: number }[] = [];
      let currentGroup: string | null = null;
      let currentSpan = 0;
      let startIdx = 0;

      printColumns.forEach((col, idx) => {
        const colGroup = col.group || null;
        if (colGroup !== currentGroup) {
          if (currentSpan > 0) {
            headerGroups.push({ group: currentGroup, colSpan: currentSpan, startIdx });
          }
          currentGroup = colGroup;
          currentSpan = 1;
          startIdx = idx;
        } else {
          currentSpan++;
        }
      });
      if (currentSpan > 0) {
        headerGroups.push({ group: currentGroup, colSpan: currentSpan, startIdx });
      }

      // Build a map of group names to their colors
      const groupColorMap: Record<string, string> = {};
      printColumns.forEach(col => {
        if (col.group && col.groupColor && !groupColorMap[col.group]) {
          groupColorMap[col.group] = col.groupColor;
        }
      });

      // First row: Group headers
      tableHtml += '<tr>';
      headerGroups.forEach((hg) => {
        if (hg.group) {
          const groupColor = groupColorMap[hg.group] || '#e3f2fd';
          tableHtml += `<th colspan="${hg.colSpan}" style="background-color: ${groupColor}; text-align: center;">${hg.group}</th>`;
        } else {
          printColumns.slice(hg.startIdx, hg.startIdx + hg.colSpan).forEach(col => {
            tableHtml += `<th rowspan="2">${col.label}</th>`;
          });
        }
      });
      tableHtml += '</tr>';

      // Second row: Sub-headers for grouped columns
      tableHtml += '<tr>';
      printColumns.filter(col => col.group).forEach(col => {
        const bgColor = col.groupColor || '#e3f2fd';
        tableHtml += `<th style="background-color: ${bgColor};">${col.label}</th>`;
      });
      tableHtml += '</tr>';
    }

    tableHtml += '</thead><tbody>';

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
          const bgStyle = col.groupColor ? ` style="background-color: ${col.groupColor};"` : '';
          tableHtml += `<td${bgStyle}>${value}</td>`;
        });
        tableHtml += '</tr>';
      });

      // Subtotal - only if more than one subcategory
      if (category.subcategories.length > 1) {
        const subtotals = calculateSubtotals(subcategory.items, printColumns, context);
        tableHtml += '<tr class="subtotal">';
        printColumns.forEach((col, idx) => {
          const value = idx === 0
            ? `Итого по ${subcategory.name}`
            : col.summable ? (subtotals[col.id]?.toFixed(2) || '') : '';
          const bgStyle = col.groupColor ? ` style="background-color: ${col.groupColor}; font-weight: bold;"` : '';
          tableHtml += `<td${bgStyle}>${value}</td>`;
        });
        tableHtml += '</tr>';
      }
    });

    // Grand total
    const allItems = category.subcategories.flatMap(sub => sub.items);
    const grandTotals = calculateSubtotals(allItems, printColumns, context);
    tableHtml += '<tr class="grand-total">';
    printColumns.forEach((col, idx) => {
      const value = idx === 0
        ? 'Итого по категории'
        : col.summable ? (grandTotals[col.id]?.toFixed(2) || '') : '';
      const bgStyle = col.groupColor ? ` style="background-color: ${col.groupColor}; font-weight: bold;"` : '';
      tableHtml += `<td${bgStyle}>${value}</td>`;
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
          th { background-color: #f0f0f0; vertical-align: middle; }
          .group-header { background-color: #bbdefb; text-align: center; }
          .sub-header { background-color: #e3f2fd; }
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

      <TableContainer component={Paper} sx={{ overflowX: 'visible' }}>
        <Table size="small" ref={tableRef} sx={{ minWidth: 1200, borderCollapse: 'collapse' }}>
          <TableHead>
            {(() => {
              // Check if there are grouped columns
              const hasGroups = columns.some(col => col.group);

              if (!hasGroups) {
                // Single row header (original behavior)
                return (
                  <TableRow>
                    {columns.map((column, colIndex) => (
                      <TableCell
                        key={column.id}
                        align={column.align || 'left'}
                        style={{ minWidth: column.minWidth }}
                        sortDirection={column.id === 'name' && sortOrder ? sortOrder : false}
                        sx={{
                          ...cellBorderStyle,
                          ...(colIndex === 0 ? { ...stickyStyles, zIndex: 4, bgcolor: '#fff' } : {}),
                        }}
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
                      <TableCell align="center" style={{ minWidth: 140 }} sx={cellBorderStyle}>
                        Действия
                      </TableCell>
                    )}
                  </TableRow>
                );
              }

              // Two-row header for grouped columns
              // Build group info: which groups span which columns
              const headerGroups: { group: string | null; colSpan: number; startIdx: number }[] = [];
              let currentGroup: string | null = null;
              let currentSpan = 0;
              let startIdx = 0;

              columns.forEach((col, idx) => {
                const colGroup = col.group || null;
                if (colGroup !== currentGroup) {
                  if (currentSpan > 0) {
                    headerGroups.push({ group: currentGroup, colSpan: currentSpan, startIdx });
                  }
                  currentGroup = colGroup;
                  currentSpan = 1;
                  startIdx = idx;
                } else {
                  currentSpan++;
                }
              });
              // Push the last group
              if (currentSpan > 0) {
                headerGroups.push({ group: currentGroup, colSpan: currentSpan, startIdx });
              }

              // Build a map of group names to their colors from the first column in that group
              const groupColorMap: Record<string, string> = {};
              columns.forEach(col => {
                if (col.group && col.groupColor && !groupColorMap[col.group]) {
                  groupColorMap[col.group] = col.groupColor;
                }
              });

              return (
                <>
                  {/* First row: Group headers */}
                  <TableRow>
                    {headerGroups.map((hg, idx) => {
                      if (hg.group) {
                        // Grouped columns - show group name with group color
                        const groupColor = groupColorMap[hg.group] || '#e3f2fd';
                        return (
                          <TableCell
                            key={`group-${idx}`}
                            colSpan={hg.colSpan}
                            align="center"
                            sx={{
                              backgroundColor: groupColor,
                              fontWeight: 600,
                              ...cellBorderStyle,
                            }}
                          >
                            {hg.group}
                          </TableCell>
                        );
                      } else {
                        // Non-grouped columns - render each individually with rowSpan=2
                        return columns.slice(hg.startIdx, hg.startIdx + hg.colSpan).map((col, colIdx) => (
                          <TableCell
                            key={col.id}
                            rowSpan={2}
                            align={col.align || 'left'}
                            style={{ minWidth: col.minWidth, verticalAlign: 'middle' }}
                            sortDirection={col.id === 'name' && sortOrder ? sortOrder : false}
                            sx={{
                              ...cellBorderStyle,
                              ...(hg.startIdx + colIdx === 0 ? { ...stickyStyles, zIndex: 4, bgcolor: '#fff' } : {}),
                            }}
                          >
                            {col.id === 'name' ? (
                              <TableSortLabel
                                active={sortOrder !== null}
                                direction={sortOrder || 'asc'}
                                onClick={handleSortToggle}
                              >
                                {col.label}
                              </TableSortLabel>
                            ) : (
                              col.label
                            )}
                          </TableCell>
                        ));
                      }
                    })}
                    {hasActions && (
                      <TableCell rowSpan={2} align="center" style={{ minWidth: 140, verticalAlign: 'middle' }} sx={cellBorderStyle}>
                        Действия
                      </TableCell>
                    )}
                  </TableRow>
                  {/* Second row: Sub-headers for grouped columns only */}
                  <TableRow>
                    {columns.filter(col => col.group).map((col) => (
                      <TableCell
                        key={col.id}
                        align={col.align || 'left'}
                        style={{ minWidth: col.minWidth }}
                        sx={{
                          backgroundColor: col.groupColor || '#e3f2fd',
                          ...cellBorderStyle,
                        }}
                      >
                        {col.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </>
              );
            })()}
          </TableHead>
          <TableBody>
            {(() => {
              let globalRowIndex = 0;
              const totalCols = columns.length;

              return category.subcategories.map((subcategory, subIndex) => (
                <React.Fragment key={`subcategory-${subIndex}-${subcategory.name}`}>
                  <TableRow sx={{ backgroundColor: '#eceff1' }}>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        color: 'secondary.dark',
                        py: 1.5,
                        ...stickyStyles,
                        ...cellBorderStyle,
                        zIndex: 2,
                        bgcolor: '#eceff1',
                        pl: 4,
                      }}
                    >
                      {subcategory.name}
                    </TableCell>
                    <TableCell
                      colSpan={hasActions ? columns.length : columns.length - 1}
                      sx={{ bgcolor: '#eceff1', ...cellBorderStyle }}
                    />
                  </TableRow>
                  {sortItems(subcategory.items).map((item, index) => {
                    const currentRowIndex = globalRowIndex++;
                    return (
                      <TableRow key={`item-${index}`} sx={{ backgroundColor: '#fff' }}>
                        {columns.map((column, colIndex) => (
                          <TableCell
                            key={column.id}
                            align={column.align || 'left'}
                            tabIndex={0}
                            ref={(el: HTMLTableCellElement | null) => setCellRef(currentRowIndex, colIndex, el)}
                            onKeyDown={(e) => handleCellKeyDown(e, currentRowIndex, colIndex, totalCols)}
                            sx={{
                              ...cellBorderStyle,
                              ...(colIndex === 0 ? { ...stickyStyles, zIndex: 2, bgcolor: '#fff' } : {}),
                              ...(column.groupColor ? { bgcolor: column.groupColor } : {}),
                              '&:focus': {
                                outline: '2px solid #1976d2',
                                outlineOffset: -2,
                              },
                            }}
                          >
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
                      <TableCell align="center" sx={cellBorderStyle}>
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
                    );
                  })}
                  {onAddItem && (
                  <TableRow sx={{ backgroundColor: '#fff' }}>
                    <TableCell
                      sx={{ py: 1, ...stickyStyles, ...cellBorderStyle, zIndex: 2, bgcolor: '#fff', pl: 4 }}
                    >
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenAddDialog(subcategory.name)}
                      >
                        Добавить
                      </Button>
                    </TableCell>
                    <TableCell colSpan={hasActions ? columns.length : columns.length - 1} sx={cellBorderStyle} />
                  </TableRow>
                )}
                {/* Subtotal row for subcategory - only show if more than one subcategory */}
                {category.subcategories.length > 1 && (() => {
                  const subtotals = calculateSubtotals(subcategory.items, columns, { selectedMonth: selectedMonth || '' });
                  return (
                    <TableRow sx={{ backgroundColor: '#f5f5f5', borderBottom: subIndex < category.subcategories.length - 1 ? 2 : 1, borderColor: 'divider' }}>
                      {columns.map((column, colIndex) => (
                        <TableCell
                          key={column.id}
                          align={column.align || 'left'}
                          sx={{
                            fontWeight: 600,
                            ...cellBorderStyle,
                            ...(colIndex === 0 ? { ...stickyStyles, zIndex: 2, bgcolor: '#f5f5f5' } : {}),
                            ...(column.groupColor ? { bgcolor: column.groupColor } : {}),
                          }}
                        >
                          {colIndex === 0
                            ? `Итого по ${subcategory.name}`
                            : column.summable
                              ? subtotals[column.id]?.toFixed(2) || ''
                              : ''
                          }
                        </TableCell>
                      ))}
                      {hasActions && <TableCell sx={cellBorderStyle} />}
                    </TableRow>
                  );
                })()}
                </React.Fragment>
              ));
            })()}
            {/* Grand total row for entire category */}
            {(() => {
              const allItems = category.subcategories.flatMap(sub => sub.items);
              const grandTotals = calculateSubtotals(allItems, columns, { selectedMonth: selectedMonth || '' });
              return (
                <TableRow sx={{ backgroundColor: '#e0e0e0' }}>
                  {columns.map((column, colIndex) => (
                    <TableCell
                      key={column.id}
                      align={column.align || 'left'}
                      sx={{
                        fontWeight: 600,
                        ...cellBorderStyle,
                        ...(colIndex === 0 ? { ...stickyStyles, zIndex: 2, bgcolor: '#e0e0e0' } : {}),
                        ...(column.groupColor ? { bgcolor: column.groupColor } : {}),
                      }}
                    >
                      {colIndex === 0
                        ? 'Итого по категории'
                        : column.summable
                          ? grandTotals[column.id]?.toFixed(2) || ''
                          : ''
                      }
                    </TableCell>
                  ))}
                  {hasActions && <TableCell sx={cellBorderStyle} />}
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
