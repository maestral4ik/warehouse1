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
  Autocomplete,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import { StockMovement, MovementType } from '../types';
import { fetchSuppliers } from '../api';

export interface MovementFormData {
  date: string;
  type: MovementType;
  quantity: number;
  pricePerUnit?: number;
  supplier?: string;
  ttnNumber?: string;
  notes?: string;
}

interface MovementDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: MovementFormData) => Promise<void>;
  mode?: 'add' | 'edit';
  initialData?: StockMovement;
}

const movementTypes: { value: MovementType; label: string }[] = [
  { value: 'incoming', label: 'Поступление' },
  { value: 'outgoing', label: 'Выдача' },
];

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

function MovementDialog({ open, onClose, onSubmit, mode = 'add', initialData }: MovementDialogProps) {
  const [date, setDate] = useState('');
  const [type, setType] = useState<MovementType>('incoming');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [supplier, setSupplier] = useState('');
  const [ttnNumber, setTtnNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);

  const isEditMode = mode === 'edit';

  useEffect(() => {
    if (open) {
      setSuppliersLoading(true);
      fetchSuppliers()
        .then(setSuppliers)
        .catch(() => setSuppliers([]))
        .finally(() => setSuppliersLoading(false));
    }
  }, [open]);

  useEffect(() => {
    if (open && isEditMode && initialData) {
      setDate(toInputDate(initialData.date));
      setType(initialData.type);
      setQuantity(String(initialData.quantity));
      setPricePerUnit(initialData.pricePerUnit ? String(initialData.pricePerUnit) : '');
      setSupplier(initialData.supplier || '');
      setTtnNumber(initialData.ttnNumber || '');
      setNotes(initialData.notes || '');
    } else if (open && !isEditMode) {
      resetForm();
    }
  }, [open, isEditMode, initialData]);

  const resetForm = () => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setType('incoming');
    setQuantity('');
    setPricePerUnit('');
    setSupplier('');
    setTtnNumber('');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!date || !type || !quantity) {
      setError('Заполните обязательные поля: дата, тип, количество');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      setError('Количество должно быть положительным числом');
      return;
    }

    let price: number | undefined;
    if (pricePerUnit) {
      price = parseFloat(pricePerUnit);
      if (isNaN(price) || price < 0) {
        setError('Цена должна быть положительным числом');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        date: toDisplayDate(date),
        type,
        quantity: qty,
        pricePerUnit: price,
        supplier: supplier.trim() || undefined,
        ttnNumber: ttnNumber.trim() || undefined,
        notes: notes.trim() || undefined,
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
        {isEditMode ? 'Редактировать движение' : 'Добавить движение'}
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
            select
            label="Тип движения"
            value={type}
            onChange={(e) => setType(e.target.value as MovementType)}
            required
            fullWidth
          >
            {movementTypes.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Количество"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            fullWidth
            inputProps={{ min: 1 }}
          />

          <TextField
            label="Цена за единицу"
            type="number"
            value={pricePerUnit}
            onChange={(e) => setPricePerUnit(e.target.value)}
            fullWidth
            inputProps={{ min: 0, step: 0.01 }}
          />

          <Autocomplete
            freeSolo
            options={suppliers}
            value={supplier}
            onInputChange={(_, newValue) => setSupplier(newValue)}
            loading={suppliersLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Поставщик"
                placeholder="Выберите или введите нового"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {suppliersLoading ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />

          <TextField
            label="Номер ТТН"
            value={ttnNumber}
            onChange={(e) => setTtnNumber(e.target.value)}
            fullWidth
            placeholder="ТТН-2026-001"
          />

          <TextField
            label="Комментарий"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
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
