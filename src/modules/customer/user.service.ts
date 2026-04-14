import { Injectable } from '@nestjs/common';
import { CustomerService } from './customer.service';

@Injectable()
export class UserService {
  constructor(private readonly customerService: CustomerService) {}

  async findAll() {
    return this.customerService.getAllUsers();
  }

  async create(createUserDto: any) {
    // Basic implementation to satisfy the controller
    return { success: true, message: 'User creation not fully implemented', data: createUserDto };
  }
}
