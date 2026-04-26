import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

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

  @Get(':id')
  async getOrderById(@Body('customerId') customerId: string, @Param('id') id: string) {
    return this.orderService.getOrderById(customerId, id);
  }

  @Put(':id')
  async updateOrderStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.orderService.updateStatus(id, status);
  }

  @Post(':id/cancel')
  async cancelOrder(@Body('customerId') customerId: string, @Param('id') id: string, @Body('reason') reason: string) {
    return this.orderService.cancelOrder(customerId, id, reason);
  }

  @Post('calculate-shipping')
  async calculateShipping(@Body('customerId') customerId: string, @Body('pincode') pincode: string) {
    return this.orderService.calculateShipping(customerId, pincode);
  }
}
