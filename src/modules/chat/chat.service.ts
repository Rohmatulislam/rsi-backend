import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { DoctorService } from '../doctor/doctor.service';
import { PrismaService } from '../../infra/database/prisma.service';
import { KnowledgeBaseService } from './knowledge-base.service';

const FALLBACK_SYSTEM_PROMPT = `Anda adalah Siti, asisten virtual RSI Siti Hajar Mataram.

ATURAN WAJIB:
- Jawab SINGKAT, PADAT, maksimal 2-3 kalimat.
- Gunakan bahasa santai tapi sopan.
- Langsung ke inti jawaban, JANGAN bertele-tele.
- Jika ditanya di luar topik rumah sakit, tolak dengan sopan dalam 1 kalimat.

CONTOH CARA MENJAWAB (PENTING):
- Jika pasien tanya persiapan Lab (Contoh: "Apa persiapan cek gula darah?"):
  "Untuk cek gula darah puasa, Bapak/Ibu wajib puasa 8-10 jam sebelumnya ya. Boleh minum air putih saja. Informasi ini bersifat edukatif, silakan konsultasi lebih lanjut dengan dokter kami untuk diagnosa pasti."
- Jika pasien tanya Rontgen (Contoh: "Mau rontgen dada, apa syaratnya?"):
  "Untuk rontgen (thoraks), mohon lepaskan perhiasan atau benda logam di area dada sebelum pemeriksaan. Informasi ini bersifat edukatif, silakan konsultasi lebih lanjut dengan dokter kami untuk diagnosa pasti."
- Jika pasien tanya Paket MCU (Contoh: "Ada paket MCU apa saja?"):
  "Kami punya beberapa paket, salah satunya Paket MCU Basic seharga Rp 450.000 yang sudah mencakup konsultasi dokter dan pemeriksaan penunjang. Informasi ini bersifat edukatif, silakan konsultasi lebih lanjut dengan dokter kami untuk diagnosa pasti."

LAYANAN RS:
- Rawat Jalan & Rawat Inap, IGD 24 Jam, Lab, Radiologi, Farmasi, MCU.
- Spesialis: Penyakit Dalam, Anak, Kandungan, Bedah, dll.

KONTAK:
- Telp: (0370) 631885 | Alamat: Jl. Catur Warga No. 10 B, Mataram, NTB.`;

/** Max sessions kept in memory before evicting oldest */
const MAX_SESSIONS = 100;
/** Session expires after 30 minutes of inactivity */
const SESSION_TTL_MS = 30 * 60 * 1000;

interface SessionEntry {
    session: ChatSession;
    lastAccessed: number;
}

@Injectable()
export class ChatService implements OnModuleInit {
    private readonly logger = new Logger(ChatService.name);
    private model: GenerativeModel | null = null;

    /**
     * Per-conversation chat sessions keyed by sessionId.
     * Prevents context leaking between different users/conversations.
     */
    private readonly sessions = new Map<string, SessionEntry>();

    constructor(
        private readonly doctorService: DoctorService,
        private readonly prisma: PrismaService,
        private readonly kbService: KnowledgeBaseService,
    ) { }

    async onModuleInit() {
        await this.reloadPrompt();

        // One-time sync: if DB prompt exists but lacks examples, update it
        try {
            const dbPrompt = await this.prisma.aboutContent.findUnique({
                where: { key: 'ai_system_prompt' }
            });
            if (dbPrompt && !dbPrompt.value.includes('CONTOH CARA MENJAWAB')) {
                await this.prisma.aboutContent.update({
                    where: { key: 'ai_system_prompt' },
                    data: { value: FALLBACK_SYSTEM_PROMPT }
                });
                await this.reloadPrompt();
                this.logger.log('Synced AI system prompt examples to database.');
            }
        } catch (e) {
            this.logger.error('Failed to sync prompt examples:', e);
        }
    }

