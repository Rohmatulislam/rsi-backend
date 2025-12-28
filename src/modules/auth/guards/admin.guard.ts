import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { auth } from '../../../infra/auth/auth';

@Injectable()
export class AdminGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();

        // better-auth attaches the session to the request if authenticated
        // We check for the session and the user's role
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session) {
            return false; // AuthGuard should handle 401, but we return false to be safe
        }

        if (session.user.role !== 'admin' && session.user.role !== 'ADMIN') {
            throw new ForbiddenException('Akses ditolak: Anda bukan Admin');
        }

        return true;
    }
}
