import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @IsEmail({}, { message: 'Format email tidak valid' })
    @IsNotEmpty({ message: 'Email wajib diisi' })
    email: string;

    @IsString()
    @MinLength(8, { message: 'Password minimal 8 karakter' })
    password: string;

    @IsString()
    @IsNotEmpty({ message: 'Nama wajib diisi' })
    name: string;

    @IsOptional()
    @IsString()
    phone?: string;
}

export class LoginDto {
    @IsEmail({}, { message: 'Format email tidak valid' })
    @IsNotEmpty({ message: 'Email wajib diisi' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'Password wajib diisi' })
    password: string;
}

export class ForgotPasswordDto {
    @IsEmail({}, { message: 'Format email tidak valid' })
    @IsNotEmpty({ message: 'Email wajib diisi' })
    email: string;
}

export class ResetPasswordDto {
    @IsString()
    @IsNotEmpty({ message: 'Token wajib diisi' })
    token: string;

    @IsString()
    @MinLength(8, { message: 'Password minimal 8 karakter' })
    newPassword: string;
}

export class VerifyEmailDto {
    @IsString()
    @IsNotEmpty({ message: 'Token wajib diisi' })
    token: string;
}
