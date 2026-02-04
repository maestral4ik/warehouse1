import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Box, Tabs, Tab, CircularProgress, Alert, Backdrop } from '@mui/material';
import CategoryTable from './CategoryTable';
import AddItemDialog, { ItemFormData, EditItemData } from './AddItemDialog';
import { WriteOffData } from './WriteOffDialog';
import MovementHistoryDrawer from './MovementHistoryDrawer';
import { fetchMOItems, createMOItem, updateMOItem, writeOffItem, deleteMOItem } from '../api';
import { getMOColumns } from '../data/moData';
import { Category, MOItem } from '../types';

interface MOTabProps {
  month: string;
  categoryTab: number;
  onCategoryChange: (category: number) => void;
}

function MOTab({ month, categoryTab, onCategoryChange }: MOTabProps) {
  const [data, setData] = useState<Category<MOItem>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EditItemData | null>(null);
  const [editSubcategory, setEditSubcategory] = useState('');

  // Movement history drawer state
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MOItem | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const result = await fetchMOItems(month);
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
      setRefreshing(false);
      isInitialLoad.current = false;
    }
  }, [month, categoryTab, onCategoryChange]);

  useEffect(() => {
    loadData(false);
  }, [month]);

  const refreshData = useCallback(() => {
    loadData(true);
  }, [loadData]);

  const handleCategoryChange = useCallback((_event: React.SyntheticEvent, newValue: number) => {
    onCategoryChange(newValue);
  }, [onCategoryChange]);

  const handleAddItem = useCallback(async (categoryName: string, subcategoryName: string, item: ItemFormData) => {
    const today = new Date();
    const dateStr = today.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');

    await createMOItem(categoryName, subcategoryName, {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      supplier: item.supplier,
      ttnNumber: item.ttnNumber,
      lastUseDate: dateStr,
      status: item.quantity > 0 ? 'in stock' : 'consumed',
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
  }, []);

  const handleEditItem = useCallback((item: MOItem, subcategoryName: string) => {
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
  }, []);

  const handleUpdateItem = useCallback(async (item: ItemFormData) => {
    if (!editingItem) return;

    await updateMOItem(editingItem.id, {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price: item.price,
      supplier: item.supplier,
      ttnNumber: item.ttnNumber,
      status: item.quantity > 0 ? 'in stock' : 'consumed',
    });
    refreshData();
  }, [editingItem, refreshData]);

  const handleWriteOff = useCallback(async (item: MOItem, writeOffData: WriteOffData) => {
    await writeOffItem('mo', item.id, writeOffData);
    refreshData();
  }, [refreshData]);

  const handleViewMovements = useCallback((item: MOItem) => {
    setSelectedItem(item);
    setHistoryDrawerOpen(true);
  }, []);

  const handleDeleteItem = useCallback(async (item: MOItem) => {
    await deleteMOItem(item.id);
    refreshData();
  }, [refreshData]);

  const handleCloseEditDialog = useCallback(() => setEditDialogOpen(false), []);
  const handleCloseHistoryDrawer = useCallback(() => setHistoryDrawerOpen(false), []);

  // Ensure categoryTab is within bounds
  const safeCategoryTab = Math.min(categoryTab, data.length - 1);

  // Memoize columns for each category to prevent recreation on every render
  const columnsMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof getMOColumns>> = {};
    data.forEach(category => {
      map[category.name] = getMOColumns(category.name);
    });
    return map;
  }, [data]);

  // Memoize add item handlers per category
  const addItemHandlers = useMemo(() => {
    const handlers: Record<string, (subcategoryName: string, item: ItemFormData) => Promise<void>> = {};
    data.forEach(category => {
      handlers[category.name] = (subcategoryName: string, item: ItemFormData) =>
        handleAddItem(category.name, subcategoryName, item);
    });
    return handlers;
  }, [data, handleAddItem]);

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

  return (
    <Box sx={{ position: 'relative' }}>
      <Backdrop
        sx={{
          position: 'absolute',
          zIndex: 10,
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
        }}
        open={refreshing}
      >
        <CircularProgress color="primary" />
      </Backdrop>

      <AddItemDialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        onSubmit={handleUpdateItem}
        subcategoryName={editSubcategory}
        mode="edit"
        initialData={editingItem || undefined}
      />

      {selectedItem && (
        <MovementHistoryDrawer
          open={historyDrawerOpen}
          onClose={handleCloseHistoryDrawer}
          itemId={selectedItem.id}
          itemName={selectedItem.name}
          itemType="mo"
          onMovementChange={refreshData}
          categoryName={data[safeCategoryTab]?.name}
        />
      )}

      <Tabs
        value={safeCategoryTab}
        onChange={handleCategoryChange}
        aria-label="MO categories"
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
          <Tab key={category.name} label={category.name} id={`mo-tab-${index}`} />
        ))}
      </Tabs>

      {data.map((category, index) => (
        <Box key={category.name} hidden={safeCategoryTab !== index}>
          {safeCategoryTab === index && (
            <CategoryTable<MOItem>
              category={category}
              columns={columnsMap[category.name]}
              statusField="status"
              selectedMonth={month}
              categoryName={category.name}
              onRefresh={refreshData}
              onAddItem={addItemHandlers[category.name]}
              onEditItem={handleEditItem}
              onWriteOff={handleWriteOff}
              onViewMovements={handleViewMovements}
              onDeleteItem={handleDeleteItem}
            />
          )}
        </Box>
      ))}
    </Box>
  );
}

export default MOTab;
