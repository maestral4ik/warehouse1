import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  MenuItem,
} from '@mui/material';
import { StockMovement, OUTGOING_REASONS, DEFAULT_OUTGOING_REASON } from '../types';

export interface MovementFormData {
  date: string;
  type: 'outgoing';
  quantity: number;
  notes?: string;
}

interface MovementDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: MovementFormData) => Promise<void>;
  mode?: 'add' | 'edit';
  initialData?: StockMovement;
  categoryName?: string;
}

// Convert DD.MM.YYYY to YYYY-MM-DD for input
function toInputDate(dateStr: string): string {
  if (!dateStr) return '';
  const [day, month, year] = dateStr.split('.');
  if (!day || !month || !year) return '';
  return `${year}-${month}-${day}`;
}

// Convert YYYY-MM-DD to DD.MM.YYYY for storage
function toDisplayDate(inputDate: string): string {
  if (!inputDate) return '';
  const [year, month, day] = inputDate.split('-');
  if (!day || !month || !year) return '';
  return `${day}.${month}.${year}`;
}

function MovementDialog({ open, onClose, onSubmit, mode = 'add', initialData, categoryName }: MovementDialogProps) {
  const [date, setDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outgoingReason, setOutgoingReason] = useState('');

  const isEditMode = mode === 'edit';

  const reasons = categoryName ? (OUTGOING_REASONS[categoryName] || [DEFAULT_OUTGOING_REASON]) : [DEFAULT_OUTGOING_REASON];
  const hasMultipleReasons = reasons.length > 1;

  useEffect(() => {
    if (open && isEditMode && initialData) {
      setDate(toInputDate(initialData.date));
      setQuantity(String(initialData.quantity));
      // If editing outgoing movement, try to match notes to a reason
      if (initialData.notes) {
        if (reasons.includes(initialData.notes)) {
          setOutgoingReason(initialData.notes);
        }
      }
    } else if (open && !isEditMode) {
      resetForm();
    }
  }, [open, isEditMode, initialData, reasons]);

  const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setQuantity('');
    setOutgoingReason('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!date || !quantity) {
      setError('Заполните обязательные поля: дата, количество');
      return;
    }

    // For movements with multiple reasons, require a reason selection
    if (hasMultipleReasons && !outgoingReason) {
      setError('Выберите причину выдачи');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('Количество должно быть положительным числом');
      return;
    }

    setLoading(true);
    setError(null);

    const reason = hasMultipleReasons ? outgoingReason : reasons[0];

    try {
      await onSubmit({
        date: toDisplayDate(date),
        type: 'outgoing',
        quantity: qty,
        notes: reason,
      });
      handleClose();
    } catch (err) {
      setError(isEditMode ? 'Не удалось сохранить изменения' : 'Не удалось добавить движение');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEditMode ? 'Редактировать выдачу' : 'Добавить выдачу'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Дата"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Количество"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            fullWidth
            inputProps={{ min: 1 }}
          />

          {hasMultipleReasons ? (
            <TextField
              select
              label="Причина выдачи"
              value={outgoingReason}
              onChange={(e) => setOutgoingReason(e.target.value)}
              required
              fullWidth
            >
              {reasons.map((reason) => (
                <MenuItem key={reason} value={reason}>
                  {reason}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Причина выдачи"
              value={reasons[0]}
              disabled
              fullWidth
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Отмена
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading
            ? (isEditMode ? 'Сохранение...' : 'Добавление...')
            : (isEditMode ? 'Сохранить' : 'Добавить')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MovementDialog;
