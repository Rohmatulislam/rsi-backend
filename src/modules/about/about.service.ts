import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { FounderUploadService } from './services/founder-upload.service';
import { CreateFounderDto } from './dto/create-founder.dto';
import { UpdateFounderDto } from './dto/update-founder.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

@Injectable()
export class AboutService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly founderUploadService: FounderUploadService
    ) { }

    // ========================
    // FOUNDER CRUD
    // ========================

    async createFounder(createFounderDto: CreateFounderDto) {
        let imagePath = createFounderDto.image;

        if (imagePath && imagePath.startsWith('data:image')) {
            const ext = imagePath.split(';')[0].split('/')[1] || 'jpg';
            const fileName = `founder-${Date.now()}.${ext}`;
            imagePath = await this.founderUploadService.saveFounderImage(imagePath, fileName);
        }

        return this.prisma.founder.create({
            data: {
                ...createFounderDto,
                image: imagePath,
            },
        });
    }

    async findAllFounders() {
        return this.prisma.founder.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findOneFounder(id: string) {
        const founder = await this.prisma.founder.findUnique({ where: { id } });
        if (!founder) throw new NotFoundException(`Founder with id ${id} not found`);
        return founder;
    }

    async updateFounder(id: string, updateFounderDto: UpdateFounderDto) {
        const existing = await this.prisma.founder.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Founder with id ${id} not found`);

        let imagePath = updateFounderDto.image;

        if (imagePath && imagePath.startsWith('data:image')) {
            const ext = imagePath.split(';')[0].split('/')[1] || 'jpg';
            const fileName = `founder-${id}-${Date.now()}.${ext}`;
            imagePath = await this.founderUploadService.saveFounderImage(
                imagePath,
                fileName,
                existing.image || undefined
            );
        }

        const dataToUpdate = { ...updateFounderDto };
        if (imagePath) {
            dataToUpdate.image = imagePath;
        }

        return this.prisma.founder.update({
            where: { id },
            data: dataToUpdate,
        });
    }

    async removeFounder(id: string) {
        const existing = await this.prisma.founder.findUnique({ where: { id } });
        if (existing?.image) {
            await this.founderUploadService.deleteFounderImage(existing.image);
        }
        return this.prisma.founder.delete({ where: { id } });
    }

    // ========================
    // MILESTONE CRUD
    // ========================

    async createMilestone(createMilestoneDto: CreateMilestoneDto) {
        return this.prisma.milestone.create({
            data: createMilestoneDto,
        });
    }

    async findAllMilestones() {
        return this.prisma.milestone.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findOneMilestone(id: string) {
        const milestone = await this.prisma.milestone.findUnique({ where: { id } });
        if (!milestone) throw new NotFoundException(`Milestone with id ${id} not found`);
        return milestone;
    }

    async updateMilestone(id: string, updateMilestoneDto: UpdateMilestoneDto) {
        const existing = await this.prisma.milestone.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Milestone with id ${id} not found`);

        return this.prisma.milestone.update({
            where: { id },
            data: updateMilestoneDto,
        });
    }

    async removeMilestone(id: string) {
        return this.prisma.milestone.delete({ where: { id } });
    }

    // ========================
    // ABOUT CONTENT CRUD
    // ========================

    async findAllAboutContent() {
        return this.prisma.aboutContent.findMany();
    }

    async findAboutContentByKey(key: string) {
        return this.prisma.aboutContent.findUnique({ where: { key } });
    }

    async upsertAboutContent(key: string, value: string) {
        return this.prisma.aboutContent.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
    }

    // ========================
    // CORE VALUE CRUD
    // ========================

    async findAllCoreValues() {
        return this.prisma.coreValue.findMany({
            where: { isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findOneCoreValue(id: string) {
        const coreValue = await this.prisma.coreValue.findUnique({ where: { id } });
        if (!coreValue) throw new NotFoundException(`CoreValue with id ${id} not found`);
        return coreValue;
    }

    async updateCoreValue(id: string, data: { title?: string; description?: string; icon?: string; order?: number }) {
        const existing = await this.prisma.coreValue.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`CoreValue with id ${id} not found`);

        return this.prisma.coreValue.update({
            where: { id },
            data,
        });
    }

    // Initialize default core values if not exists
    async initializeCoreValues() {
        const count = await this.prisma.coreValue.count();
        if (count === 0) {
            const defaultValues = [
                { title: "Ikhlas", description: "Melayani dengan ketulusan hati semata-mata mengharap ridho Allah SWT.", icon: "Heart", order: 0 },
                { title: "Profesional", description: "Bekerja sesuai kompetensi, standar prosedur, dan kode etik profesi.", icon: "CheckCircle2", order: 1 },
                { title: "Ukhuwah", description: "Mengutamakan kebersamaan, kerjasama, dan persaudaraan dalam bekerja.", icon: "Users", order: 2 },
                { title: "Istiqomah", description: "Konsisten dalam kebaikan dan perbaikan berkelanjutan (continuous improvement).", icon: "Target", order: 3 },
            ];

            for (const value of defaultValues) {
                await this.prisma.coreValue.create({ data: value });
            }
        }
        return this.findAllCoreValues();
    }

    // Initialize default about content if not exists
    async initializeAboutContent() {
        const defaults = [
            { key: "history", value: "Rumah Sakit Islam Siti Hajar Mataram didirikan pada tahun 1985 oleh para tokoh muslim yang peduli dengan kesehatan umat. Berawal dari sebuah klinik sederhana, kini telah berkembang menjadi rumah sakit modern yang melayani masyarakat NTB dengan standar pelayanan kesehatan yang tinggi." },
            { key: "vision", value: "Menjadi Rumah Sakit Syariah Pilihan Utama Masyarakat dengan Pelayanan Profesional dan Islami di Nusa Tenggara Barat." },
            {
                key: "mission", value: JSON.stringify([
                    "Menyelenggarakan pelayanan kesehatan yang paripurna, bermutu, dan terjangkau.",
                    "Mewujudkan sumber daya manusia yang profesional, amanah, dan berkarakter Islami.",
                    "Menyediakan sarana dan prasarana yang modern, nyaman, dan ramah lingkungan.",
                    "Mengembangkan tata kelola rumah sakit yang transparan, akuntabel, dan berkelanjutan.",
                    "Berperan aktif dalam meningkatkan derajat kesehatan masyarakat melalui dakwah bil hal."
                ])
            },
        ];

        for (const item of defaults) {
            await this.prisma.aboutContent.upsert({
                where: { key: item.key },
                update: {},
                create: item,
            });
        }
        return this.findAllAboutContent();
    }
}

