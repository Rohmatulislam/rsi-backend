import { Controller, Get, Post, All, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';

// Placeholder auth controller while better-auth is disabled
// Returns minimal responses to prevent 404 errors from frontend
@Controller('auth')
export class AuthController {
    @Get('get-session')
    @AllowAnonymous()
    getSession() {
        // Return null session - user is not authenticated
        return { session: null, user: null };
    }

    @Post('sign-out')
    @AllowAnonymous()
    signOut() {
        return { success: true };
    }

    // Catch-all for other auth routes
    @All('*')
    @AllowAnonymous()
    catchAll(@Req() req: Request, @Res() res: Response) {
        // Return 501 Not Implemented for other auth routes
        res.status(501).json({
            error: 'Auth temporarily disabled',
            message: 'Authentication is temporarily unavailable. Please try again later.',
        });
    }
}
