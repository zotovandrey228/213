import {
  IsString,
  IsOptional,
  MaxLength,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';

export class UpdateCartridgeDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serial_number?: string;

  @IsOptional()
  @IsInt()
  region_id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  number?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  comment?: string;

  @IsOptional()
  @IsString()
  @IsIn(['refill', 'ready_to_install', 'installed', 'broken'])
  status?: 'refill' | 'ready_to_install' | 'installed' | 'broken';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  status_reason?: string;
}
