import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    async processMessage(message: string): Promise<string> {
        this.logger.log(`Processing message: ${message}`);
        const lower = message.toLowerCase();

        if (lower.includes('bola') || lower.includes('sepak bola')) {
            return "RSI fokus pada pelayanan kesehatan. Untuk informasi seputar layanan kesehatan kami, silakan tanyakan saja.";
        }

        if (lower.includes('mcu') || lower.includes('medical check up')) {
            return "RSI memiliki berbagai paket MCU mulai dari paket dasar hingga eksekutif. Anda bisa melihat detailnya di menu Layanan Unggulan > MCU.";
        }

        if (lower.includes('dokter') || lower.includes('jadwal')) {
            return "Anda bisa mencari jadwal dokter spesialis kami di halaman 'Cari Dokter'. Kami memiliki spesialis lengkap mulai dari Penyakit Dalam hingga Bedah Mulut.";
        }

        if (lower.includes('pendaftaran') || lower.includes('booking') || lower.includes('daftar')) {
            return "Untuk pendaftaran online, silakan login ke akun Anda, pilih dokter atau layanan yang diinginkan, lalu ikuti langkah pendaftaran yang tersedia.";
        }

        if (lower.includes('lokasi') || lower.includes('alamat')) {
            return "Hubungi Gedung RSI Siti Hajar di Jl. Gajah Mada No.110, Jempong Baru, Mataram.";
        }

        return "Terima kasih atas pesan Anda. Mohon maaf, saya asisten virtual yang masih dalam tahap belajar. Untuk bantuan lebih lanjut, silakan hubungi Customer Service kami di (0370) 671000.";
    }
}
