import { IsString, IsNumber, IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';

export class CreateBudgetDto {
    @IsString()
    category: string;

    @IsNumber()
    amount: number;

    @IsString()
    period: string; // 'monthly' | 'yearly'

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    month?: number;

    @IsInt()
    year: number;

    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateBudgetDto {
    @IsOptional()
    @IsNumber()
    amount?: number;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
