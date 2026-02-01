import { useState, useEffect, useCallback } from 'react';
import { Box, Container, Tabs, Tab, Typography, AppBar, Toolbar } from '@mui/material';
import WarehouseIcon from '@mui/icons-material/Warehouse';
import TabPanel from './components/TabPanel';
import SparePartsTab from './components/SparePartsTab';
import MOTab from './components/MOTab';
import MonthSelector from './components/MonthSelector';
import { getCurrentMonth } from './api';

function a11yProps(index: number) {
  return {
    id: `tab-${index}`,
    'aria-controls': `tabpanel-${index}`,
  };
}

function getInitialTab(): number {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  return tab ? parseInt(tab, 10) : 0;
}

function getInitialMonth(): string {
  const params = new URLSearchParams(window.location.search);
  const month = params.get('month');
  return month || getCurrentMonth();
}

function getInitialCategory(): number {
  const params = new URLSearchParams(window.location.search);
  const category = params.get('category');
  return category ? parseInt(category, 10) : 0;
}

function updateURLParams(tab: number, month: string, category: number) {
  const params = new URLSearchParams();
  params.set('tab', tab.toString());
  params.set('month', month);
  params.set('category', category.toString());
  window.history.replaceState({}, '', `?${params.toString()}`);
}

function App() {
  const [tabValue, setTabValue] = useState(getInitialTab);
  const [selectedMonth, setSelectedMonth] = useState(getInitialMonth);
  const [categoryTab, setCategoryTab] = useState(getInitialCategory);

  useEffect(() => {
    updateURLParams(tabValue, selectedMonth, categoryTab);
  }, [tabValue, selectedMonth, categoryTab]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setCategoryTab(0); // Reset category when main tab changes
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
  };

  const handleCategoryChange = useCallback((newCategory: number) => {
    setCategoryTab(newCategory);
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar position="static" sx={{ backgroundColor: 'primary.main' }}>
        <Toolbar>
          <WarehouseIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, color: 'white' }}>
            Складской учет
          </Typography>
          <MonthSelector value={selectedMonth} onChange={handleMonthChange} />
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ mt: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: 'white', borderRadius: '8px 8px 0 0' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            aria-label="inventory tabs"
            sx={{ px: 2 }}
          >
            <Tab label="Отчет" {...a11yProps(0)} />
            <Tab label="Отчет МО" {...a11yProps(1)} />
          </Tabs>
        </Box>

        <Box sx={{ backgroundColor: 'white', borderRadius: '0 0 8px 8px', px: 3, pb: 3, mb: 3 }}>
          <TabPanel value={tabValue} index={0}>
            <SparePartsTab month={selectedMonth} categoryTab={categoryTab} onCategoryChange={handleCategoryChange} />
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            <MOTab month={selectedMonth} categoryTab={categoryTab} onCategoryChange={handleCategoryChange} />
          </TabPanel>
        </Box>
      </Container>
    </Box>
  );
}

export default App;
