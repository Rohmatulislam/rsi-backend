import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { LabService } from './lab.service';
import { PatientLabService } from './patient-lab.service';
import { PdfService } from '../pdf/pdf.service';
import { PatientService } from '../../infra/database/khanza/patient/patient.service';
import { AllowAnonymous } from '../../infra/auth/allow-anonymous.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('lab')
@UseGuards(JwtAuthGuard)
export class LabController {
    constructor(
        private readonly labService: LabService,
        private readonly patientLabService: PatientLabService,
        private readonly pdfService: PdfService,
        private readonly patientService: PatientService
    ) { }

    @Get('guarantors')
    @AllowAnonymous()
    async getGuarantors() {
        return this.labService.getGuarantors();
    }

    @Get('tests')
    @AllowAnonymous()
    async getTests(@Query('kd_pj') kd_pj?: string) {
        return this.labService.getTests(kd_pj);
    }

    @Get('categories')
    @AllowAnonymous()
    async getCategories(@Query('kd_pj') kd_pj?: string) {
        return this.labService.getCategories(kd_pj);
    }

    @Get('tests/category/:category')
    @AllowAnonymous()
    async getTestsByCategory(
        @Param('category') category: string,
        @Query('kd_pj') kd_pj?: string
    ) {
        return this.labService.getTestsByCategory(category, kd_pj);
    }

    @Get('template/:id')
    @AllowAnonymous()
    async getTemplateById(@Param('id') id: string) {
        return this.labService.getTemplateById(parseInt(id));
    }

    @Get('history/:noRM')
    async getPatientLabHistory(@Param('noRM') noRM: string) {
        try {
            const fs = require('fs');
            fs.appendFileSync('debug-lab-ctrl.log', `Request for ${noRM} at ${new Date().toISOString()}\n`);
        } catch (e) { }
        return this.patientLabService.getPatientLabHistory(noRM);
    }

    @Get('results/:noRawat/:kdJenisPrw')
    async getLabResultDetails(
        @Param('noRawat') noRawat: string,
        @Param('kdJenisPrw') kdJenisPrw: string
    ) {
        return this.patientLabService.getLabResultDetails(noRawat, kdJenisPrw);
    }

    @Get('download-pdf/:noRawat/:kdJenisPrw')
    async downloadLabResultPdf(
        @Param('noRawat') noRawat: string,
        @Param('kdJenisPrw') kdJenisPrw: string,
        @Query('noRM') noRM: string,
        @Res() res: Response
    ) {
        // 1. Get Exam Info
        const history = await this.patientLabService.getPatientLabHistory(noRM);
        const exam = history.find(h => h.no_rawat === noRawat && h.kd_jenis_prw === kdJenisPrw);

        if (!exam) {
            return res.status(404).json({ message: 'Pemeriksaan tidak ditemukan' });
        }

        // 2. Get Patient Info
        const patient = await this.patientService.findPatientByNoRM(noRM);

        // 3. Get Details
        const results = await this.patientLabService.getLabResultDetails(noRawat, kdJenisPrw);

        // 4. Generate PDF
        const pdfBuffer = await this.pdfService.generateLabResultPdf(patient, exam, results);

        // 5. Send Response
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename=Hasil_Lab_${noRM}_${noRawat.replace(/\//g, '-')}.pdf`,
            'Content-Length': pdfBuffer.length,
        });

        res.end(pdfBuffer);
    }
}
