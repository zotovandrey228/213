import {
  IsString,
  IsIn,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username: string;

  @IsString()
  @MinLength(4)
  password: string;

  @IsIn(['admin', 'editor', 'viewer'])
  role: 'admin' | 'editor' | 'viewer';

  @IsOptional()
  @IsString()
  tg_id?: string;
}
