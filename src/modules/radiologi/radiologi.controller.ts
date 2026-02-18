import { Controller, Get, Param, Query, Res, UseGuards, Logger } from '@nestjs/common';
import { Response } from 'express';
import { RadiologiService } from './radiologi.service';
import { PatientRadiologyService } from './patient-radiology.service';
import { PdfService } from '../pdf/pdf.service';
import { PatientService } from '../../infra/database/khanza/patient/patient.service';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('radiology')
@UseGuards(JwtAuthGuard)
export class RadiologiController {
    constructor(
        private readonly radiologiService: RadiologiService,
        private readonly patientRadiologyService: PatientRadiologyService,
        private readonly pdfService: PdfService,
        private readonly patientService: PatientService
    ) { }

    @Get('tests')
    @AllowAnonymous()
    async getTests(@Query('kd_pj') kd_pj?: string) {
        return this.radiologiService.getTests(kd_pj);
    }

    @Get('guarantors')
    @AllowAnonymous()
    async getGuarantors() {
        return this.radiologiService.getGuarantors();
    }

    @Get('categories')
    @AllowAnonymous()
    async getCategories(@Query('kd_pj') kd_pj?: string) {
        return this.radiologiService.getCategories(kd_pj);
    }

    @Get('test/:id')
    @AllowAnonymous()
    async getTestById(@Param('id') id: string) {
        return this.radiologiService.getTestById(id);
    }
    private readonly logger = new Logger(RadiologiController.name);

    @Get('history/:noRM')
    async getPatientRadiologyHistory(@Param('noRM') noRM: string) {
        this.logger.log(`Fetching radiology history for RM: ${noRM}`);
        return this.patientRadiologyService.getPatientRadiologyHistory(noRM);
    }

    @Get('results/:noRawat/:tgl/:jam')
    async getRadiologyResultDetails(
        @Param('noRawat') noRawat: string,
        @Param('tgl') tgl: string,
        @Param('jam') jam: string
    ) {
        return this.patientRadiologyService.getRadiologyResultDetails(noRawat, tgl, jam);
    }

    @Get('download-pdf/:noRawat/:tgl/:jam')
    async downloadRadiologyResultPdf(
        @Param('noRawat') noRawat: string,
        @Param('tgl') tgl: string,
        @Param('jam') jam: string,
        @Query('noRM') noRM: string,
        @Res() res: Response
    ) {
        // 1. Get Exam Info
        const history = await this.patientRadiologyService.getPatientRadiologyHistory(noRM);
        const exam = history.find(h => h.no_rawat === noRawat && h.tgl_periksa === tgl && h.jam === jam);

        if (!exam) {
            return res.status(404).json({ message: 'Pemeriksaan tidak ditemukan' });
        }

        // 2. Get Patient Info
        const patient = await this.patientService.findPatientByNoRM(noRM);

        // 3. Get Expertise
        const expertise = await this.patientRadiologyService.getRadiologyResultDetails(noRawat, tgl, jam);

        // 4. Generate PDF
        const pdfBuffer = await this.pdfService.generateRadiologyResultPdf(patient, exam, expertise || '');

        // 5. Send Response
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=Hasil_Radiologi_${noRM}_${noRawat.replace(/\//g, '-')}.pdf`,
            'Content-Length': pdfBuffer.length,
        });

        res.end(pdfBuffer);
    }
}
