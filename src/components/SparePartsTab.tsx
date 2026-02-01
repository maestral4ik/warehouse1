import { useState, useEffect } from 'react';
import { Box, Tabs, Tab, CircularProgress, Alert } from '@mui/material';
import CategoryTable from './CategoryTable';
import AddItemDialog, { ItemFormData, EditItemData } from './AddItemDialog';
import { WriteOffData } from './WriteOffDialog';
import MovementHistoryDrawer from './MovementHistoryDrawer';
import { fetchSpareParts, createSparePart, updateSparePart, writeOffItem } from '../api';
import { sparePartsColumns } from '../data/sparePartsData';
import { Category, SparePartItem } from '../types';

interface SparePartsTabProps {
  month: string;
  categoryTab: number;
  onCategoryChange: (category: number) => void;
}

function SparePartsTab({ month, categoryTab, onCategoryChange }: SparePartsTabProps) {
  const [data, setData] = useState<Category<SparePartItem>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditItemData | null>(null);
  const [editSubcategory, setEditSubcategory] = useState('');

  // Movement history drawer state
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SparePartItem | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await fetchSpareParts(month);
      setData(result);
      setError(null);
      // Reset category tab if current selection exceeds available categories
      if (categoryTab >= result.length && result.length > 0) {
        onCategoryChange(0);
      }
    } catch (err) {
      setError('Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [month]);

  const handleCategoryChange = (_event: React.SyntheticEvent, newValue: number) => {
    onCategoryChange(newValue);
  };

  const handleAddItem = async (categoryName: string, subcategoryName: string, item: ItemFormData) => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');

    await createSparePart(categoryName, subcategoryName, {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      supplier: item.supplier,
      ttnNumber: item.ttnNumber,
      lastMovementDate: dateStr,
      status: item.quantity > 0 ? 'in stock' : 'written off',
      movements: [
        {
          id: `m-${Date.now()}`,
          date: dateStr,
          type: 'incoming',
          quantity: item.quantity,
          notes: 'Первоначальное поступление',
        },
      ],
    });
  };

  const handleEditItem = (item: SparePartItem, subcategoryName: string) => {
    setEditingItem({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      supplier: item.supplier,
      ttnNumber: item.ttnNumber,
    });
    setEditSubcategory(subcategoryName);
    setEditDialogOpen(true);
  };

  const handleUpdateItem = async (item: ItemFormData) => {
    if (!editingItem) return;

    await updateSparePart(editingItem.id, {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      supplier: item.supplier,
      ttnNumber: item.ttnNumber,
      status: item.quantity > 0 ? 'in stock' : 'written off',
    });
    loadData();
  };

  const handleWriteOff = async (item: SparePartItem, writeOffData: WriteOffData) => {
    await writeOffItem('spare-parts', item.id, writeOffData);
    loadData();
  };

  const handleViewMovements = (item: SparePartItem) => {
    setSelectedItem(item);
    setHistoryDrawerOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (data.length === 0) {
    return <Alert severity="info">Нет данных за выбранный месяц.</Alert>;
  }

  // Ensure categoryTab is within bounds
  const safeCategoryTab = Math.min(categoryTab, data.length - 1);

  return (
    <Box>
      <AddItemDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        onSubmit={handleUpdateItem}
        subcategoryName={editSubcategory}
        mode="edit"
        initialData={editingItem || undefined}
      />

      {selectedItem && (
        <MovementHistoryDrawer
          open={historyDrawerOpen}
          onClose={() => setHistoryDrawerOpen(false)}
          itemId={selectedItem.id}
          itemName={selectedItem.name}
          itemType="spare-parts"
          onMovementChange={loadData}
        />
      )}

      <Tabs
        value={safeCategoryTab}
        onChange={handleCategoryChange}
        aria-label="spare parts categories"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: 3,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 500,
            color: 'text.secondary',
          },
          '& .Mui-selected': {
            color: 'secondary.main',
          },
          '& .MuiTabs-indicator': {
            backgroundColor: 'secondary.main',
          },
        }}
      >
        {data.map((category, index) => (
          <Tab key={category.name} label={category.name} id={`spare-parts-tab-${index}`} />
        ))}
      </Tabs>

      {data.map((category, index) => (
        <Box key={category.name} hidden={safeCategoryTab !== index}>
          {safeCategoryTab === index && (
            <CategoryTable<SparePartItem>
              category={category}
              columns={sparePartsColumns}
              statusField="status"
              selectedMonth={month}
              onRefresh={loadData}
              onAddItem={(subcategoryName, item) => handleAddItem(category.name, subcategoryName, item)}
              onEditItem={handleEditItem}
              onWriteOff={handleWriteOff}
              onViewMovements={handleViewMovements}
            />
          )}
        </Box>
      ))}
    </Box>
  );
}

export default SparePartsTab;
