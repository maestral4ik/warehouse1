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
  MenuItem,
} from '@mui/material';
import { OUTGOING_REASONS, DEFAULT_OUTGOING_REASON } from '../types';

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
  categoryName?: string;
}

function WriteOffDialog({ open, onClose, onSubmit, itemName, maxQuantity, unit, month, categoryName }: WriteOffDialogProps) {
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outgoingReason, setOutgoingReason] = useState('');

  const reasons = categoryName ? (OUTGOING_REASONS[categoryName] || [DEFAULT_OUTGOING_REASON]) : [DEFAULT_OUTGOING_REASON];
  const hasMultipleReasons = reasons.length > 1;

  useEffect(() => {
    if (open) {
      setQuantity('');
      setOutgoingReason('');
      setError(null);
    }
  }, [open]);

  const handleClose = () => {
    setQuantity('');
    setOutgoingReason('');
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

    // For multiple reasons, require selection
    if (hasMultipleReasons && !outgoingReason) {
      setError('Выберите причину списания');
      return;
    }

    setLoading(true);
    setError(null);

    // Determine final notes value: use reason (single or selected)
    const reason = hasMultipleReasons ? outgoingReason : reasons[0];

    try {
      await onSubmit({
        quantity: qty,
        notes: reason,
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

          {hasMultipleReasons ? (
            <TextField
              select
              label="Причина списания"
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
              label="Причина списания"
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
        <Button onClick={handleSubmit} variant="contained" color="warning" disabled={loading}>
          {loading ? 'Списание...' : 'Списать'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default WriteOffDialog;
