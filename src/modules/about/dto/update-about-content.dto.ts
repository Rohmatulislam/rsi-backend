import { IsString, IsOptional } from 'class-validator';

export class UpdateAboutContentDto {
    @IsString()
    value: string;
}
