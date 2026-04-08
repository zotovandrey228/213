import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateCartridgeDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(200)
  model: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serial_number?: string;
}
