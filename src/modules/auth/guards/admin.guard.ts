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

                    // Case-insensitive role check
                    const userRole = payload.role ? payload.role.toLowerCase() : '';
                    if (userRole === 'admin') {
                        request.user = payload;
                        return true;
                    } else {
                        this.logger.warn(`AdminGuard: Role mismatch. Expected 'admin', got '${payload.role}'`);
                        // Use ForbiddenException (403) for authorized but not allowed users
                        const { ForbiddenException } = require('@nestjs/common');
                        throw new ForbiddenException('Akses ditolak - Hanya admin yang diizinkan');
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

        // Check if user is admin (from request.user if already populated)
        const userRole = user.role ? user.role.toLowerCase() : '';
        if (userRole !== 'admin') {
            this.logger.warn(`AdminGuard: User role mismatch. Expected 'admin', got '${user.role}'`);
            const { ForbiddenException } = require('@nestjs/common');
            throw new ForbiddenException('Akses ditolak - Hanya admin yang diizinkan');
        }

        return true;
    }
}
