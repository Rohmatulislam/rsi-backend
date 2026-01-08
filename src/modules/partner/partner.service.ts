import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';

@Injectable()
export class PartnerService {
    constructor(private prisma: PrismaService) { }

    async create(createPartnerDto: CreatePartnerDto) {
        return this.prisma.partner.create({
            data: createPartnerDto,
        });
    }

    async findAll() {
        return this.prisma.partner.findMany({
            orderBy: { order: 'asc' },
        });
    }

    async findActive() {
        return this.prisma.partner.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findOne(id: string) {
        const partner = await this.prisma.partner.findUnique({
            where: { id },
        });

        if (!partner) {
            throw new NotFoundException(`Partner with ID ${id} not found`);
        }

        return partner;
    }

    async update(id: string, updatePartnerDto: UpdatePartnerDto) {
        await this.findOne(id); // Check if exists

        return this.prisma.partner.update({
            where: { id },
            data: updatePartnerDto,
        });
    }

    async remove(id: string) {
        await this.findOne(id); // Check if exists

        return this.prisma.partner.delete({
            where: { id },
        });
    }

    async reorder(orders: { id: string; order: number }[]) {
        await Promise.all(
            orders.map((item) =>
                this.prisma.partner.update({
                    where: { id: item.id },
                    data: { order: item.order },
                }),
            ),
        );
    }
}
