import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

interface MCUPackage {
    name: string;
    price: string;
    items: string[];
}

@Injectable()
export class KnowledgeBaseService {
    private readonly logger = new Logger(KnowledgeBaseService.name);
    private cachedContext: string | null = null;
    private cacheExpiry: number = 0;
    private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

    constructor(private readonly prisma: PrismaService) { }

    async getHospitalContext(): Promise<string> {
        const now = Date.now();
        if (this.cachedContext && now < this.cacheExpiry) {
            return this.cachedContext;
        }

        try {
            const [about, milestones, founders, coreValues] = await Promise.all([
                this.prisma.aboutContent.findMany(),
                this.prisma.milestone.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
                this.prisma.founder.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
                this.prisma.coreValue.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
            ]);

            let context = "INFORMASI RUMAH SAKIT:\n";

            // About
            about.forEach(item => {
                let val = item.value;
                if (item.key === 'mission' && val.startsWith('[')) {
                    try {
                        val = JSON.parse(val).join(', ');
                    } catch (e) { }
                }
                context += `- ${item.key.toUpperCase()}: ${val}\n`;
            });

            // Founders
            if (founders.length > 0) {
                context += "\nPENDIRI & TOKOH:\n";
                founders.forEach(f => {
                    context += `- ${f.name} (${f.role}): ${f.description || ''}\n`;
                });
            }

            // Core Values
            if (coreValues.length > 0) {
                context += "\nNILAI-NILAI UTAMA (CORE VALUES):\n";
                coreValues.forEach(v => {
                    context += `- ${v.title}: ${v.description}\n`;
                });
            }

            // Milestones
            if (milestones.length > 0) {
                context += "\nSEJARAH & MILESTONE:\n";
                milestones.forEach(m => {
                    context += `- Tahun ${m.year}: ${m.title} - ${m.description}\n`;
                });
            }

            this.cachedContext = context;
            this.cacheExpiry = now + this.CACHE_TTL;
            return context;
        } catch (error) {
            this.logger.error('Error building hospital context:', error);
            return "Informasi RS saat ini tidak tersedia secara detail.";
        }
    }

    async getMCUPackagesContext(): Promise<string> {
        try {
            let csvPath = path.join(process.cwd(), 'Paket MCU 2026.csv');

            if (!fs.existsSync(csvPath)) {
                this.logger.warn(`CSV not found at ${csvPath}, checking parent directory...`);
                csvPath = path.resolve(process.cwd(), '..', 'Paket MCU 2026.csv');
            }

            if (!fs.existsSync(csvPath)) {
                this.logger.error(`CSV not found at ${csvPath}`);
                return "Data paket MCU 2026 belum tersedia.";
            }

            const content = fs.readFileSync(csvPath, 'utf-8');
            const lines = content.split('\n').filter(l => l.trim().length > 0);

            if (lines.length < 3) return "Data paket MCU 2026 kosong.";

            const headers = lines[2].split(';');
            const packages: MCUPackage[] = [];
            const itemPrices: { name: string, price: string }[] = [];

            // Identify Packages
            for (let i = 3; i < headers.length; i++) {
                const name = headers[i]?.trim();
                if (name) packages.push({ name, price: '', items: [] });
            }

            // Parse Items and Prices
            for (let i = 3; i < lines.length; i++) {
                const parts = lines[i].split(';');
                const itemName = parts[0]?.trim();
                const itemPrice = parts[1]?.trim();

                if (!itemName || itemName.toLowerCase() === 'admin') continue;

                // Price/Total rows (typically lines 33-34 in full file)
                if (i >= 31 && (itemName.toLowerCase().includes('total') || itemName.toLowerCase().includes('diskon') || itemName === ';')) {
                    packages.forEach((pkg, idx) => {
                        const val = parts[idx + 3]?.trim();
                        if (val && val.length > 3) pkg.price = val;
                    });
                    continue;
                }

                // Individual Item Price
                if (itemPrice && itemPrice !== '0' && itemPrice.length > 1) {
                    itemPrices.push({ name: itemName, price: itemPrice });
                }

                // Map inclusions
                packages.forEach((pkg, idx) => {
                    const inclusion = parts[idx + 3]?.trim();
                    if (inclusion && inclusion !== '' && inclusion !== '0') {
                        pkg.items.push(itemName);
                    }
                });
            }

            let context = "[HARGA LAYANAN SATUAN]\n";
            itemPrices.forEach(it => {
                context += `- ${it.name}: Rp ${it.price}\n`;
            });

            context += "\n[DAFTAR PAKET MCU 2026]\n";
            packages.forEach(pkg => {
                context += `- ${pkg.name}: Harga Rp ${pkg.price}. Meliputi: ${pkg.items.join(', ')}.\n`;
            });

            return context;
        } catch (error) {
            this.logger.error('Error parsing MCU CSV:', error);
            return "Terjadi kesalahan saat membaca data paket MCU.";
        }
    }

    async getTreatmentPreparation(treatmentName: string): Promise<string | null> {
        try {
            const metadata = await this.prisma.treatmentMetadata.findFirst({
                where: {
                    OR: [
                        { treatmentId: { contains: treatmentName, mode: 'insensitive' } },
                        { description: { contains: treatmentName, mode: 'insensitive' } }
                    ]
                }
            });

            if (metadata?.preparation) {
                return `Persiapan untuk ${treatmentName}: ${metadata.preparation}`;
            }
            return null;
        } catch (error) {
            return null;
        }
    }
}
