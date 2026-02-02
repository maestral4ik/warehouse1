import { SparePartItem, MOItem, Category, StockMovement } from '../types';

/**
 * Monthly balance calculation result
 */
export interface MonthlyBalance {
  openingQty: number;      // Balance before the month
  incomingQty: number;     // Incoming during the month
  issuedQty: number;       // Outgoing during the month
  endingQty: number;       // Balance at end of month
}

/**
 * Parse date string (DD.MM.YYYY) to Date object
 */
function parseDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split('.').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get year and month from date string (DD.MM.YYYY)
 * Returns format: YYYY-MM
 */
function getYearMonth(dateStr: string): string {
  const [day, month, year] = dateStr.split('.');
  return `${year}-${month.padStart(2, '0')}`;
}

/**
 * Check if a date string (DD.MM.YYYY) falls within the specified month (YYYY-MM)
 */
function isInMonth(dateStr: string, targetMonth: string): boolean {
  return getYearMonth(dateStr) === targetMonth;
}

/**
 * Check if a date string (DD.MM.YYYY) is before the specified month (YYYY-MM)
 */
function isBeforeMonth(dateStr: string, targetMonth: string): boolean {
  const itemYearMonth = getYearMonth(dateStr);
  return itemYearMonth < targetMonth;
}

/**
 * Calculate rolling monthly balance for an item
 *
 * Opening Quantity = Sum(incoming before M) − Sum(outgoing before M)
 * Incoming Quantity = All incoming movements within month M
 * Issued Quantity = All outgoing movements within month M
 * Ending Quantity = Opening + Incoming − Issued
 */
export function calculateMonthlyBalance(movements: StockMovement[], targetMonth: string): MonthlyBalance {
  let openingQty = 0;
  let incomingQty = 0;
  let issuedQty = 0;

  for (const movement of movements) {
    const movementMonth = getYearMonth(movement.date);
    const qty = movement.quantity;

    if (movementMonth < targetMonth) {
      // Before target month - affects opening balance
      if (movement.type === 'incoming') {
        openingQty += qty;
      } else if (movement.type === 'outgoing') {
        openingQty -= qty;
      }
    } else if (movementMonth === targetMonth) {
      // Within target month
      if (movement.type === 'incoming') {
        incomingQty += qty;
      } else if (movement.type === 'outgoing') {
        issuedQty += qty;
      }
    }
    // Movements after target month are ignored
  }

  const endingQty = openingQty + incomingQty - issuedQty;

  return {
    openingQty: Math.max(0, openingQty),
    incomingQty,
    issuedQty,
    endingQty: Math.max(0, endingQty),
  };
}

/**
 * Calculate total current available quantity (sum of all movements up to now)
 * Used for write-off validation
 */
export function calculateCurrentStock(movements: StockMovement[]): number {
  let stock = 0;

  for (const movement of movements) {
    if (movement.type === 'incoming') {
      stock += movement.quantity;
    } else if (movement.type === 'outgoing') {
      stock -= movement.quantity;
    }
  }

  return Math.max(0, stock);
}

/**
 * Check if item has any movement in the specified month
 */
function hasMovementInMonth(movements: StockMovement[], targetMonth: string): boolean {
  return movements.some(m => isInMonth(m.date, targetMonth));
}

/**
 * Check if item has any incoming movement in or after the specified month
 */
function hasIncomingMovementInOrAfterMonth(movements: StockMovement[], targetMonth: string): boolean {
  return movements.some(m => {
    const movementYearMonth = getYearMonth(m.date);
    return m.type === 'incoming' && movementYearMonth >= targetMonth;
  });
}

/**
 * Check if item has any incoming movement in the specified month
 */
function hasIncomingInMonth(movements: StockMovement[], targetMonth: string): boolean {
  return movements.some(m => m.type === 'incoming' && isInMonth(m.date, targetMonth));
}

/**
 * Calculate ending balance for the month before the target month
 */
function getEndingBalanceBeforeMonth(movements: StockMovement[], targetMonth: string): number {
  let balance = 0;
  for (const movement of movements) {
    const movementMonth = getYearMonth(movement.date);
    if (movementMonth < targetMonth) {
      if (movement.type === 'incoming') {
        balance += movement.quantity;
      } else if (movement.type === 'outgoing') {
        balance -= movement.quantity;
      }
    }
  }
  return balance;
}

/**
 * Determine if an item should be visible for the selected month.
 *
 * Rules:
 * 1. Item is visible if it has any movement in the target month
 * 2. Item is visible if it had stock balance at start of target month (opening > 0)
 * 3. Item is NOT visible if ending balance was 0 before target month
 *    AND has no incoming movement in the target month
 */
export function shouldItemBeVisible<T extends SparePartItem | MOItem>(
  item: T,
  targetMonth: string
): boolean {
  // Check if item has any movement in the target month
  if (hasMovementInMonth(item.movements, targetMonth)) {
    return true;
  }

  // Calculate opening balance (ending balance of previous months)
  const openingBalance = getEndingBalanceBeforeMonth(item.movements, targetMonth);

  // If opening balance > 0, item should be visible
  if (openingBalance > 0) {
    return true;
  }

  // Opening balance is 0 - only show if there's incoming in target month
  if (hasIncomingInMonth(item.movements, targetMonth)) {
    return true;
  }

  // Check if item has any movement at all before this month (to show items that existed)
  const hasAnyMovementBefore = item.movements.some(m => {
    const movementMonth = getYearMonth(m.date);
    return movementMonth < targetMonth;
  });

  // If item had movements before but balance is 0, don't show (written off)
  if (hasAnyMovementBefore && openingBalance <= 0) {
    return false;
  }

  return false;
}

/**
 * Calculate item status for the specific month
 */
export function getItemStatusForMonth<T extends SparePartItem | MOItem>(
  item: T,
  targetMonth: string
): T['status'] {
  // If written off in this month
  if (item.writtenOffDate && isInMonth(item.writtenOffDate, targetMonth)) {
    return 'written off' as T['status'];
  }

  // Calculate quantity at end of target month
  let quantity = 0;
  for (const movement of item.movements) {
    const movementYearMonth = getYearMonth(movement.date);
    if (movementYearMonth <= targetMonth) {
      if (movement.type === 'incoming') {
        quantity += movement.quantity;
      } else if (movement.type === 'outgoing') {
        quantity -= movement.quantity;
      }
    }
  }

  if (quantity <= 0) {
    // For MO items use 'consumed', for spare parts use 'written off'
    return ('code' in item ? 'consumed' : 'written off') as T['status'];
  }

  return 'in stock' as T['status'];
}

/**
 * Filter categories by month and calculate rolling balances
 * Note: Empty categories/subcategories are preserved so users can add items to them
 */
export function filterCategoriesByMonth<T extends SparePartItem | MOItem>(
  categories: Category<T>[],
  targetMonth: string
): Category<T & MonthlyBalance>[] {
  return categories.map(category => ({
    ...category,
    subcategories: category.subcategories.map(subcategory => ({
      ...subcategory,
      items: subcategory.items
        .filter(item => shouldItemBeVisible(item, targetMonth))
        .map(item => {
          const balance = calculateMonthlyBalance(item.movements, targetMonth);
          return {
            ...item,
            status: getItemStatusForMonth(item, targetMonth),
            // Add computed monthly balance fields
            openingQty: balance.openingQty,
            incomingQty: balance.incomingQty,
            issuedQty: balance.issuedQty,
            endingQty: balance.endingQty,
          };
        }),
    })),
  }));
}

/**
 * Get current month in YYYY-MM format
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
