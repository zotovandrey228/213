import { IsString, IsDateString, IsOptional, IsInt } from 'class-validator';

export class CreateWorkDto {
  @IsInt()
  cartridge_id: number;

  @IsString()
  description: string;

  @IsDateString()
  performed_at: string;

  @IsOptional()
  @IsInt()
  performed_by_id?: number;
}
