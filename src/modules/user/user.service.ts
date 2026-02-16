import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { PatientService } from 'src/infra/database/khanza/patient/patient.service';
import { UpdateProfileDto, ChangePasswordDto, CreateFamilyMemberDto } from './dto/user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
    constructor(
        private prisma: PrismaService,
        private patientService: PatientService
    ) { }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                emailVerified: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Get additional profile data if exists
        const profile = await this.prisma.userProfile.findUnique({
            where: { userId },
        });

        // Find No RM in Khanza if NIK is available
        let noRM = null;
        if (profile?.nik) {
            noRM = await this.patientService.findNoRMByNIK(profile.nik);
        }

        return { ...user, profile, noRM };
    }

    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Update user table
        const updatedUser = await this.prisma.user.update({
            where: { id: userId },
            data: {
                name: dto.name,
                image: dto.image,
            },
        });

        // Update or create profile
        if (dto.phone) {
            await this.prisma.userProfile.upsert({
                where: { userId },
                update: { phone: dto.phone },
                create: { userId, phone: dto.phone },
            });
        }

        return updatedUser;
    }

    async changePassword(userId: string, dto: ChangePasswordDto) {
        const account = await this.prisma.account.findFirst({
            where: { userId, providerId: 'credential' },
        });

        if (!account || !account.password) {
            throw new BadRequestException('Account not found or no password set');
        }

        // Verify current password
        const isValid = await bcrypt.compare(dto.currentPassword, account.password);
        if (!isValid) {
            throw new BadRequestException('Password lama tidak sesuai');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

        // Update password
        await this.prisma.account.update({
            where: { id: account.id },
            data: { password: hashedPassword },
        });

        return { message: 'Password berhasil diubah' };
    }

    // Family Members
    async getFamilyMembers(userId: string) {
        return this.prisma.familyMember.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });
    }

    async addFamilyMember(userId: string, dto: CreateFamilyMemberDto) {
        return this.prisma.familyMember.create({
            data: {
                userId,
                name: dto.name,
                relationship: dto.relationship,
                nik: dto.nik,
                birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
                gender: dto.gender,
                phone: dto.phone,
            },
        });
    }

    async removeFamilyMember(userId: string, memberId: string) {
        const member = await this.prisma.familyMember.findFirst({
            where: { id: memberId, userId },
        });

        if (!member) {
            throw new NotFoundException('Family member not found');
        }

        await this.prisma.familyMember.delete({ where: { id: memberId } });
        return { message: 'Anggota keluarga berhasil dihapus' };
    }

    // Health History (placeholder - will need Khanza integration)
    async getHealthHistory(userId: string) {
        // For now, return empty array
        // In future, this will fetch from Khanza via patient MR number
        return [];
    }
}
