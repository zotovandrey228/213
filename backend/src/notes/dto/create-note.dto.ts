import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateNoteDto {
  @IsInt()
  cartridge_id: number;

  @IsString()
  content: string;

  @IsOptional()
  @IsInt()
  created_by_id?: number;
}
