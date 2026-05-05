import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException, Get, Req, UseGuards, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Register request received for email=${registerDto.email}`);
    const result = await this.authService.registerCustomer(registerDto);
    this.logger.log(`Register success for email=${registerDto.email}`);
    return result;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    this.logger.log(`Customer login attempt for email=${loginDto.email}`);
    const user = await this.authService.validateCustomer(loginDto.email, loginDto.password);

    if (!user) {
      this.logger.warn(`Customer login failed for email=${loginDto.email}`);
      throw new UnauthorizedException('Invalid customer credentials');
    }

    const result = await this.authService.login(user);
    this.logger.log(`Customer login success for email=${loginDto.email}`);
    return result;
  }

  @Post('reset-password')
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    this.logger.log(`Password reset request received for email=${resetPasswordDto.email}`);
    const result = await this.authService.resetCustomerPassword(resetPasswordDto);
    this.logger.log(`Password reset success for email=${resetPasswordDto.email}`);
    return result;
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() loginDto: LoginDto) {
    this.logger.log(`Admin login attempt for email=${loginDto.email}`);
    const result = await this.authService.validateAdmin(loginDto);
    this.logger.log(`Admin login success for email=${loginDto.email}`);
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    this.logger.log(`Auth verification request for userId=${req.user.userId}, role=${req.user.role}`);
    const user = await this.authService.getAuthenticatedUser(req.user.userId, req.user.role);
    return { user };
  }
}
