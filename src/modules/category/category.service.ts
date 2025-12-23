import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoryService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createCategoryDto: CreateCategoryDto) {
        return this.prisma.category.create({
            data: {
                name: createCategoryDto.name,
                slug: createCategoryDto.slug,
                type: createCategoryDto.type,
                description: createCategoryDto.description,
                icon: createCategoryDto.icon,
                color: createCategoryDto.color,
                order: createCategoryDto.order ?? 0,
                isActive: createCategoryDto.isActive ?? true,
            },
        });
    }

    async findAll(type?: string) {
        return this.prisma.category.findMany({
            where: type ? { type: type as any } : undefined,
            orderBy: [{ type: 'asc' }, { order: 'asc' }, { name: 'asc' }],
        });
    }

    async findOne(id: string) {
        const category = await this.prisma.category.findUnique({
            where: { id },
        });

        if (!category) {
            throw new NotFoundException(`Category with ID ${id} not found`);
        }

        return category;
    }

    async update(id: string, updateCategoryDto: UpdateCategoryDto) {
        await this.findOne(id); // Ensure it exists

        return this.prisma.category.update({
            where: { id },
            data: updateCategoryDto,
        });
    }

    async remove(id: string) {
        await this.findOne(id); // Ensure it exists

        return this.prisma.category.delete({
            where: { id },
        });
    }
}
