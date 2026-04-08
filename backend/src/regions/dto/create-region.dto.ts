import { IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateRegionDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsInt()
  @Min(0)
  @Max(9999)
  code: number;
}
