import { Controller, Get, Patch, Post, Delete, Body, Param, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto, ChangePasswordDto, CreateFamilyMemberDto } from './dto/user.dto';

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get('me')
    async getProfile(@Req() req: any) {
        const userId = req.user?.id;
        if (!userId) {
            return { error: 'Unauthorized' };
        }
        return this.userService.getProfile(userId);
    }

    @Patch('me')
    async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
        const userId = req.user?.id;
        if (!userId) {
            return { error: 'Unauthorized' };
        }
        return this.userService.updateProfile(userId, dto);
    }

    @Post('me/change-password')
    async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
        const userId = req.user?.id;
        if (!userId) {
            return { error: 'Unauthorized' };
        }
        return this.userService.changePassword(userId, dto);
    }

    // Family Members
    @Get('me/family')
    async getFamilyMembers(@Req() req: any) {
        const userId = req.user?.id;
        if (!userId) {
            return { error: 'Unauthorized' };
        }
        return this.userService.getFamilyMembers(userId);
    }

    @Post('me/family')
    async addFamilyMember(@Req() req: any, @Body() dto: CreateFamilyMemberDto) {
        const userId = req.user?.id;
        if (!userId) {
            return { error: 'Unauthorized' };
        }
        return this.userService.addFamilyMember(userId, dto);
    }

    @Delete('me/family/:id')
    async removeFamilyMember(@Req() req: any, @Param('id') id: string) {
        const userId = req.user?.id;
        if (!userId) {
            return { error: 'Unauthorized' };
        }
        return this.userService.removeFamilyMember(userId, id);
    }

    // Health History
    @Get('me/health-history')
    async getHealthHistory(@Req() req: any) {
        const userId = req.user?.id;
        if (!userId) {
            return { error: 'Unauthorized' };
        }
        return this.userService.getHealthHistory(userId);
    }
}
