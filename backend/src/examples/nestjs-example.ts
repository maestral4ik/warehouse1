/**
 * NestJS Implementation Example for Month-Based Filtering
 *
 * This file shows how to implement the same filtering logic in NestJS.
 * Copy relevant parts to your NestJS project.
 */

// ============================================
// 1. DTOs (Data Transfer Objects)
// ============================================

// src/inventory/dto/inventory-query.dto.ts
export class InventoryQueryDto {
  /**
   * Month filter in YYYY-MM format
   * @example "2026-01"
   */
  month?: string;
}

// ============================================
// 2. Entities (TypeORM Example)
// ============================================

// src/inventory/entities/stock-movement.entity.ts
/*
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';
import { Product } from './product.entity';

export type MovementType = 'incoming' | 'outgoing' | 'transfer' | 'write-off';

@Entity()
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'enum', enum: ['incoming', 'outgoing', 'transfer', 'write-off'] })
  type: MovementType;

  @Column()
  quantity: number;

  @Column({ nullable: true })
  notes: string;

  @ManyToOne(() => Product, product => product.movements)
  product: Product;
}
*/

// src/inventory/entities/product.entity.ts
/*
import { Entity, Column, PrimaryGeneratedColumn, OneToMany, ManyToOne } from 'typeorm';
import { StockMovement } from './stock-movement.entity';
import { Subcategory } from './subcategory.entity';

@Entity()
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  partNumber: string;

  @Column()
  quantity: number;

  @Column()
  unit: string;

  @Column({ type: 'date', nullable: true })
  writtenOffDate: Date | null;

  @OneToMany(() => StockMovement, movement => movement.product)
  movements: StockMovement[];

  @ManyToOne(() => Subcategory, subcategory => subcategory.products)
  subcategory: Subcategory;
}
*/

// ============================================
// 3. Service Implementation
// ============================================

