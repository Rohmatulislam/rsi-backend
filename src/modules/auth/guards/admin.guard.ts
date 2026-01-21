import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
    private readonly logger = new Logger(AdminGuard.name);

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const authHeader = request.headers.authorization;

        this.logger.log(`AdminGuard Check: User=${JSON.stringify(user)}, AuthHeader=${authHeader ? 'Present' : 'Missing'}`);

        // If no user or no role, check authorization header for JWT
        if (!user) {
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.substring(7);
                    const jwt = require('jsonwebtoken');
                    const payload = jwt.verify(
                        token,
                        process.env.JWT_SECRET || 'rsi-hospital-secret-key-2024'
                    );

                    this.logger.log(`AdminGuard: Token Payload=${JSON.stringify(payload)}`);

                    if (payload.role === 'admin') {
                        request.user = payload;
                        return true;
                    } else {
                        this.logger.warn(`AdminGuard: Role mismatch. Expected 'admin', got '${payload.role}'`);
                    }
                } catch (error) {
                    this.logger.error(`AdminGuard: Token verification failed: ${error.message}`);
                    throw new UnauthorizedException('Token tidak valid');
                }
            } else {
                this.logger.warn('AdminGuard: No valid Auth header found');
            }
            throw new UnauthorizedException('Akses ditolak - Login diperlukan');
        }

        // Check if user is admin
        if (user.role !== 'admin') {
            this.logger.warn(`AdminGuard: User role mismatch. Expected 'admin', got '${user.role}'`);
            throw new UnauthorizedException('Akses ditolak - Hanya admin yang diizinkan');
        }

        return true;
    }
}
