import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService, RegisterDto, LoginDto } from './auth.service';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('register')
    @AllowAnonymous()
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('login')
    @AllowAnonymous()
    @UseGuards(AuthGuard('local'))
    @HttpCode(HttpStatus.OK)
    async login(@Request() req) {
        return this.authService.login(req.user);
    }

    @Get('get-session')
    @AllowAnonymous()
    async getSession(@Request() req) {
        // Try to extract user from token if present
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.substring(7);
                const jwt = require('jsonwebtoken');
                const payload = jwt.verify(
                    token,
                    process.env.JWT_SECRET || 'rsi-hospital-secret-key-2024'
                );
                return this.authService.getSession(payload.sub);
            } catch (error) {
                // Token invalid or expired
                return { session: null, user: null };
            }
        }
        return { session: null, user: null };
    }

    @Post('logout')
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    async logout() {
        // JWT is stateless, client should delete the token
        return { message: 'Logout berhasil' };
    }

    @Post('refresh')
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    async refresh(@Body('refreshToken') refreshToken: string) {
        return this.authService.refreshToken(refreshToken);
    }

    @Post('forgot-password')
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body('email') email: string) {
        return this.authService.forgotPassword(email);
    }

    @Post('reset-password')
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    async resetPassword(
        @Body('token') token: string,
        @Body('password') password: string,
    ) {
        return this.authService.resetPassword(token, password);
    }
}
