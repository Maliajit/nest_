import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentOrderDto } from './dto/payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-order')
  async createOrder(@Body() dto: CreatePaymentOrderDto) {
    return this.paymentService.createOrder(dto.amount, 'INR', dto.receipt);
  }

  @Post('verify')
  async verifyPayment(
    @Body() body: { orderId: string; paymentId: string; signature: string },
  ) {
    const isValid = this.paymentService.verifySignature(
      body.orderId,
      body.paymentId,
      body.signature,
    );
    if (!isValid) {
      throw new BadRequestException('Invalid signature');
    }
    return { success: true };
  }
}
