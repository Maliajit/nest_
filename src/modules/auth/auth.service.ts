import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // Validate user for local strategy (works for both Admin and Customer)
  async validateUser(email: string, pass: string): Promise<any> {
    // Check in Customers table first
    let user: any = await this.prisma.customer.findUnique({ where: { email } });
    let role = 'customer';

    if (!user) {
      // Check in Admins table
      user = await this.prisma.admin.findUnique({ where: { email } });
      role = 'admin';
    }

    if (user && await bcrypt.compare(pass, user.password)) {
      // Return user without password
      const { password, ...result } = user;
      return { ...result, role };
    }
    return null;
  }

  // Login and generate JWT
  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.id.toString(), // Convert BigInt to string for JWT payload
      role: user.role 
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  // Register a new customer
  async registerCustomer(registerDto: RegisterDto) {
    const { email, password, name, mobile } = registerDto;

    // RULE 4: Validate before DB - Check for duplicates
    const existingCustomer = await this.prisma.customer.findUnique({
      where: { email },
    });
    if (existingCustomer) {
      throw new BadRequestException('Customer with this email already exists');
    }

    if (mobile) {
      const existingMobile = await this.prisma.customer.findUnique({
        where: { mobile },
      });
      if (existingMobile) {
        throw new BadRequestException('Customer with this mobile already exists');
      }
    }

    // RULE 5: Safe DB calls
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const customer = await this.prisma.customer.create({
        data: {
          email,
          name,
          mobile,
          password: hashedPassword,
          status: 1, // Active
        },
      });

      const { password: _, ...result } = customer;
      return result;
    } catch (error) {
      // RULE 3: Proper error handling
      throw new BadRequestException('Failed to register customer: ' + error.message);
    }
  }

  // Admin login logic (if separate from customer login)
  async validateAdmin(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const admin = await this.prisma.admin.findUnique({ where: { email } });

    if (admin && await bcrypt.compare(password, admin.password)) {
      const { password: _, ...result } = admin;
      return this.login({ ...result, role: 'admin' });
    }
    throw new UnauthorizedException('Invalid admin credentials');
  }
}
