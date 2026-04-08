import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async findAll(): Promise<Omit<User, 'password_hash'>[]> {
    const users = await this.usersRepo.find({ order: { created_at: 'ASC' } });
    return users.map(({ password_hash, ...rest }) => rest as any);
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { username } });
  }

  async findByTgId(tgId: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { tg_id: tgId } });
  }

  async create(dto: CreateUserDto): Promise<Omit<User, 'password_hash'>> {
    const existing = await this.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException('Username already exists');
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(dto.password, salt);

    const user = this.usersRepo.create({
      username: dto.username,
      password_hash: hash,
      role: dto.role,
      tg_id: dto.tg_id || null,
    });

    const saved = await this.usersRepo.save(user);
    const { password_hash, ...result } = saved;
    return result as any;
  }

  async update(
    id: number,
    dto: UpdateUserDto,
  ): Promise<Omit<User, 'password_hash'>> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.password) {
      const salt = await bcrypt.genSalt(12);
      user.password_hash = await bcrypt.hash(dto.password, salt);
    }

    if (dto.role !== undefined) user.role = dto.role;
    if (dto.tg_id !== undefined) user.tg_id = dto.tg_id;

    const saved = await this.usersRepo.save(user);
    const { password_hash, ...result } = saved;
    return result as any;
  }

  async remove(id: number): Promise<void> {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepo.remove(user);
  }
}
