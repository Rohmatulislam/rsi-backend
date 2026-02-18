import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class PdfService {
    private readonly logger = new Logger(PdfService.name);

    /**
     * Generate a lab result PDF
     */
    async generateLabResultPdf(
        patientInfo: any,
        examInfo: any,
        results: any[]
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new (PDFDocument as any)({ margin: 50, size: 'A4' });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err) => reject(err));

            // --- HEADER ---
            this.generateHeader(doc);

            // --- PATIENT INFO ---
            this.generatePatientInfo(doc, patientInfo, examInfo);

            // --- RESULTS TABLE ---
            this.generateResultsTable(doc, results);

            // --- FOOTER ---
            this.generateFooter(doc);

            doc.end();
        });
    }

    /**
     * Generate a radiology result PDF
     */
    async generateRadiologyResultPdf(
        patientInfo: any,
        examInfo: any,
        expertise: string
    ): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new (PDFDocument as any)({ margin: 50, size: 'A4' });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', (err) => reject(err));

            // --- HEADER ---
            this.generateHeader(doc);

            // --- PATIENT INFO & TITLE ---
            this.generateRadiologyInfo(doc, patientInfo, examInfo);

            // --- EXPERTISE CONTENT ---
            this.generateExpertiseContent(doc, expertise);

            // --- FOOTER ---
            this.generateFooter(doc);

            doc.end();
        });
    }

    private generateHeader(doc: PDFKit.PDFDocument) {
        doc
            .fillColor('#065f46') // Emerald-800
            .fontSize(20)
            .text('RSI SITI HAJAR MATARAM', 110, 50)
            .fontSize(10)
            .fillColor('#64748b') // Slate-500
            .text('Jl. Catur Warga No. 8 Mataram, NTB', 110, 75)
            .text('Telepon: (0370) 623498 | Email: info@rsisitihajar.com', 110, 90)
            .moveDown();

        doc.moveTo(50, 115).lineTo(550, 115).strokeColor('#e2e8f0').stroke();
    }

    private generatePatientInfo(doc: PDFKit.PDFDocument, patient: any, exam: any) {
        doc
            .fillColor('#0f172a') // Slate-900
            .fontSize(14)
            .text('HASIL PEMERIKSAAN LABORATORIUM', 50, 130, { align: 'center' })
            .moveDown();

        const top = 160;
        doc
            .fontSize(10)
            .text('Nama Pasien:', 50, top)
            .font('Helvetica-Bold')
            .text(patient.nm_pasien || '-', 150, top)
            .font('Helvetica')
            .text('No. RM:', 350, top)
            .font('Helvetica-Bold')
            .text(patient.no_rkm_medis || '-', 450, top);

        doc
            .font('Helvetica')
            .text('Tgl. Lahir:', 50, top + 20)
            .text(patient.tgl_lahir || '-', 150, top + 20)
            .text('Jenis Kelamin:', 350, top + 20)
            .text(patient.jk === 'L' ? 'Laki-laki' : 'Perempuan', 450, top + 20);

        doc
            .text('Tgl. Periksa:', 50, top + 40)
            .text(exam.tgl_periksa || '-', 150, top + 40)
            .text('Dokter Pengirim:', 350, top + 40)
            .text(exam.nm_dokter || '-', 450, top + 40);

        doc.moveTo(50, top + 65).lineTo(550, top + 65).strokeColor('#e2e8f0').stroke();
    }

    private generateResultsTable(doc: PDFKit.PDFDocument, results: any[]) {
        const tableTop = 250;

        doc.font('Helvetica-Bold').fontSize(10);
        this.generateTableRow(doc, tableTop, 'Pemeriksaan', 'Hasil', 'Satuan', 'Nilai Rujukan');

        doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).strokeColor('#000').stroke();

        let i = 0;
        for (i = 0; i < results.length; i++) {
            const item = results[i];
            const position = tableTop + 30 + (i * 25);

            doc.font('Helvetica').fontSize(10);
            this.generateTableRow(
                doc,
                position,
                item.name,
                item.nilai,
                item.satuan,
                item.nilai_rujukan
            );

            if (item.isAbnormal) {
                doc.fillColor('red').text('*', 140, position).fillColor('black');
            }
        }
    }

    private generateTableRow(
        doc: PDFKit.PDFDocument,
        y: number,
        name: string,
        result: string,
        unit: string,
        reference: string
    ) {
        doc
            .text(name, 50, y, { width: 180 })
            .text(result, 240, y, { width: 80 })
            .text(unit, 330, y, { width: 60 })
            .text(reference, 400, y, { width: 150 });
    }

    private generateRadiologyInfo(doc: PDFKit.PDFDocument, patient: any, exam: any) {
        doc
            .fillColor('#0f172a') // Slate-900
            .fontSize(14)
            .text('HASIL PEMERIKSAAN RADIOLOGI', 50, 130, { align: 'center' })
            .moveDown();

        const top = 160;
        doc
            .fontSize(10)
            .text('Nama Pasien:', 50, top)
            .font('Helvetica-Bold')
            .text(patient.nm_pasien || '-', 150, top)
            .font('Helvetica')
            .text('No. RM:', 350, top)
            .font('Helvetica-Bold')
            .text(patient.no_rkm_medis || '-', 450, top);

        doc
            .font('Helvetica')
            .text('Tgl. Lahir:', 50, top + 20)
            .text(patient.tgl_lahir || '-', 150, top + 20)
            .text('Jenis Kelamin:', 350, top + 20)
            .text(patient.jk === 'L' ? 'Laki-laki' : 'Perempuan', 450, top + 20);

        doc
            .text('Tgl. Periksa:', 50, top + 40)
            .text(`${exam.tgl_periksa} ${exam.jam}` || '-', 150, top + 40)
            .text('Dokter Pengirim:', 350, top + 40)
            .text(exam.nm_dokter || '-', 450, top + 40);

        doc
            .font('Helvetica-Bold')
            .text('Pemeriksaan:', 50, top + 60)
            .text(exam.nm_perawatan || '-', 150, top + 60);

        doc.moveTo(50, top + 80).lineTo(550, top + 80).strokeColor('#e2e8f0').stroke();
    }

    private generateExpertiseContent(doc: PDFKit.PDFDocument, expertise: string) {
        doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .text('HASIL EXPERTISE / BACAAN DOKTER:', 50, 260)
            .moveDown();

        doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#1e293b')
            .text(expertise || 'Hasil belum diinput oleh dokter spesialis.', 55, 285, {
                width: 490,
                align: 'left',
                lineGap: 4
            });
    }

    private generateFooter(doc: PDFKit.PDFDocument) {
        doc
            .fontSize(8)
            .fillColor('#64748b')
            .text(
                'Dokumen ini dihasilkan secara otomatis oleh Sistem Informasi Digital RSI Siti Hajar Mataram dan sah tanpa tanda tangan basah.',
                50,
                780,
                { align: 'center', width: 500 }
            );
    }
}
