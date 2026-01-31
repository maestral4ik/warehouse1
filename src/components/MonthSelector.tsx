import { FormControl, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import { getMonthOptions } from '../api';

interface MonthSelectorProps {
  value: string;
  onChange: (month: string) => void;
}

function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const options = getMonthOptions();

  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value);
  };

  return (
    <FormControl
      size="small"
      sx={{
        minWidth: 180,
        '& .MuiOutlinedInput-root': {
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          color: 'white',
          '& fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.3)',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(255, 255, 255, 0.5)',
          },
          '&.Mui-focused fieldset': {
            borderColor: 'white',
          },
        },
        '& .MuiSelect-icon': {
          color: 'white',
        },
      }}
    >
      <Select
        id="month-selector"
        value={value}
        onChange={handleChange}
        displayEmpty
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default MonthSelector;