// src/inventory/inventory.service.ts
/*
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, Between } from 'typeorm';
import { Product } from './entities/product.entity';
import { StockMovement } from './entities/stock-movement.entity';

@Injectable()
export class InventoryService {

  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    @InjectRepository(StockMovement)
    private movementRepository: Repository<StockMovement>,
  ) {}

  /**
   * Get products filtered by month
   */
  async getProductsByMonth(month: string) {
    const { startDate, endDate } = this.getMonthDateRange(month);

    // Get all products with their movements
    const products = await this.productRepository.find({
      relations: ['movements', 'subcategory', 'subcategory.category'],
    });

    // Filter products based on visibility rules
    const visibleProducts = products.filter(product =>
      this.shouldProductBeVisible(product, month, startDate, endDate)
    );

    // Calculate status for each product for the given month
    return visibleProducts.map(product => ({
      ...product,
      status: this.calculateStatusForMonth(product, endDate),
    }));
  }

  /**
   * Determine if a product should be visible for the selected month
   */
  private shouldProductBeVisible(
    product: Product,
    month: string,
    startDate: Date,
    endDate: Date
  ): boolean {
    // Rule 1: If written off before this month with no new incoming, hide it
    if (product.writtenOffDate) {
      const writtenOffMonth = this.dateToYearMonth(product.writtenOffDate);

      // Written off in this month - show it
      if (writtenOffMonth === month) {
        return true;
      }

      // Written off before this month
      if (product.writtenOffDate < startDate) {
        // Check for incoming movement in or after this month
        const hasNewIncoming = product.movements.some(
          m => m.type === 'incoming' && m.date >= startDate
        );
        if (!hasNewIncoming) {
          return false;
        }
      }
    }

    // Rule 2: Has movement in this month
    const hasMovementInMonth = product.movements.some(
      m => m.date >= startDate && m.date <= endDate
    );
    if (hasMovementInMonth) {
      return true;
    }

    // Rule 3: Had stock at any point before or during this month
    const hadEarlierMovement = product.movements.some(
      m => m.date <= endDate
    );

    return hadEarlierMovement;
  }

  /**
   * Calculate product status at end of given month
   */
  private calculateStatusForMonth(product: Product, endDate: Date): string {
    // If written off during or before this month's end
    if (product.writtenOffDate && product.writtenOffDate <= endDate) {
      return 'written off';
    }

    // Calculate quantity at end of month
    let quantity = 0;
    for (const movement of product.movements) {
      if (movement.date <= endDate) {
        if (movement.type === 'incoming') {
          quantity += movement.quantity;
        } else if (movement.type === 'outgoing' || movement.type === 'write-off') {
          quantity -= movement.quantity;
        }
      }
    }

    return quantity > 0 ? 'in stock' : 'out of stock';
  }

  /**
   * Get start and end dates for a month (YYYY-MM)
   */
  private getMonthDateRange(month: string): { startDate: Date; endDate: Date } {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0); // Last day of month
    return { startDate, endDate };
  }

  /**
   * Convert Date to YYYY-MM format
   */
  private dateToYearMonth(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return \`\${year}-\${month}\`;
  }
}
*/

// ============================================
// 4. Controller Implementation
// ============================================

// src/inventory/inventory.controller.ts
/*
import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryQueryDto } from './dto/inventory-query.dto';

@Controller('api')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('spare-parts')
  async getSpareParts(@Query() query: InventoryQueryDto) {
    const month = query.month || this.getCurrentMonth();

    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Invalid month format. Use YYYY-MM');
    }

    return this.inventoryService.getProductsByMonth(month);
  }

  @Get('mo')
  async getMOItems(@Query() query: InventoryQueryDto) {
    const month = query.month || this.getCurrentMonth();

    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('Invalid month format. Use YYYY-MM');
    }

    return this.inventoryService.getMOItemsByMonth(month);
  }

  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return \`\${year}-\${month}\`;
  }
}
*/

// ============================================
// 5. SQL Query Examples (Raw SQL)
// ============================================

/**
 * SQL Query to get products visible in a specific month
 *
 * This query handles:
 * - Products with movements in the month
 * - Products with stock balance (had movements before month end)
 * - Excludes products written off before the month (unless new incoming)
 */
const SQL_QUERY_EXAMPLE = `
-- Get products visible for a specific month
-- Parameters: :monthStart (first day), :monthEnd (last day), :monthString (YYYY-MM)

SELECT DISTINCT p.*,
  CASE
    WHEN p.written_off_date IS NOT NULL
         AND p.written_off_date <= :monthEnd
    THEN 'written off'
    WHEN (
      SELECT COALESCE(SUM(
        CASE WHEN m.type = 'incoming' THEN m.quantity
             WHEN m.type IN ('outgoing', 'write-off') THEN -m.quantity
             ELSE 0 END
      ), 0)
      FROM stock_movements m
      WHERE m.product_id = p.id AND m.date <= :monthEnd
    ) > 0
    THEN 'in stock'
    ELSE 'out of stock'
  END as calculated_status
FROM products p
LEFT JOIN stock_movements sm ON sm.product_id = p.id
WHERE
  -- Include if: has movement in this month
  (sm.date BETWEEN :monthStart AND :monthEnd)
  OR
  -- Include if: had any movement before/during this month (has history)
  (sm.date <= :monthEnd)
  -- Exclude if: written off before this month AND no new incoming in/after this month
  AND NOT (
    p.written_off_date IS NOT NULL
    AND p.written_off_date < :monthStart
    AND NOT EXISTS (
      SELECT 1 FROM stock_movements m2
      WHERE m2.product_id = p.id
        AND m2.type = 'incoming'
        AND m2.date >= :monthStart
    )
  )
ORDER BY p.name;
`;

// ============================================
// 6. TypeORM QueryBuilder Example
// ============================================

const TYPEORM_QUERY_EXAMPLE = `
// Using TypeORM QueryBuilder

async getVisibleProducts(month: string) {
  const { startDate, endDate } = this.getMonthDateRange(month);

  const products = await this.productRepository
    .createQueryBuilder('product')
    .leftJoinAndSelect('product.movements', 'movement')
    .leftJoinAndSelect('product.subcategory', 'subcategory')
    .leftJoinAndSelect('subcategory.category', 'category')
    .where(
      // Has movement in month OR has earlier movement
      new Brackets(qb => {
        qb.where('movement.date BETWEEN :startDate AND :endDate', { startDate, endDate })
          .orWhere('movement.date <= :endDate', { endDate });
      })
    )
    .andWhere(
      // Not written off before month, OR has new incoming
      new Brackets(qb => {
        qb.where('product.writtenOffDate IS NULL')
          .orWhere('product.writtenOffDate >= :startDate', { startDate })
          .orWhere(
            // Has incoming movement in or after this month
            qb2 => {
              const subQuery = qb2
                .subQuery()
                .select('1')
                .from(StockMovement, 'm')
                .where('m.productId = product.id')
                .andWhere('m.type = :incoming', { incoming: 'incoming' })
                .andWhere('m.date >= :startDate', { startDate })
                .getQuery();
              return 'EXISTS ' + subQuery;
            }
          );
      })
    )
    .getMany();

  return products;
}
`;

console.log('NestJS implementation examples loaded');
console.log('See the file for Controller, Service, Entity, and SQL examples');
