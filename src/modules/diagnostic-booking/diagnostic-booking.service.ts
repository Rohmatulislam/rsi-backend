import { Injectable, Logger } from '@nestjs/common';
import { KhanzaService } from '../../infra/database/khanza.service';
import { PrismaService } from '../../infra/database/prisma.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class DiagnosticBookingService {
    private readonly logger = new Logger(DiagnosticBookingService.name);

    constructor(
        private readonly khanza: KhanzaService,
        private readonly prisma: PrismaService,
        private readonly paymentService: PaymentService
    ) { }

    private generateOrderNumber() {
        const date = new Date();
        const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.floor(1000 + Math.random() * 9000);
        return `DIAG-${ymd}-${random}`;
    }

    async createBooking(data: any) {
        const { items, date, timeSlot, patient } = data;
        this.logger.log(`Creating diagnostic booking for patient ${patient.fullName || patient.mrNumber} on ${date}`);

        let patientData = null;

        // 1. Ensure patient exists or create new one
        if (patient.patientType === 'old' && patient.mrNumber) {
            patientData = await this.khanza.findPatientByNoRM(patient.mrNumber);
        } else {
            // Create new patient logic
            patientData = await this.khanza.createPatient({
                name: patient.fullName,
                nik: patient.nik,
                birthDate: patient.birthDate,
                gender: patient.gender,
                address: patient.address,
                phone: patient.phone,
                email: patient.email,
                motherName: patient.motherName,
                birthPlace: patient.birthPlace,
                maritalStatus: patient.maritalStatus,
                religion: patient.religion,
                bloodType: patient.bloodType,
                penanggungJawab: patient.penanggungJawab,
                hubunganPenanggungJawab: patient.hubunganPenanggungJawab,
            });
        }

        if (!patientData) {
            throw new Error("Gagal mengidentifikasi atau membuat data pasien.");
        }

        // 2. Group items by type
        const mcuItems = items.filter((i: any) => i.type === 'MCU');
        const labItems = items.filter((i: any) => i.type === 'LAB');
        const radioItems = items.filter((i: any) => i.type === 'RADIOLOGY');

        const results: any = {
            mcu: [],
            lab: null,
            radio: null
        };

        // 3. Process MCU 
        for (const pkg of mcuItems) {
            const mcuResult = await this.khanza.createMcuBooking({
                patient: patientData,
                date: date,
                timeSlot: timeSlot,
                packageId: pkg.id,
                packageName: pkg.name,
                poliCode: 'U0028', // MCU Poli
                doctorCode: 'D0000043', // Default Doctor
                paymentType: 'A09' // UMUM
            });
            results.mcu.push(mcuResult);
        }

        // 4. Process Lab
        if (labItems.length > 0) {
            results.lab = await (this.khanza.bookingService as any).createLabBooking({
                patient: patientData,
                date: date,
                timeSlot: timeSlot,
                tests: labItems,
                paymentType: 'A09'
            });
        }

        // 5. Process Radiologi
        if (radioItems.length > 0) {
            results.radio = await (this.khanza.bookingService as any).createRadiologiBooking({
                patient: patientData,
                date: date,
                timeSlot: timeSlot,
                tests: radioItems,
                paymentType: 'A09'
            });
        }

        // 6. Save Local Diagnostic Order for Admin Management
        let order = null;
        try {
            const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price || 0), 0);
            order = await this.prisma.diagnosticOrder.create({
                data: {
                    orderNumber: this.generateOrderNumber(),
                    patientId: patientData.no_rkm_medis,
                    patientName: patientData.nm_pasien,
                    patientNIK: patient.nik || '-',
                    patientPhone: patient.phone || '-',
                    patientEmail: patient.email,
                    scheduledDate: new Date(date),
                    timeSlot: timeSlot,
                    totalAmount: totalAmount,
                    status: 'PENDING',
                    paymentStatus: 'UNPAID',
                    notes: patient.notes,
                    items: {
                        create: items.map((i: any) => ({
                            itemId: i.id,
                            name: i.name,
                            price: i.price || 0,
                            type: i.type
                        }))
                    }
                }
            });
            this.logger.log(`Local DiagnosticOrder created: ${order.orderNumber}`);
        } catch (error) {
            this.logger.error('Failed to save local DiagnosticOrder', error);
        }

        return {
            success: true,
            id: order?.id,
            patient: patientData.nm_pasien,
            no_rm: patientData.no_rkm_medis,
            orderNumber: order?.orderNumber,
            bookings: results
        };
    }

    async createPaymentToken(id: string) {
        const order = await this.prisma.diagnosticOrder.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!order) {
            throw new Error('Order tidak ditemukan');
        }

        if (order.paymentStatus === 'PAID') {
            throw new Error('Order sudah lunas');
        }

        if (order.snapToken) {
            return { token: order.snapToken };
        }

        const transaction = await this.paymentService.createTransaction({
            orderId: order.orderNumber,
            grossAmount: order.totalAmount,
            customerDetails: {
                firstName: order.patientName,
                email: order.patientEmail || undefined,
                phone: order.patientPhone || undefined,
            },
            itemDetails: order.items.map(item => ({
                id: item.itemId,
                price: item.price,
                quantity: 1,
                name: item.name,
                category: item.type
            }))
        });

        await this.prisma.diagnosticOrder.update({
            where: { id },
            data: { snapToken: transaction.token }
        });

        return transaction;
    }

    async findAllOrders() {
        return this.prisma.diagnosticOrder.findMany({
            include: { items: true },
            orderBy: { createdAt: 'desc' }
        });
    }

    async findOrderById(id: string) {
        return this.prisma.diagnosticOrder.findUnique({
            where: { id },
            include: { items: true }
        });
    }

    async findOrderByNumber(orderNumber: string) {
        return this.prisma.diagnosticOrder.findUnique({
            where: { orderNumber },
            include: { items: true }
        });
    }
}
