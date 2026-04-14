import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { SystemService } from '../system/system.service';

@Controller('taxes')
export class TaxesController {
  constructor(private readonly systemService: SystemService) {}

  @Get()
  async getTaxes() {
    return this.systemService.getTaxes();
  }

  @Post()
  async createTaxRate(@Body() data: any) {
    return this.systemService.createTaxRate(data);
  }

  @Put(':id')
  async updateTaxRate(@Param('id') id: string, @Body() data: any) {
    return this.systemService.updateTaxRate(Number(id), data);
  }

  @Delete(':id')
  async deleteTaxRate(@Param('id') id: string) {
    return this.systemService.deleteTaxRate(Number(id));
  }
}
