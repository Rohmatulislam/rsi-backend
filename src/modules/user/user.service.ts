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
            console.log(`[UserService] NIK: ${profile.nik} -> noRM: ${noRM}`);
        } else {
            console.log(`[UserService] No NIK found for user ${userId}`);
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
        if (dto.phone || dto.nik) {
            await this.prisma.userProfile.upsert({
                where: { userId },
                update: {
                    phone: dto.phone,
                    nik: dto.nik
                },
                create: {
                    userId,
                    phone: dto.phone,
                    nik: dto.nik
                },
            });
        }

        // Return full profile to update frontend state correctly
        return this.getProfile(userId);
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
        const members = await this.prisma.familyMember.findMany({
            where: { userId },
            orderBy: { createdAt: 'asc' },
        });

        // Enrich with No RM from Khanza
        const membersWithNoRM = await Promise.all(members.map(async (member) => {
            let noRM = null;
            if (member.nik) {
                noRM = await this.patientService.findNoRMByNIK(member.nik);
            }
            return {
                ...member,
                noRM
            };
        }));

        return membersWithNoRM;
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

    // Health History
    async getHealthHistory(userId: string, targetNoRM?: string) {
        let noRM = targetNoRM;

        // If no specific RM provided, try to get from user profile
        if (!noRM) {
            const profile = await this.prisma.userProfile.findUnique({
                where: { userId },
            });

            if (profile?.nik) {
                noRM = await this.patientService.findNoRMByNIK(profile.nik);
            }
        }

        if (!noRM) {
            return [];
        }

        // Fetch history from Khanza
        return this.patientService.getPatientHistory(noRM);
    }

    async getLinkedPatients(userId: string) {
        // 1. Get Family Members (Prioritized)
        const familyMembers = await this.getFamilyMembers(userId);

        // 2. Get Patients from Appointments
        const appointments = await this.prisma.appointment.findMany({
            where: { createdByUserId: userId },
            select: {
                patientId: true,
                patientName: true,
                appointmentDate: true
            },
            orderBy: { appointmentDate: 'desc' },
            distinct: ['patientId']
        });

        // 3. Get Patients from Diagnostic Orders
        const diagnosticOrders = await this.prisma.diagnosticOrder.findMany({
            where: { userId: userId },
            select: {
                patientId: true,
                patientName: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            distinct: ['patientId']
        });

        // 4. Merge and Deduplicate
        const patientMap = new Map<string, { noRM: string, name: string, type: string, lastDate: Date }>();

        // Process Appointments
        appointments.forEach(app => {
            if (app.patientId) {
                patientMap.set(app.patientId, {
                    noRM: app.patientId,
                    name: app.patientName || 'Pasien',
                    type: 'Riwayat Booking',
                    lastDate: app.appointmentDate
                });
            }
        });

        // Process Diagnostic Orders (Override if newer?) - actually let's just add if missing
        diagnosticOrders.forEach(order => {
            if (order.patientId) {
                const existing = patientMap.get(order.patientId);
                if (!existing || order.createdAt > existing.lastDate) {
                    patientMap.set(order.patientId, {
                        noRM: order.patientId,
                        name: order.patientName,
                        type: 'Riwayat Diagnostik',
                        lastDate: order.createdAt
                    });
                }
            }
        });

        // Process Family Members (Override everything as "Keluarga")
        familyMembers.forEach(member => {
            if (member.noRM) {
                patientMap.set(member.noRM, {
                    noRM: member.noRM,
                    name: member.name,
                    type: `Keluarga (${member.relationship})`,
                    lastDate: new Date() // Always top priority
                });
            }
        });

        // Convert to array and sort
        // Include 'Self' if we can find the user's own RM
        const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
        let selfRM = null;
        if (profile?.nik) {
            selfRM = await this.patientService.findNoRMByNIK(profile.nik);
            if (selfRM) {
                const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
                patientMap.set(selfRM, {
                    noRM: selfRM,
                    name: `${user?.name} (Saya)`,
                    type: 'Diri Sendiri',
                    lastDate: new Date(8640000000000000) // Max date to keep at top
                });
            }
        }

        return Array.from(patientMap.values()).sort((a, b) => {
            // Self always first
            if (a.type === 'Diri Sendiri') return -1;
            if (b.type === 'Diri Sendiri') return 1;
            // Then by date desc
            return b.lastDate.getTime() - a.lastDate.getTime();
        });
    }
}
