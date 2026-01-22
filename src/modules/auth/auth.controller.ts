import {
    Controller,
    Post,
    Get,
    Query,
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

    // Better-auth compatible endpoint for sign-up
    @Post('sign-up/email')
    @AllowAnonymous()
    async signUpEmail(@Body() body: { email: string; password: string; name: string }) {
        const result = await this.authService.register({
            email: body.email,
            password: body.password,
            name: body.name,
        });
        // Return in better-auth format, token is omitted to force verification flow
        return {
            user: result.user,
        };
    }

    @Post('login')
    @AllowAnonymous()
    @UseGuards(AuthGuard('local'))
    @HttpCode(HttpStatus.OK)
    async login(@Request() req) {
        return this.authService.login(req.user);
    }

    // Better-auth compatible endpoint for sign-in
    @Post('sign-in/email')
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    async signInEmail(@Body() body: { email: string; password: string }) {
        const user = await this.authService.validateUser(body.email, body.password);
        if (!user) {
            throw new HttpException(
                {
                    code: 'INVALID_PASSWORD',
                    message: 'Email atau password salah',
                },
                HttpStatus.UNAUTHORIZED,
            );
        }

        // Check verification
        if (!user.emailVerified) {
            throw new HttpException(
                {
                    code: 'EMAIL_NOT_VERIFIED',
                    message: 'Email belum diverifikasi. Silakan cek kotak masuk email Anda.',
                },
                HttpStatus.UNAUTHORIZED,
            );
        }

        const result = await this.authService.login(user);
        // Return in better-auth format
        return {
            user: result.user,
            token: result.accessToken,
        };
    }

    @Get('get-session')
    @AllowAnonymous()
    async getSession(@Request() req) {
        return this.handleGetSession(req);
    }

    @Post('get-session')
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    async getSessionPost(@Request() req) {
        return this.handleGetSession(req);
    }

    private handleGetSession(req: any) {
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

    @Get('verify-email')
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    async verifyEmailGet(@Query('token') token: string) {
        return this.authService.verifyEmail(token);
    }

    @Post('verify-email')
    @AllowAnonymous()
    @HttpCode(HttpStatus.OK)
    async verifyEmail(@Body('token') token: string, @Query('token') queryToken: string) {
        return this.authService.verifyEmail(token || queryToken);
    }
}
