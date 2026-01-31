import React, { useState } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Box,
  Button,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { Category, ColumnConfig, SparePartStatus, MOStatus } from '../types';
import AddItemDialog, { ItemFormData } from './AddItemDialog';

type StatusType = SparePartStatus | MOStatus;

interface CategoryTableProps<T extends Record<string, unknown>> {
  category: Category<T>;
  columns: ColumnConfig[];
  statusField: keyof T;
  selectedMonth?: string;
  onRefresh?: () => void;
  onAddItem?: (subcategoryName: string, item: ItemFormData) => Promise<void>;
  onEditItem?: (item: T, subcategoryName: string) => void;
}

function getStatusColor(status: StatusType): 'success' | 'error' | 'warning' {
  switch (status) {
    case 'in stock':
      return 'success';
    case 'out of stock':
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
  onRefresh,
  onAddItem,
  onEditItem,
}: CategoryTableProps<T>) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState('');

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

  return (
    <Box>
      <AddItemDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSubmit={handleAddItem}
        subcategoryName={selectedSubcategory}
      />

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || 'left'}
                  style={{ minWidth: column.minWidth }}
                >
                  {column.label}
                </TableCell>
              ))}
              {onEditItem && (
                <TableCell align="center" style={{ minWidth: 60 }}>
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
                    colSpan={onEditItem ? columns.length + 1 : columns.length}
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
                {subcategory.items.map((item, index) => (
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
                    {onEditItem && (
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => onEditItem(item, subcategory.name)}
                          title="Редактировать"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {onAddItem && (
                  <TableRow>
                    <TableCell
                      colSpan={onEditItem ? columns.length + 1 : columns.length}
                      sx={{ py: 1, borderBottom: subIndex < category.subcategories.length - 1 ? 2 : 1, borderColor: 'divider' }}
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
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

export default CategoryTable;
