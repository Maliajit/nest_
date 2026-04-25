import { Controller, Get, Param, Put, Post, Delete, Body } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

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

  // Addresses Endpoints
  @Get(':id/addresses')
  async getAddresses(@Param('id') customerId: string) {
    return this.customerService.getAddresses(customerId);
  }

  @Post(':id/addresses')
  async addAddress(
    @Param('id') customerId: string,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.customerService.addAddress(customerId, createAddressDto);
  }

  @Put(':id/addresses/:addressId')
  async updateAddress(
    @Param('id') customerId: string,
    @Param('addressId') addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.customerService.updateAddress(customerId, addressId, updateAddressDto);
  }

  @Delete(':id/addresses/:addressId')
  async deleteAddress(
    @Param('id') customerId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.customerService.deleteAddress(customerId, addressId);
  }
}
