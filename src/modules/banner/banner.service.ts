import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { Banner } from './entities/banner.entity';

@Injectable()
export class BannerService {
    constructor(private prisma: PrismaService) { }

    async create(createBannerDto: CreateBannerDto): Promise<Banner> {
        return this.prisma.banner.create({
            data: createBannerDto,
        });
    }

    async findAll(): Promise<Banner[]> {
        return this.prisma.banner.findMany({
            orderBy: { order: 'asc' },
        });
    }

    async findActive(): Promise<Banner[]> {
        return this.prisma.banner.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findOne(id: string): Promise<Banner> {
        const banner = await this.prisma.banner.findUnique({
            where: { id },
        });

        if (!banner) {
            throw new NotFoundException(`Banner with ID ${id} not found`);
        }

        return banner;
    }

    async update(id: string, updateBannerDto: UpdateBannerDto): Promise<Banner> {
        await this.findOne(id); // Check if exists

        return this.prisma.banner.update({
            where: { id },
            data: updateBannerDto,
        });
    }

    async remove(id: string): Promise<Banner> {
        await this.findOne(id); // Check if exists

        return this.prisma.banner.delete({
            where: { id },
        });
    }

    async reorder(orders: { id: string; order: number }[]): Promise<void> {
        // Update order for multiple banners
        await Promise.all(
            orders.map((item) =>
                this.prisma.banner.update({
                    where: { id: item.id },
                    data: { order: item.order },
                }),
            ),
        );
    }
}
