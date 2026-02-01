import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { StockMovement, MovementType } from '../types';
import { fetchItemMovements, createMovement, updateMovement, deleteMovement } from '../api';
import MovementDialog, { MovementFormData } from './MovementDialog';

interface MovementHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemName: string;
  itemType: 'spare-parts' | 'mo';
  onMovementChange?: () => void;
}

function getTypeLabel(type: MovementType): string {
  switch (type) {
    case 'incoming':
      return 'Поступление';
    case 'outgoing':
      return 'Выдача';
    case 'transfer':
      return 'Перемещение';
    default:
      return type;
  }
}

function getTypeColor(type: MovementType): 'success' | 'error' | 'info' {
  switch (type) {
    case 'incoming':
      return 'success';
    case 'outgoing':
      return 'error';
    case 'transfer':
      return 'info';
    default:
      return 'info';
  }
}

function MovementHistoryDrawer({
  open,
  onClose,
  itemId,
  itemName,
  itemType,
  onMovementChange,
}: MovementHistoryDrawerProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingMovement, setEditingMovement] = useState<StockMovement | undefined>();

  const loadMovements = async () => {
    if (!itemId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchItemMovements(itemType, itemId);
      setMovements(data);
    } catch (err) {
      setError('Не удалось загрузить историю движений');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && itemId) {
      loadMovements();
    }
  }, [open, itemId, itemType]);

  const handleAddClick = () => {
    setDialogMode('add');
    setEditingMovement(undefined);
    setDialogOpen(true);
  };

  const handleEditClick = (movement: StockMovement) => {
    setDialogMode('edit');
    setEditingMovement(movement);
    setDialogOpen(true);
  };

  const handleDeleteClick = async (movementId: string) => {
    if (!confirm('Удалить это движение?')) return;
    try {
      await deleteMovement(itemType, itemId, movementId);
      loadMovements();
      onMovementChange?.();
    } catch (err) {
      setError('Не удалось удалить движение');
    }
  };

  const handleDialogSubmit = async (data: MovementFormData) => {
    if (dialogMode === 'add') {
      await createMovement(itemType, itemId, data);
    } else if (editingMovement) {
      await updateMovement(itemType, itemId, editingMovement.id, data);
    }
    loadMovements();
    onMovementChange?.();
  };

  const formatSum = (qty: number, price?: number): string => {
    if (price === undefined || price === null) return '-';
    return (qty * price).toFixed(2);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 700, md: 900 }, p: 2 },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          История движения: {itemName}
        </Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={handleAddClick}
        sx={{ mb: 2, alignSelf: 'flex-start' }}
      >
        Добавить движение
      </Button>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : movements.length === 0 ? (
        <Alert severity="info">Нет записей о движениях</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Дата</TableCell>
                <TableCell>Тип</TableCell>
                <TableCell align="right">Кол-во</TableCell>
                <TableCell align="right">Цена/ед</TableCell>
                <TableCell align="right">Сумма</TableCell>
                <TableCell>Поставщик</TableCell>
                <TableCell>ТТН</TableCell>
                <TableCell>Комментарий</TableCell>
                <TableCell align="center" sx={{ minWidth: 100 }}>Действия</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{movement.date}</TableCell>
                  <TableCell>
                    <Chip
                      label={getTypeLabel(movement.type)}
                      color={getTypeColor(movement.type)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">{movement.quantity}</TableCell>
                  <TableCell align="right">
                    {movement.pricePerUnit !== undefined ? movement.pricePerUnit.toFixed(2) : '-'}
                  </TableCell>
                  <TableCell align="right">
                    {formatSum(movement.quantity, movement.pricePerUnit)}
                  </TableCell>
                  <TableCell>{movement.supplier || '-'}</TableCell>
                  <TableCell>{movement.ttnNumber || '-'}</TableCell>
                  <TableCell>{movement.notes || '-'}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => handleEditClick(movement)}
                      title="Редактировать"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(movement.id)}
                      title="Удалить"
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <MovementDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleDialogSubmit}
        mode={dialogMode}
        initialData={editingMovement}
      />
    </Drawer>
  );
}

export default MovementHistoryDrawer;
