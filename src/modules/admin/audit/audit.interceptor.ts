import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
    constructor(private auditService: AuditService) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, user, ip, body } = request;

        // Only log non-GET requests to admin routes
        if (method !== 'GET' && url.includes('/admin')) {
            return next.handle().pipe(
                tap(() => {
                    // Log after successful execution
                    if (user) {
                        this.auditService.log({
                            userId: user.id || 'system',
                            userEmail: user.email || 'system',
                            action: method,
                            resource: url,
                            details: JSON.stringify(body),
                            ipAddress: ip,
                        }).catch(err => console.error('Failed to log audit:', err));
                    }
                }),
            );
        }

        return next.handle();
    }
}
