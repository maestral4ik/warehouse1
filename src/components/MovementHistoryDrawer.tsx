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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
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
  categoryName?: string;
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
  categoryName,
}: MovementHistoryDrawerProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingMovement, setEditingMovement] = useState<StockMovement | undefined>();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [movementToDelete, setMovementToDelete] = useState<StockMovement | null>(null);

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
    // Only allow editing outgoing movements
    if (movement.type !== 'outgoing') return;
    setDialogMode('edit');
    setEditingMovement(movement);
    setDialogOpen(true);
  };

  const handleDeleteClick = (movement: StockMovement) => {
    // Don't allow deleting incoming movements
    if (movement.type === 'incoming') {
      setError('Нельзя удалить поступление. Измените количество через редактирование товара.');
      return;
    }
    setMovementToDelete(movement);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!movementToDelete) return;
    try {
      await deleteMovement(itemType, itemId, movementToDelete.id);
      loadMovements();
      onMovementChange?.();
    } catch (err) {
      setError('Не удалось удалить движение');
    } finally {
      setDeleteDialogOpen(false);
      setMovementToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setMovementToDelete(null);
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

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 500, md: 600 }, p: 2 },
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
        Добавить выдачу
      </Button>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

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
                <TableCell>Примечание</TableCell>
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
                  <TableCell>{movement.notes || '-'}</TableCell>
                  <TableCell align="center">
                    {movement.type === 'outgoing' && (
                      <>
                        <IconButton
                          size="small"
                          onClick={() => handleEditClick(movement)}
                          title="Редактировать"
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteClick(movement)}
                          title="Удалить"
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </>
                    )}
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
        categoryName={categoryName}
      />

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Удаление движения</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите удалить это движение?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Отмена</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  );
}

export default MovementHistoryDrawer;
