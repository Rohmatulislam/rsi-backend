import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

// Temporarily disabled: Auth is disabled for Vercel ESM compatibility
// This guard now allows all access. Re-enable auth later.
@Injectable()
export class AdminGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Auth disabled - allow all access temporarily
        // TODO: Re-implement auth guard when better-auth is replaced
        return true;
    }
}

