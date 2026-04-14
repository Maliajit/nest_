import { Controller, Get, Param, Put, Body } from '@nestjs/common';
import { CustomerService } from './customer.service';

@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  async findAll() {
    return this.customerService.getAllUsers();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.customerService.getProfile(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateCustomerDto: any) {
    return this.customerService.updateCustomer(id, updateCustomerDto);
  }
}
