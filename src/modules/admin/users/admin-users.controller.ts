import { Controller, Get, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { AdminGuard } from '../../auth/guards/admin.guard';

@Controller('admin/users')
@UseGuards(AdminGuard)
export class AdminUsersController {
    constructor(private readonly adminUsersService: AdminUsersService) { }

    @Get()
    findAll() {
        return this.adminUsersService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.adminUsersService.findOne(id);
    }

    @Patch(':id/role')
    updateRole(@Param('id') id: string, @Body('role') role: string) {
        return this.adminUsersService.updateRole(id, role);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.adminUsersService.remove(id);
    }
}
