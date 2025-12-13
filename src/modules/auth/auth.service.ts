import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  // Fungsi untuk mendapatkan user berdasarkan email
  async getUserByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }
}