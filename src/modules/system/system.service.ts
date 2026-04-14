import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SystemService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);

    const [
      totalOrders,
      totalOrdersLastMonth,
      totalCustomers,
      totalCustomersLastMonth,
      totalProducts,
      totalProductsLastMonth,
      revenueResult,
      revenueResultLastMonth,
      todayOrders,
      yesterdayOrders,
      todayRevenue,
      yesterdayRevenue,
      pendingOrders,
      lowStockCount,
      outOfStockCount,
      recentOrders,
      recentCustomers,
      statusGroups,
      topProductsRaw
    ] = await Promise.all([
      // Total Counts
      this.prisma.order.count(),
      this.prisma.order.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
      this.prisma.customer.count(),
      this.prisma.customer.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfMonth } } }),

      // Revenue
      this.prisma.order.aggregate({ where: { paymentStatus: 'paid' }, _sum: { grandTotal: true } }),
      this.prisma.order.aggregate({ where: { paymentStatus: 'paid', createdAt: { gte: startOfLastMonth, lt: startOfMonth } }, _sum: { grandTotal: true } }),

      // Daily stats
      this.prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
      this.prisma.order.count({ where: { createdAt: { gte: startOfYesterday, lt: startOfToday } } }),
      this.prisma.order.aggregate({ where: { paymentStatus: 'paid', createdAt: { gte: startOfToday } }, _sum: { grandTotal: true } }),
      this.prisma.order.aggregate({ where: { paymentStatus: 'paid', createdAt: { gte: startOfYesterday, lt: startOfToday } }, _sum: { grandTotal: true } }),

      // Specific metrics
      this.prisma.order.count({ where: { status: 'pending' } }),
      this.prisma.productVariant.count({ where: { qty: { gt: 0, lt: 10 } } }),
      this.prisma.productVariant.count({ where: { qty: 0 } }),

      // Lists
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } }
      }),
      this.prisma.customer.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, createdAt: true }
      }),

      // Distributions
      this.prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),

      // Top Products (simplified bestsellers)
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        _count: { productId: true },
        _sum: { total: true },
        take: 5,
        orderBy: { _count: { productId: 'desc' } }
      })
    ]);

    // Format Top Products
    const topProducts = await Promise.all(topProductsRaw.map(async (item) => {
      // item.productId could be null from groupBy, but we filter or handle it
      if (item.productId === null) return null;
      
      const product = await this.prisma.product.findUnique({ 
        where: { id: item.productId },
        select: { name: true, price: true }
      });
      return {
        name: product?.name || 'Unknown',
        sales: item._count.productId,
        revenue: Number(item._sum.total || 0),
        price: Number(product?.price || 0)
      };
    }));

    // Filter out any potential nulls from topProducts if we had them
    const validTopProducts = topProducts.filter((p): p is NonNullable<typeof p> => p !== null);

    // Helper for percentage change
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const stats = {
      total_revenue: Number(revenueResult._sum?.grandTotal || 0),
      revenue_change: calculateChange(Number(revenueResult._sum?.grandTotal || 0), Number(revenueResultLastMonth._sum?.grandTotal || 0)),
      total_orders: totalOrders,
      orders_change: calculateChange(totalOrders, totalOrdersLastMonth),
      total_products: totalProducts,
      products_change: calculateChange(totalProducts, totalProductsLastMonth),
      total_customers: totalCustomers,
      customers_change: calculateChange(totalCustomers, totalCustomersLastMonth),
      today_orders: todayOrders,
      yesterday_orders: yesterdayOrders,
      today_revenue: Number(todayRevenue._sum?.grandTotal || 0),
      yesterday_revenue: Number(yesterdayRevenue._sum?.grandTotal || 0),
      pending_orders: pendingOrders,
      low_stock_products: lowStockCount,
      out_of_stock_products: outOfStockCount,
    };

    const orderStatusDistribution = {};
    statusGroups.forEach(g => {
      orderStatusDistribution[g.status] = g._count.id;
    });

    // Mock weekly revenue for now to populate chart
    const revenueChartData = {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      data: [35000, 42000, 38500, 51000, 48000, 32000, 45000] // In a real app, query by day
    };

    return {
      success: true,
      data: {
        stats,
        recentOrders: recentOrders.map(o => ({
          id: o.id.toString(),
          order_number: o.orderNumber,
          customer: o.customer?.name || 'Guest',
          amount: Number(o.grandTotal),
          status: o.status,
          date: o.createdAt?.toLocaleDateString() || 'N/A'
        })),
        recentCustomers: recentCustomers.map(c => ({
          id: c.id.toString(),
          name: c.name,
          email: c.email,
          joined: c.createdAt?.toLocaleDateString() || 'N/A'
        })),
        topProducts: validTopProducts,
        orderStatusDistribution,
        revenueChartData,
        salesByPaymentMethod: [
          { name: 'UPI', total_amount: 125000, order_count: 45 },
          { name: 'COD', total_amount: 85000, order_count: 32 }
        ]
      }
    };
  }

  async getLowStockReport() {
    const report = await this.prisma.productVariant.findMany({
      where: { qty: { lt: 10 } },
      include: {
        product: {
          select: { name: true, sku: true }
        }
      },
      orderBy: { qty: 'asc' }
    });
    return { success: true, data: report };
  }

  // System Settings
  async getSettings() {
    const settings = await this.prisma.setting.findMany({ orderBy: { sortOrder: 'asc' } });
    return { success: true, data: settings };
  }

  async updateSettings(data: any) {
    const updates = Object.entries(data).map(([key, value]) => {
      return this.prisma.setting.updateMany({
        where: { key },
        data: { value: String(value) },
      });
    });
    await Promise.all(updates);
    return { success: true };
  }

  // Taxes logic
  async getTaxes() {
    const taxes = await this.prisma.taxRate.findMany({
      where: { deletedAt: null },
      include: { taxClass: true },
    });
    
    const mapped = taxes.map(tax => ({
      ...tax,
      isActive: tax.isActive === 1 || (tax.isActive as any) === true,
    }));

    return { success: true, data: mapped };
  }

  async createTaxRate(data: any) {
    let taxClassId = data.taxClassId;
    if (!taxClassId) {
      const defaultClass = await this.prisma.taxClass.findFirst({ where: { isDefault: 1 } });
      taxClassId = defaultClass?.id;
    }

    const taxRate = await this.prisma.taxRate.create({
      data: {
        name: data.name,
        rate: data.rate,
        isActive: data.isActive ? 1 : 0,
        taxClassId: taxClassId || 1, 
        countryCode: data.countryCode || 'IN',
      },
      include: { taxClass: true }
    });
    return { success: true, data: { ...taxRate, isActive: taxRate.isActive === 1 } };
  }

  async updateTaxRate(id: number, data: any) {
    const updated = await this.prisma.taxRate.update({
      where: { id },
      data: {
        name: data.name,
        rate: data.rate,
        isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : undefined,
      },
      include: { taxClass: true }
    });
    return { success: true, data: { ...updated, isActive: updated.isActive === 1 } };
  }

  async deleteTaxRate(id: number) {
    await this.prisma.taxRate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  // Shipping Methods
  async getShippingMethods() {
    const methods = await this.prisma.shippingMethod.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return { success: true, data: methods };
  }

  async createShippingMethod(data: any) {
    const method = await this.prisma.shippingMethod.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder || 0,
      },
    });
    return { success: true, data: method };
  }

  async updateShippingMethod(id: number | bigint, data: any) {
    const sId = BigInt(id);
    const method = await this.prisma.shippingMethod.update({
      where: { id: sId },
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
    return { success: true, data: method };
  }

  async deleteShippingMethod(id: number | bigint) {
    const sId = BigInt(id);
    await this.prisma.shippingMethod.update({
      where: { id: sId },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }
}
