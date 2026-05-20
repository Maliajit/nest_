import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  @Post()
  async createOrder(@Body('customerId') customerId: string, @Body() createOrderDto: any) {
    return this.orderService.checkout(customerId, createOrderDto);
  }

  @Get()
  async getAllOrders(@Query('customerId') customerId?: string) {
    if (customerId) {
      return this.orderService.getOrders(customerId);
    }
    return this.orderService.getAllOrders();
  }

  // Static routes MUST come before :id param routes
  @Post('calculate-shipping')
  async calculateShipping(@Body('customerId') customerId: string, @Body('pincode') pincode: string) {
    return this.orderService.calculateShipping(customerId, pincode);
  }

  @Post('calculate-total')
  async calculateTotal(
    @Body('customerId') customerId: string, 
    @Body('pincode') pincode?: string,
    @Body('couponCode') couponCode?: string
  ) {
    return this.orderService.calculateOrderTotal(customerId, pincode, couponCode);
  }

  @Get(':id')
  async getOrderById(@Query('customerId') customerId: string, @Param('id') id: string) {
    return this.orderService.getOrderById(customerId, id);
  }

  // Update order status (used by admin)
  @Put(':id/status')
  async updateOrderStatus(@Param('id') id: string, @Body('status') status: string, @Body('notes') notes?: string) {
    return this.orderService.updateStatus(id, status, notes);
  }

  // Update payment status (used by admin)
  @Put(':id/payment-status')
  async updatePaymentStatus(@Param('id') id: string, @Body('payment_status') paymentStatus: string, @Body('notes') notes?: string) {
    return this.orderService.updatePaymentStatus(id, paymentStatus, notes);
  }

  // Legacy: also allow PUT :id for backwards compatibility
  @Put(':id')
  async updateOrder(@Param('id') id: string, @Body('status') status: string) {
    return this.orderService.updateStatus(id, status);
  }

  @Post(':id/cancel')
  async cancelOrder(@Body('customerId') customerId: string, @Param('id') id: string, @Body('reason') reason: string) {
    return this.orderService.cancelOrder(customerId, id, reason);
  }
}


