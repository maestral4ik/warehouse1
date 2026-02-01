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
  Typography,
} from '@mui/material';

export interface WriteOffData {
  quantity: number;
  notes?: string;
  month?: string;
}

interface WriteOffDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: WriteOffData) => Promise<void>;
  itemName: string;
  maxQuantity: number;
  unit: string;
  month?: string;
}

function WriteOffDialog({ open, onClose, onSubmit, itemName, maxQuantity, unit, month }: WriteOffDialogProps) {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setQuantity('');
      setNotes('');
      setError(null);
    }
  }, [open]);

  const handleClose = () => {
    setQuantity('');
    setNotes('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    const qty = parseInt(quantity, 10);

    if (!quantity || isNaN(qty)) {
      setError('Введите количество');
      return;
    }

    if (qty <= 0) {
      setError('Количество должно быть больше 0');
      return;
    }

    if (qty > maxQuantity) {
      setError(`Количество не может превышать ${maxQuantity} ${unit}`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        quantity: qty,
        notes: notes.trim() || undefined,
        month,
      });
      handleClose();
    } catch (err) {
      setError('Не удалось списать товар');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Списание товара</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Typography variant="body1">
            <strong>Товар:</strong> {itemName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Доступно для списания: {maxQuantity} {unit}
          </Typography>

          <TextField
            label="Количество для списания"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            fullWidth
            autoFocus
            inputProps={{ min: 1, max: maxQuantity }}
            helperText={`Максимум: ${maxQuantity} ${unit}`}
          />

          <TextField
            label="Примечание"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Причина списания (необязательно)"
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Отмена
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="warning" disabled={loading}>
          {loading ? 'Списание...' : 'Списать'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default WriteOffDialog;
