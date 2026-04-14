import { Controller, Post, Body, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    // RULE 2: Controller handles response only
    return this.authService.registerCustomer(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    // RULE 2: Controller handles response only
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      // RULE 3: Proper error handling - No raw DB errors
      throw new UnauthorizedException('Invalid customer credentials');
    }
    return this.authService.login(user);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() loginDto: LoginDto) {
    // RULE 2: Controller handles response only
    return this.authService.validateAdmin(loginDto);
  }
}
