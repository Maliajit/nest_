import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

type AuthRole = 'customer' | 'admin';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  private sanitizeUser<T extends Record<string, any>>(user: T, role: AuthRole) {
    const { password, ...result } = user;
    const userData: Record<string, any> = { ...result, role };

    Object.keys(userData).forEach((key) => {
      if (typeof userData[key] === 'bigint') {
        userData[key] = userData[key].toString();
      }
    });

    return userData;
  }

  // Shared validator for strategies that can authenticate either role.
  async validateUser(email: string, pass: string): Promise<any> {
    let user: any = await this.prisma.customer.findUnique({ where: { email } });
    let role: AuthRole = 'customer';

    if (!user) {
      user = await this.prisma.admin.findUnique({ where: { email } });
      role = 'admin';
    }

    if (user && await bcrypt.compare(pass, user.password)) {
      return this.sanitizeUser(user, role);
    }

    return null;
  }

  // Customer login must never authenticate admins through the customer portal.
  async validateCustomer(email: string, pass: string) {
    const customer = await this.prisma.customer.findUnique({ where: { email } });

    if (customer && await bcrypt.compare(pass, customer.password)) {
      return this.sanitizeUser(customer, 'customer');
    }

    return null;
  }

  async validateCustomerByOtp(mobile: string, otp: string) {
    if (otp !== '1234') {
      return null;
    }

    const customer = await this.prisma.customer.findUnique({ where: { mobile } });

    if (customer) {
      return this.sanitizeUser(customer, 'customer');
    }

    return null;
  }

  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user.id.toString(),
      role: user.role as AuthRole,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }

  async getAuthenticatedUser(userId: string, role: AuthRole) {
    if (role === 'admin') {
      const admin = await this.prisma.admin.findUnique({
        where: { id: BigInt(userId) },
      });

      if (!admin) {
        throw new UnauthorizedException('Session is no longer valid');
      }

      return this.sanitizeUser(admin, 'admin');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: BigInt(userId) },
    });

    if (!customer) {
      throw new UnauthorizedException('Session is no longer valid');
    }

    return this.sanitizeUser(customer, 'customer');
  }

  async registerCustomer(registerDto: RegisterDto) {
    const { email, password, name, mobile, otp } = registerDto;

    if (otp !== '1234') {
      throw new BadRequestException('Invalid OTP');
    }

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

    try {
      const effectivePassword = password || `OTP_${Math.random().toString(36).slice(-8)}`;
      const hashedPassword = await bcrypt.hash(effectivePassword, 10);
      const customer = await this.prisma.customer.create({
        data: {
          email,
          name,
          mobile,
          password: hashedPassword,
          status: 1,
        },
      });

      return this.sanitizeUser(customer, 'customer');
    } catch (error) {
      throw new BadRequestException('Failed to register customer: ' + error.message);
    }
  }

  async resetCustomerPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, password } = resetPasswordDto;

    const customer = await this.prisma.customer.findUnique({
      where: { email },
    });

    if (!customer) {
      throw new BadRequestException('No customer account found with this email');
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      await this.prisma.customer.update({
        where: { email },
        data: { password: hashedPassword },
      });

      return {
        message: 'Password updated successfully',
        email,
      };
    } catch (error) {
      throw new BadRequestException('Failed to update password: ' + error.message);
    }
  }

  async validateAdmin(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const admin = await this.prisma.admin.findUnique({ where: { email } });

    if (admin && await bcrypt.compare(password, admin.password)) {
      return this.login(this.sanitizeUser(admin, 'admin'));
    }

    throw new UnauthorizedException('Invalid admin credentials');
  }
}
