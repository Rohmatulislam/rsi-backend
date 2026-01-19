import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // If no user or no role, check authorization header for JWT
        if (!user) {
            const authHeader = request.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.substring(7);
                    const jwt = require('jsonwebtoken');
                    const payload = jwt.verify(
                        token,
                        process.env.JWT_SECRET || 'rsi-hospital-secret-key-2024'
                    );

                    if (payload.role === 'admin') {
                        request.user = payload;
                        return true;
                    }
                } catch (error) {
                    throw new UnauthorizedException('Token tidak valid');
                }
            }
            throw new UnauthorizedException('Akses ditolak - Login diperlukan');
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            throw new UnauthorizedException('Akses ditolak - Hanya admin yang diizinkan');
        }

        return true;
    }
}
