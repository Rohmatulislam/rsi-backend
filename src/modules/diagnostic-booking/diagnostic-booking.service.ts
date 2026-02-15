import { Injectable, Logger } from '@nestjs/common';
import { KhanzaService } from '../../infra/database/khanza.service';

@Injectable()
export class DiagnosticBookingService {
    private readonly logger = new Logger(DiagnosticBookingService.name);

    constructor(private readonly khanza: KhanzaService) { }

    async createBooking(data: any) {
        const { items, date, timeSlot, patient } = data;
        this.logger.log(`Creating diagnostic booking for patient ${patient.fullName || patient.mrNumber} on ${date}`);

        let patientData = null;

        // 1. Ensure patient exists or create new one
        if (patient.patientType === 'old' && patient.mrNumber) {
            patientData = await this.khanza.findPatientByNoRM(patient.mrNumber);
        } else {
            // Create new patient logic
            const nextNoRm = await this.khanza.getNextNoRM();
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

        // 3. Process MCU (Each MCU package is usually a separate booking or combined)
        for (const pkg of mcuItems) {
            const mcuResult = await this.khanza.createMcuBooking({
                patient: patientData,
                date: date,
                timeSlot: timeSlot,
                packageId: pkg.id,
                packageName: pkg.name,
                poliCode: 'MCU',
                doctorCode: '-', // Generic
                paymentType: 'A09' // UMUM
            });
            results.mcu.push(mcuResult);
        }

        // 4. Process Lab (Combined)
        if (labItems.length > 0) {
            results.lab = await (this.khanza.bookingService as any).createLabBooking({
                patient: patientData,
                date: date,
                timeSlot: timeSlot,
                tests: labItems,
                paymentType: 'A09'
            });
        }

        // 5. Process Radiologi (Combined)
        if (radioItems.length > 0) {
            results.radio = await (this.khanza.bookingService as any).createRadiologiBooking({
                patient: patientData,
                date: date,
                timeSlot: timeSlot,
                tests: radioItems,
                paymentType: 'A09'
            });
        }

        return {
            success: true,
            patient: patientData.nm_pasien,
            no_rm: patientData.no_rkm_medis,
            bookings: results
        };
    }
}
