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
} from '@mui/material';
import { fetchSuppliers } from '../api';

export interface ItemFormData {
  name: string;
  quantity: number;
  unit: string;
  price: number;
  supplier: string;
  ttnNumber: string;
}

export interface EditItemData extends ItemFormData {
  id: string;
}

interface AddItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (item: ItemFormData) => Promise<void>;
  subcategoryName: string;
  mode?: 'add' | 'edit';
  initialData?: EditItemData;
}

function AddItemDialog({ open, onClose, onSubmit, subcategoryName, mode = 'add', initialData }: AddItemDialogProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('шт');
  const [price, setPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [ttnNumber, setTtnNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suppliers autocomplete state
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);

  const isEditMode = mode === 'edit';

  // Fetch suppliers when dialog opens
  useEffect(() => {
    if (open) {
      setSuppliersLoading(true);
      fetchSuppliers()
        .then(setSuppliers)
        .catch(() => setSuppliers([]))
        .finally(() => setSuppliersLoading(false));
    }
  }, [open]);

  // Pre-populate form when editing
  useEffect(() => {
    if (open && isEditMode && initialData) {
      setName(initialData.name);
      setQuantity(String(initialData.quantity));
      setUnit(initialData.unit);
      setPrice(String(initialData.price));
      setSupplier(initialData.supplier || '');
      setTtnNumber(initialData.ttnNumber || '');
    } else if (open && !isEditMode) {
      resetForm();
    }
  }, [open, isEditMode, initialData]);

  const resetForm = () => {
    setName('');
    setQuantity('');
    setUnit('шт');
    setPrice('');
    setSupplier('');
    setTtnNumber('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    // Only name, quantity, unit and price are required
    if (!name || !quantity || !unit || !price) {
      setError('Заполните обязательные поля');
      return;
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 0) {
      setError('Количество должно быть положительным числом');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('Цена должна быть положительным числом');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        name,
        quantity: qty,
        unit,
        price: priceNum,
        supplier: supplier.trim(),
        ttnNumber: ttnNumber.trim(),
      });
      handleClose();
    } catch (err) {
      setError(isEditMode ? 'Не удалось сохранить изменения' : 'Не удалось добавить товар');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEditMode ? `Редактировать товар в "${subcategoryName}"` : `Добавить товар в "${subcategoryName}"`}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="Наименование"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            autoFocus
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Количество"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              sx={{ flex: 1 }}
              inputProps={{ min: 0 }}
            />

            <TextField
              label="Ед. измерения"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              required
              sx={{ flex: 1 }}
              placeholder="шт, л, кг..."
            />
          </Box>

          <TextField
            label="Цена"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
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

export default AddItemDialog;
