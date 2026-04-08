import { IsString, IsOptional, MaxLength } from 'class-validator';

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
}