    async reloadPrompt() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY is not set.');
            return;
        }

        try {
            // Fetch prompt from DB
            const dbPrompt = await this.prisma.aboutContent.findUnique({
                where: { key: 'ai_system_prompt' }
            });

            const systemInstruction = dbPrompt?.value || FALLBACK_SYSTEM_PROMPT;
            this.logger.log(`Initializing Gemini with ${dbPrompt ? 'DB custom prompt' : 'fallback prompt'}.`);

            const genAI = new GoogleGenerativeAI(apiKey);
            this.model = genAI.getGenerativeModel({
                model: 'gemini-flash-latest',
                systemInstruction,
            });

            // Clear in-memory sessions to force new instruction application
            this.sessions.clear();
            this.logger.log('Gemini AI initialized/reloaded successfully.');
        } catch (error) {
            this.logger.error('Failed to initialize Gemini AI:', error);
        }
    }

    /**
     * Get or create a chat session for a given sessionId.
     * Each user/conversation gets its own isolated session.
     */
    private async getOrCreateSession(sessionId: string): Promise<ChatSession | null> {
        if (!this.model) return null;

        const existing = this.sessions.get(sessionId);
        const now = Date.now();

        if (existing && (now - existing.lastAccessed) < SESSION_TTL_MS) {
            existing.lastAccessed = now;
            return existing.session;
        }

        // Evict expired sessions or oldest if over limit
        this.evictStaleSessions();

        // Load history from DB to provide continuity
        const historyData = await this.getHistory(sessionId);
        const history = historyData.map(m => ({
            role: m.role as 'user' | 'model',
            parts: [{ text: m.content }],
        }));

        const session = this.model.startChat({ history });
        this.sessions.set(sessionId, { session, lastAccessed: now });
        return session;
    }

    async getHistory(sessionId: string) {
        try {
            return await (this.prisma as any).chatMessage.findMany({
                where: { sessionId },
                orderBy: { createdAt: 'asc' },
                take: 50,
            });
        } catch (error) {
            this.logger.error(`Failed to load history for session ${sessionId}:`, error);
            return [];
        }
    }

    async getSessions(userId: string) {
        try {
            const sessions = await (this.prisma as any).chatMessage.groupBy({
                by: ['sessionId'],
                where: { userId },
                _max: { createdAt: true },
                orderBy: {
                    _max: {
                        createdAt: 'desc',
                    },
                },
                take: 20,
            });

            // For each session, get the last message content as a preview
            const sessionsWithPreview = await Promise.all(
                sessions.map(async (s: any) => {
                    const lastMsg = await (this.prisma as any).chatMessage.findFirst({
                        where: { sessionId: s.sessionId },
                        orderBy: { createdAt: 'desc' },
                    });
                    return {
                        sessionId: s.sessionId,
                        lastMessage: lastMsg?.content || '',
                        createdAt: s._max.createdAt,
                    };
                }),
            );

            return sessionsWithPreview;
        } catch (error) {
            this.logger.error(`Failed to get sessions for user ${userId}:`, error);
            return [];
        }
    }

    private async saveMessage(sessionId: string, role: 'user' | 'model', content: string, userId?: string): Promise<string> {
        try {
            const msg = await (this.prisma as any).chatMessage.create({
                data: { sessionId, role, content, userId },
            });

            // Trigger asynchronous pruning to keep DB lean
            this.pruneHistory(sessionId).catch(err =>
                this.logger.error(`Pruning failed for session ${sessionId}:`, err)
            );

            return msg.id;
        } catch (error) {
            this.logger.error(`Failed to save message for session ${sessionId}:`, error);
            return '';
        }
    }

    private async pruneHistory(sessionId: string) {
        // Keep only last 100 messages per session
        const count = await (this.prisma as any).chatMessage.count({ where: { sessionId } });
        if (count > 100) {
            const oldestToKeep = await (this.prisma as any).chatMessage.findMany({
                where: { sessionId },
                orderBy: { createdAt: 'desc' },
                skip: 99,
                take: 1,
            });

            if (oldestToKeep.length > 0) {
                await (this.prisma as any).chatMessage.deleteMany({
                    where: {
                        sessionId,
                        createdAt: { lt: oldestToKeep[0].createdAt },
                    },
                });
            }
        }
    }

    /**
     * Remove expired sessions and enforce max session count.
     */
    private evictStaleSessions(): void {
        const now = Date.now();

        // Remove expired sessions
        for (const [key, entry] of this.sessions) {
            if (now - entry.lastAccessed > SESSION_TTL_MS) {
                this.sessions.delete(key);
            }
        }

        // If still over limit, remove oldest
        if (this.sessions.size >= MAX_SESSIONS) {
            let oldestKey: string | null = null;
            let oldestTime = Infinity;
            for (const [key, entry] of this.sessions) {
                if (entry.lastAccessed < oldestTime) {
                    oldestTime = entry.lastAccessed;
                    oldestKey = key;
                }
            }
            if (oldestKey) this.sessions.delete(oldestKey);
        }
    }

    // Levenshtein distance for typo tolerance
    private levenshteinDistance(str1: string, str2: string): number {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        const m = s1.length;
        const n = s2.length;

        const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (s1[i - 1] === s2[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
                }
            }
        }
        return dp[m][n];
    }

    // Calculate similarity score (0-1) based on Levenshtein distance
    private calculateSimilarity(str1: string, str2: string): number {
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();

        if (s1 === s2) return 1;
        if (s2.includes(s1) || s1.includes(s2)) return 0.95;

        const distance = this.levenshteinDistance(s1, s2);
        const maxLen = Math.max(s1.length, s2.length);
        return 1 - (distance / maxLen);
    }


    // Search doctors by name from local database (with fuzzy matching)
    async searchDoctorByName(name: string): Promise<any[]> {
        try {
            // First, try exact/partial match
            let doctors = await this.prisma.doctor.findMany({
                where: {
                    name: {
                        contains: name,
                        mode: 'insensitive',
                    },
                    isActive: true,
                },
                select: {
                    id: true,
                    name: true,
                    specialization: true,
                    department: true,
                    kd_dokter: true,
                    slug: true,
                },
                take: 5,
            });

            // If no exact match, try fuzzy search
            if (doctors.length === 0) {
                const allDoctors = await this.prisma.doctor.findMany({
                    where: { isActive: true },
                    select: {
                        id: true,
                        name: true,
                        specialization: true,
                        department: true,
                        kd_dokter: true,
                        slug: true,
                    },
                });

                // Find doctors with similar names
                // Compare against each word in doctor name (skip prefixes)
                const ignorePrefixes = ['dr.', 'dr', 'prof.', 'prof', 'h.', 'hj.', 'sp.', 'spd'];

                const calculateBestSimilarity = (searchName: string, fullName: string): number => {
                    const words = fullName.toLowerCase().split(/[\s,.]+/).filter(w =>
                        w.length > 2 && !ignorePrefixes.includes(w.toLowerCase())
                    );

                    let bestScore = 0;
                    for (const word of words) {
                        const score = this.calculateSimilarity(searchName, word);
                        if (score > bestScore) bestScore = score;
                    }
                    return bestScore;
                };

                doctors = allDoctors
                    .map(doc => ({
                        ...doc,
                        similarity: calculateBestSimilarity(name, doc.name)
                    }))
                    .filter(doc => doc.similarity > 0.7) // Higher threshold for accuracy
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 5)
                    .map(({ similarity, ...doc }) => doc);

                this.logger.log(`Fuzzy search for "${name}" found ${doctors.length} matches`);
            }
            return doctors;
        } catch (error) {
            this.logger.error('Error searching doctors:', error);
            return [];
        }
    }

    // Get doctor schedule from DoctorService (combines local + SIMRS)
    async getDoctorSchedule(doctorName: string, dayFilter?: string): Promise<string> {
        try {
            const doctors = await this.searchDoctorByName(doctorName);
            if (doctors.length === 0) {
                return `Tidak ditemukan dokter dengan nama "${doctorName}".`;
            }

            const doctor = doctors[0];
            const fullDoctor = await this.doctorService.findBySlug(doctor.slug) as any;

            if (!fullDoctor || !fullDoctor.scheduleDetails || fullDoctor.scheduleDetails.length === 0) {
                return `${doctor.name} (${doctor.specialization || 'Dokter'}) saat ini tidak memiliki jadwal praktik yang tersedia.`;
            }

            let schedules = fullDoctor.scheduleDetails;

            // Filter by day if provided
            if (dayFilter) {
                schedules = schedules.filter((s: any) =>
                    s.hari_kerja.toLowerCase().includes(dayFilter.toLowerCase())
                );

                if (schedules.length === 0) {
                    return `${doctor.name} tidak memiliki jadwal praktik di hari ${dayFilter}. Jadwal tersedia: ${fullDoctor.scheduleDetails.map((s: any) => s.hari_kerja).join(', ')}`;
                }
            }

            const scheduleText = schedules
                .map((s: any) => `${s.hari_kerja}: ${s.jam_mulai}-${s.jam_selesai} di ${s.nm_poli}`)
                .join(', ');

            return `Jadwal ${doctor.name} (${doctor.specialization || 'Dokter'}): ${scheduleText}`;
        } catch (error) {
            this.logger.error('Error getting doctor schedule:', error);
            return 'Gagal mengambil jadwal dokter dari sistem.';
        }
    }

    // Extract day from message
    private extractDay(message: string): string | null {
        const lower = message.toLowerCase();
        const today = new Date();
        const days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

        // Check for "hari ini"
        if (lower.includes('hari ini')) {
            return days[today.getDay()];
        }

        // Check for "besok" or "esok"
        if (lower.includes('besok') || lower.includes('esok')) {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return days[tomorrow.getDay()];
        }

        // Check for specific day names
        for (const day of days) {
            if (lower.includes(day)) return day;
        }

        return null;
    }


    // Get list of services
    async getServicesList(): Promise<string> {
        try {
            const services = await this.prisma.service.findMany({
                select: { name: true },
                take: 10,
            });
            return services.map(s => s.name).join(', ');
        } catch (error) {
            return 'Rawat Jalan, Rawat Inap, IGD, Lab, Radiologi, MCU, Farmasi, Rehabilitasi';
        }
    }

    // Detect if message is asking about doctor schedule
    private isDoctorQuery(message: string): boolean {
        const lower = message.toLowerCase();
        return (lower.includes('jadwal') || lower.includes('dokter') || lower.includes('dr.') || lower.includes('dr '))
            && !lower.includes('daftar');
    }

    // Extract doctor name from message
    private extractDoctorName(message: string): string | null {
        // Remove common words that aren't part of doctor names
        const stopWords = ['hari', 'ini', 'besok', 'lusa', 'minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'apa', 'ada', 'kapan', 'jam', 'berapa', 'apakah', 'siapa', 'dimana', 'hari ini', 'hari besok'];

        // Pattern: "jadwal dokter X" or "jadwal dr. X" or "dr X"
        const patterns = [
            /jadwal\s+(?:dokter|dr\.?)\s+([a-zA-Z]+)/i,
            /(?:dokter|dr\.?)\s+([a-zA-Z]+)\s+(?:jadwal|praktik|praktek)/i,
            /(?:dokter|dr\.?)\s+([a-zA-Z]+)/i,
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match && match[1]) {
                const name = match[1].trim().toLowerCase();
                // Skip if the extracted name is a stop word
                if (!stopWords.includes(name) && name.length > 2) {
                    return name;
                }
            }
        }
        return null;
    }

    // Detect if message is health-related or asking about preparations
    private isHealthQuery(message: string): boolean {
        const lower = message.toLowerCase();
        const keywords = [
            'persiapan', 'puasa', 'syarat', 'cara cek', 'hasil', 'sakit', 'gejala',
            'mcu', 'lab', 'radiologi', 'rontgen', 'obat', 'terapi'
        ];
        return keywords.some(k => lower.includes(k));
    }

    /**
     * Detect if message is a medical emergency.
     */
    private isEmergencyQuery(message: string): boolean {
        const lower = message.toLowerCase();
        const emergencyKeywords = [
            'sesak', 'sesak napas', 'nyeri dada', 'pendarahan', 'kecelakaan',
            'keracunan', 'serangan jantung', 'pingsan', 'kejang',
            'muntah darah', 'gawat', 'darurat', 'emergency',
            'melahirkan', 'pecah ketuban', 'stroke', 'serangan stroke',
            'sekarat', 'nyeri hebat', 'darurat'
        ];
        return emergencyKeywords.some(k => lower.includes(k));
    }

    /**
     * Process a chat message. Each sessionId gets its own isolated AI conversation.
     * @param message - The user's message
     * @param sessionId - Unique session identifier
     */
    async processMessage(message: string, sessionId: string = 'default'): Promise<{ text: string; isEmergency: boolean; messageId: string; action?: { type: string; payload: any } }> {
        try {
            this.logger.log(`Processing message (session: ${sessionId}): ${message}`);

            // 1. Core Safety Check (Hospital 4.0)
            const isEmergency = this.isEmergencyQuery(message);

            // 1. Fetch Dynamic Context from Knowledge Base
            let rsContext = '';
            let mcuContext = '';

            try {
                [rsContext, mcuContext] = await Promise.all([
                    this.kbService.getHospitalContext(),
                    this.kbService.getMCUPackagesContext()
                ]);
            } catch (contextError) {
                this.logger.error('Failed to fetch knowledge base context:', contextError);
            }

            let combinedContext = `[KNOWLEDGE_BASE]\n${rsContext}\n${mcuContext}\n`;

            // 2. Specialized Health / Procedure Context
            try {
                if (this.isHealthQuery(message)) {
                    const procedureKeywords = ['mcu', 'lab', 'radiologi', 'rontgen', 'usg', 'ekg'];
                    for (const kw of procedureKeywords) {
                        if (message.toLowerCase().includes(kw)) {
                            const prep = await this.kbService.getTreatmentPreparation(kw);
                            if (prep) combinedContext += `\n[PROCEDURE_PREPARATION]\n${prep}\n`;
                        }
                    }
                }
            } catch (healthError) {
                this.logger.error('Failed to fetch health context:', healthError);
            }

            // 3. Handle Doctor Schedule Query as separate higher-priority branch
            try {
                if (this.isDoctorQuery(message)) {
                    const doctorName = this.extractDoctorName(message);
                    if (doctorName) {
                        const dayFilter = this.extractDay(message);
                        const scheduleInfo = await this.getDoctorSchedule(doctorName, dayFilter || undefined);

                        if (!scheduleInfo.includes('Tidak ditemukan') && !scheduleInfo.includes('Gagal')) {
                            return {
                                text: scheduleInfo,
                                isEmergency: false,
                                messageId: await this.saveMessage(sessionId, 'model', scheduleInfo)
                            };
                        }
                        combinedContext += `\n[DOCTOR_SEARCH_RESULT]\n${scheduleInfo}\n`;
                    }
                }
            } catch (doctorError) {
                this.logger.error('Failed to handle doctor query:', doctorError);
            }

            const chatSession = await this.getOrCreateSession(sessionId);
            if (!chatSession) {
                return {
                    text: this.getFallbackResponse(message),
                    isEmergency,
                    messageId: '',
                    action: undefined
                };
            }

            // 4. Send to Gemini
            try {
                // Save user message to DB
                await this.saveMessage(sessionId, 'user', message);

                // Add a disclaimer instructions to the start of the message if health related
                if (this.isHealthQuery(message)) {
                    combinedContext += `\nCATATAN: User menanyakan hal medis/prosedur. Ingatkan bahwa ini edukatif dan tetap harus konsultasi dokter.
                    WAJIB: Selalu akhiri jawaban medis dengan kalimat 'Informasi ini bersifat edukatif, silakan konsultasi lebih lanjut dengan dokter kami untuk diagnosa pasti.'\n`;
                }

                if (isEmergency) {
                    combinedContext += `\nURGENT: Pasien mengalami kondisi darurat. Berikan instruksi pertolongan pertama singkat dan sangat disarankan segera ke IGD.\n`;
                }

                // Contextual Booking Suggestions (Structured Actions)
                combinedContext += `\nFORMAT KHUSUS: Jika Anda menyarankan poliklinik spesialis tertentu, sertakan di baris terakhir format [BOOK_POLI:Nama Poli]. Contoh: [BOOK_POLI:Spesialis Jantung]\n`;

                const promptWithContext = `${combinedContext}\n\nUser: ${message}`;

                this.logger.log(`Sending message to Gemini (session: ${sessionId}) with context.`);
                const result = await chatSession.sendMessage(promptWithContext);
                const botResponse = result.response.text();

                // Save bot response to DB and get ID
                const botMsgId = await this.saveMessage(sessionId, 'model', botResponse);

                // Parse structured actions from bot response
                let action: any = undefined;
                const actionMatch = botResponse.match(/\[BOOK_POLI:(.+?)\]/);
                if (actionMatch) {
                    action = { type: 'BOOK_POLI', payload: actionMatch[1] };
                }

                return {
                    text: botResponse.replace(/\[BOOK_POLI:.+?\]/, '').trim(),
                    isEmergency,
                    messageId: botMsgId,
                    action
                };
            } catch (error: any) {
                this.logger.error(`Gemini API error (session: ${sessionId}):`, error?.stack || error?.message || error);
                return {
                    text: 'Mohon maaf, terjadi gangguan saat berkomunikasi dengan asisten AI. Silakan coba lagi nanti.',
                    isEmergency: false,
                    messageId: '',
                    action: undefined
                };
            }
        } catch (globalError) {
            this.logger.error('CRITICAL: Error in processMessage global catch:', globalError);
            return {
                text: 'Mohon maaf, terjadi kesalahan internal pada sistem chat kami.',
                isEmergency: false,
                messageId: '',
                action: undefined
            };
        }
    }

    private getFallbackResponse(message: string): string {
        const lower = message.toLowerCase();

        if (lower.includes('mcu') || lower.includes('medical check up')) {
            return "RSI memiliki berbagai paket MCU mulai dari paket dasar hingga eksekutif. Kunjungi menu Layanan Unggulan > MCU untuk detail.";
        }

        if (lower.includes('dokter') || lower.includes('jadwal')) {
            return "Silakan cek halaman 'Cari Dokter' untuk melihat jadwal lengkap dokter spesialis kami.";
        }

        if (lower.includes('pendaftaran') || lower.includes('booking') || lower.includes('daftar')) {
            return "Untuk daftar online, login ke akun Anda, pilih dokter, lalu ikuti langkah pendaftaran.";
        }

        if (lower.includes('lokasi') || lower.includes('alamat')) {
            return "RSI Siti Hajar: Jl. Catur Warga No. 10 B, Mataram, NTB. Telp: (0370) 631885.";
        }

        return "Ada yang bisa saya bantu terkait layanan RSI Siti Hajar? Hubungi CS kami di (0370) 631885.";
    }

    async rateMessage(messageId: string, rating: number, comment?: string) {
        try {
            return await (this.prisma as any).chatFeedback.upsert({
                where: { messageId },
                update: { rating, comment },
                create: { messageId, rating, comment }
            });
        } catch (error) {
            this.logger.error(`Failed to rate message ${messageId}:`, error);
        }
    }
}
