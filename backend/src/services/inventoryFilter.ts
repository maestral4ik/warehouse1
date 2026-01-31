import { SparePartItem, MOItem, Category, StockMovement } from '../types';

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
 * Determine if an item should be visible for the selected month.
 *
 * Rules:
 * 1. Item is visible if it had any stock balance during the month
 * 2. Item is visible if it had any movement during the month
 * 3. Item is NOT visible if it was fully written off in a previous month
 *    AND has no new incoming movement in the selected month
 */
export function shouldItemBeVisible<T extends SparePartItem | MOItem>(
  item: T,
  targetMonth: string
): boolean {
  // If item was written off
  if (item.writtenOffDate) {
    const writtenOffYearMonth = getYearMonth(item.writtenOffDate);

    // If written off in the target month - show it (with "written off" status)
    if (writtenOffYearMonth === targetMonth) {
      return true;
    }

    // If written off before the target month
    if (isBeforeMonth(item.writtenOffDate, targetMonth)) {
      // Check if there's any incoming movement in or after target month
      if (hasIncomingMovementInOrAfterMonth(item.movements, targetMonth)) {
        return true;
      }
      // No new incoming after write-off - hide it
      return false;
    }
  }

  // Check if item has any movement in the target month
  if (hasMovementInMonth(item.movements, targetMonth)) {
    return true;
  }

  // Check if item existed before or during this month (had any earlier movement)
  const hasEarlierMovement = item.movements.some(m => {
    const movementYearMonth = getYearMonth(m.date);
    return movementYearMonth <= targetMonth;
  });

  return hasEarlierMovement;
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
      } else if (movement.type === 'outgoing' || movement.type === 'write-off') {
        quantity -= movement.quantity;
      }
    }
  }

  if (quantity <= 0) {
    // For MO items use 'consumed', for spare parts use 'out of stock'
    return ('code' in item ? 'consumed' : 'out of stock') as T['status'];
  }

  return 'in stock' as T['status'];
}

/**
 * Filter categories by month
 */
export function filterCategoriesByMonth<T extends SparePartItem | MOItem>(
  categories: Category<T>[],
  targetMonth: string
): Category<T>[] {
  return categories.map(category => ({
    ...category,
    subcategories: category.subcategories.map(subcategory => ({
      ...subcategory,
      items: subcategory.items
        .filter(item => shouldItemBeVisible(item, targetMonth))
        .map(item => ({
          ...item,
          status: getItemStatusForMonth(item, targetMonth),
        })),
    })).filter(sub => sub.items.length > 0),
  })).filter(cat => cat.subcategories.length > 0);
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
