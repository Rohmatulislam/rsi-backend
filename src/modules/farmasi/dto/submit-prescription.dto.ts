import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';

export enum DeliveryMethod {
    PICKUP = 'PICKUP',
    DELIVERY = 'DELIVERY',
}

export class SubmitPrescriptionDto {
    @IsString()
    @IsOptional()
    userId?: string;

    @IsString()
    @IsNotEmpty()
    patientName: string;

    @IsString()
    @IsNotEmpty()
    patientPhone: string;

    @IsString()
    @IsOptional()
    patientRM?: string;

    @IsString()
    @IsOptional()
    prescriptionImage?: string; // Base64 or URL

    @IsEnum(DeliveryMethod)
    deliveryMethod: DeliveryMethod;

    @IsString()
    @IsOptional()
    address?: string;

    @IsString()
    @IsOptional()
    note?: string;
}
