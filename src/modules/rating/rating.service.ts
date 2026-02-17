import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/infra/database/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { UpdateRatingStatusDto } from './dto/update-rating-status.dto';
import { GetRatingsDto } from './dto/get-ratings.dto';

@Injectable()
export class RatingService {
    constructor(private prisma: PrismaService) { }

    async create(userId: string, createRatingDto: CreateRatingDto) {
        const { doctorId, rating, comment } = createRatingDto;

        // Check if doctor exists
        const doctor = await this.prisma.doctor.findUnique({
            where: { id: doctorId },
        });

        if (!doctor) {
            throw new NotFoundException('Dokter tidak ditemukan');
        }

        // Check for completed appointments for this doctor by this user
        const appointment = await this.prisma.appointment.findFirst({
            where: {
                createdByUserId: userId,
                doctorId: doctorId,
                status: 'completed',
            },
        });

        if (!appointment) {
            throw new BadRequestException('Anda hanya dapat memberikan rating setelah kunjungan selesai');
        }

        return (this.prisma as any).doctorRating.create({
            data: {
                doctorId,
                userId,
                rating,
                comment,
                status: 'PENDING',
            },
        });
    }

    async findAll(query: GetRatingsDto) {
        const { doctorId, status } = query;

        return (this.prisma as any).doctorRating.findMany({
            where: {
                ...(doctorId && { doctorId }),
                ...(status && { status }),
            },
            include: {
                user: {
                    select: {
                        name: true,
                        image: true,
                    },
                },
                doctor: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async updateStatus(id: string, updateDto: UpdateRatingStatusDto) {
        const rating = await (this.prisma as any).doctorRating.findUnique({
            where: { id },
        });

        if (!rating) {
            throw new NotFoundException('Rating tidak ditemukan');
        }

        return (this.prisma as any).doctorRating.update({
            where: { id },
            data: { status: updateDto.status },
        });
    }

    async remove(id: string) {
        const rating = await (this.prisma as any).doctorRating.findUnique({
            where: { id },
        });

        if (!rating) {
            throw new NotFoundException('Rating tidak ditemukan');
        }

        return (this.prisma as any).doctorRating.delete({
            where: { id },
        });
    }

    async getAverageRating(doctorId: string) {
        const aggregate = await (this.prisma as any).doctorRating.aggregate({
            where: {
                doctorId,
                status: 'APPROVED',
            },
            _avg: {
                rating: true,
            },
            _count: {
                rating: true,
            },
        });

        return {
            averageRating: aggregate._avg.rating || 0,
            totalReviews: aggregate._count.rating || 0,
        };
    }
}
