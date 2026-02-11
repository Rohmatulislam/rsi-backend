import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infra/database/prisma.service';
import * as bcrypt from 'bcrypt';
import { NotificationService } from '../notification/notification.service';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  phone?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS = 12;
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = '7d';

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private notificationService: NotificationService,
  ) { }

  // Validate user credentials
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // Don't return password
    const { password: _, ...result } = user;
    return result;
  }

  // Register new user
  async register(registerDto: RegisterDto) {
    const { email, password, name, phone } = registerDto;
    this.logger.log(`Registration attempt for email: ${email}`);

    // Relaxed validation: only check length
    if (password.length < 8) {
      this.logger.warn(`Validation failed: Password too short for ${email}`);
      throw new BadRequestException('Password minimal 8 karakter');
    }

    /* 
    // Commented out strict rules temporarily to debug
    if (!/[A-Z]/.test(password)) {
      this.logger.warn(`Validation failed: No uppercase in password for ${email}`);
      throw new BadRequestException('Password harus mengandung huruf besar');
    }
    if (!/[0-9]/.test(password)) {
      this.logger.warn(`Validation failed: No number in password for ${email}`);
      throw new BadRequestException('Password harus mengandung angka');
    }
    */

    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      this.logger.warn(`Validation failed: Email already registered: ${email}`);
      throw new BadRequestException('Email sudah terdaftar');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        phone: phone || null,
        role: 'patient', // Default role
        emailVerified: false,
      },
    });

    this.logger.log(`New user registered: ${email}`);

    // Generate verification token (valid for 24 hours)
    const verificationToken = this.jwtService.sign(
      { sub: user.id, type: 'verify-email' },
      { expiresIn: '24h' }
    );

    // Send verification email
    this.logger.log(`Attempting to send verification email to: ${email}`);
    try {
      const emailSent = await this.notificationService.sendEmail({
        to: user.email,
        subject: 'Verifikasi Email - RSI Siti Hajar',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #008080; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">RSI Siti Hajar Mataram</h1>
            </div>
            <div style="padding: 30px;">
              <h2>Halo ${name},</h2>
              <p>Terima kasih telah mendaftar di RSI Siti Hajar Mataram. Silakan verifikasi alamat email Anda dengan menekan tombol di bawah ini:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'https://rsisitihajarmataram.co.id'}/verify-email?token=${verificationToken}" 
                   style="background-color: #008080; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  Verifikasi Email Saya
                </a>
              </div>
              <p>Link ini berlaku selama 24 jam.</p>
              <p>Jika Anda tidak merasa mendaftar di layanan kami, silakan abaikan email ini.</p>
            </div>
          </div>
        `,
      });

      if (emailSent) {
        this.logger.log(`✅ Verification email successfully sent to: ${email}`);
        return {
          message: 'Registrasi berhasil. Silakan cek email Anda untuk verifikasi.',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        };
      } else {
        this.logger.error(`❌ Verification email failed to send to: ${email}`);
        return {
          message: 'Registrasi berhasil, namun gagal mengirim email verifikasi. Silakan hubungi admin (rsisitihajar0@gmail.com) atau silakan coba daftar kembali nanti.',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        };
      }
    } catch (error) {
      this.logger.error(`💥 Unexpected error during registration email send for ${email}: ${error.message}`);
      return {
        message: 'Registrasi berhasil, namun terjadi kesalahan sistem saat mengirim email. Akun Anda sudah terdaftar, silakan hubungi admin.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }
  }

  // Login user
  async login(user: any) {
    const tokens = await this.generateTokens(user);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      message: 'Login berhasil',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  // Generate access and refresh tokens
  async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role ? user.role.toLowerCase() : 'user', // Ensure lowercase
      name: user.name,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  // Refresh access token
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User tidak ditemukan');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Refresh token tidak valid');
    }
  }

  // Get session (current user from token)
  async getSession(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        phone: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return { session: null, user: null };
    }

    return {
      session: { userId: user.id },
      user,
    };
  }

  // Forgot password - send reset email
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists or not
      return { message: 'Jika email terdaftar, link reset password akan dikirim' };
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = this.jwtService.sign(
      { sub: user.id, type: 'reset' },
      { expiresIn: '1h' }
    );

    // Store reset token in database
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour
      } as any,
    });

    // Send reset email
    try {
      await this.notificationService.sendEmail({
        to: user.email,
        subject: 'Reset Password - RSI Siti Hajar',
        html: `
          <h2>Reset Password</h2>
          <p>Anda menerima email ini karena ada permintaan reset password untuk akun Anda.</p>
          <p>Klik link berikut untuk reset password:</p>
          <a href="${process.env.FRONTEND_URL || 'https://rsisitihajarmataram.co.id'}/reset-password?token=${resetToken}">
            Reset Password
          </a>
          <p>Link ini berlaku selama 1 jam.</p>
          <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
        `,
      });
    } catch (error) {
      this.logger.error('Failed to send reset email:', error.message);
    }

    return { message: 'Jika email terdaftar, link reset password akan dikirim' };
  }

  // Reset password with token
  async resetPassword(token: string, newPassword: string) {
    try {
      const payload = this.jwtService.verify(token);

      if (payload.type !== 'reset') {
        throw new BadRequestException('Token tidak valid');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new BadRequestException('Token tidak valid');
      }

      // Validate new password
      if (newPassword.length < 8) {
        throw new BadRequestException('Password minimal 8 karakter');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // Update password
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        } as any,
      });

      this.logger.log(`Password reset for: ${user.email}`);

      return { message: 'Password berhasil direset' };
    } catch (error) {
      throw new BadRequestException('Token tidak valid atau sudah kadaluarsa');
    }
  }

  // Get user by email
  async getUserByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
    });
  }
  // Verify email with token
  async verifyEmail(token: string) {
    this.logger.log(`Received verification request with token: ${token?.substring(0, 15)}...`);

    if (!token) {
      this.logger.error('Verification failed: No token provided');
      throw new BadRequestException('Token tidak ditemukan');
    }

    try {
      const payload = this.jwtService.verify(token);
      this.logger.log(`Token payload decoded: ${JSON.stringify(payload)}`);

      if (payload.type !== 'verify-email') {
        this.logger.error(`Verification failed: Invalid token type "${payload.type}"`);
        throw new BadRequestException('Token tidak valid');
      }

      const userId = payload.sub;
      this.logger.log(`Looking up user with ID: ${userId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        this.logger.error(`Verification failed: User with ID ${userId} not found in database`);
        throw new BadRequestException('User tidak ditemukan');
      }

      if (user.emailVerified) {
        this.logger.log(`User ${user.email} is already verified. No action needed.`);
        return { message: 'Email sudah terverifikasi' };
      }

      this.logger.log(`Final update for user ${user.email} (ID: ${user.id}) - setting emailVerified to true`);

      // Update user
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
        },
      });

      this.logger.log(`✅ SUCCESS: Email verified for user: ${updatedUser.email}. Database status: ${updatedUser.emailVerified}`);

      return { message: 'Email berhasil diverifikasi' };
    } catch (error) {
      throw new BadRequestException('Token tidak valid atau sudah kadaluarsa');
    }
  }
}