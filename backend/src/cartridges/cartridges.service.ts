import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Cartridge } from './cartridge.entity';
import { CreateCartridgeDto } from './dto/create-cartridge.dto';
import { UpdateCartridgeDto } from './dto/update-cartridge.dto';
import { Region } from '../regions/region.entity';
import { CartridgeStatusLog } from './cartridge-status-log.entity';
import { User } from '../users/user.entity';

@Injectable()
export class CartridgesService {
  constructor(
    @InjectRepository(Cartridge)
    private readonly cartridgesRepo: Repository<Cartridge>,
    @InjectRepository(Region)
    private readonly regionsRepo: Repository<Region>,
    @InjectRepository(CartridgeStatusLog)
    private readonly statusLogsRepo: Repository<CartridgeStatusLog>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async findAll(search?: string): Promise<Cartridge[]> {
    const qb = this.cartridgesRepo
      .createQueryBuilder('cartridge')
      .leftJoinAndSelect('cartridge.region', 'region')
      .orderBy('cartridge.created_at', 'DESC');

    if (search) {
      qb.where(
        'cartridge.name LIKE :search OR cartridge.model LIKE :search OR cartridge.serial_number LIKE :search OR cartridge.formatted_number LIKE :search OR cartridge.status LIKE :search OR region.name LIKE :search',
        { search: `%${search}%` },
      );
    }

    return qb.getMany();
  }

  async findOne(id: number): Promise<Cartridge> {
    const cartridge = await this.cartridgesRepo.findOne({
      where: { id },
      relations: [
        'region',
        'works',
        'works.performed_by',
        'notes',
        'notes.created_by',
        'status_logs',
        'status_logs.changed_by',
      ],
    });
    if (!cartridge) {
      throw new NotFoundException('Cartridge not found');
    }
    return cartridge;
  }

  async create(dto: CreateCartridgeDto): Promise<Cartridge> {
    const cartridge = this.cartridgesRepo.create({
      ...dto,
      model: dto.model?.trim() || dto.name,
    });

    if (dto.region_id) {
      const region = await this.regionsRepo.findOne({ where: { id: dto.region_id } });
      if (!region) {
        throw new BadRequestException('Region not found');
      }
      cartridge.region = region;
    }

    if (cartridge.region) {
      if (cartridge.region.code === null || cartridge.region.code === undefined) {
        throw new BadRequestException('Region code is not configured');
      }
      cartridge.number = dto.number || (await this.getNextNumber(cartridge.region.id)).number;
      await this.assertNumberUnique(cartridge.number, cartridge.region.id);
      cartridge.formatted_number = this.formatCartridgeNumber(
        cartridge.region.code,
        cartridge.number,
      );
    } else {
      cartridge.number = dto.number || (await this.getNextNumber()).number;
      await this.assertNumberUnique(cartridge.number);
      cartridge.formatted_number = null;
    }

    cartridge.status = dto.status || 'refill';

    return this.cartridgesRepo.save(cartridge);
  }

  async update(id: number, dto: UpdateCartridgeDto, changedByUserId?: number): Promise<Cartridge> {
    const cartridge = await this.findOne(id);
    const previousStatus = cartridge.status;
    const { status_reason, ...entityDto } = dto;

    if (dto.region_id !== undefined) {
      if (dto.region_id === null) {
        cartridge.region = null;
      } else {
        const region = await this.regionsRepo.findOne({ where: { id: dto.region_id } });
        if (!region) {
          throw new BadRequestException('Region not found');
        }
        cartridge.region = region;
      }
    }

    const nextNumber = dto.number ?? cartridge.number;
    const regionId = cartridge.region?.id;

    if (nextNumber !== undefined) {
      await this.assertNumberUnique(nextNumber, regionId, id);
    }

    const formattedNumber =
      cartridge.region && nextNumber && cartridge.region.code !== null && cartridge.region.code !== undefined
        ? this.formatCartridgeNumber(cartridge.region.code, nextNumber)
        : null;

    Object.assign(cartridge, {
      ...entityDto,
      model: entityDto.model?.trim() || entityDto.name || cartridge.model,
      number: nextNumber,
      formatted_number: formattedNumber,
    });

    const saved = await this.cartridgesRepo.save(cartridge);

    if (dto.status && dto.status !== previousStatus) {
      let changedBy: User | null = null;
      if (changedByUserId) {
        changedBy = await this.usersRepo.findOne({ where: { id: changedByUserId } });
      }

      const statusLog = this.statusLogsRepo.create({
        cartridge: saved,
        from_status: previousStatus,
        to_status: dto.status,
        reason: status_reason?.trim() || null,
        changed_by: changedBy,
      });
      await this.statusLogsRepo.save(statusLog);
    }

    return this.findOne(saved.id);
  }

  async remove(id: number): Promise<void> {
    const cartridge = await this.findOne(id);
    await this.cartridgesRepo.remove(cartridge);
  }

  async findByName(name: string): Promise<Cartridge[]> {
    return this.cartridgesRepo.find({
      where: { name: ILike(`%${name}%`) },
      take: 10,
    });
  }

  async getNextNumber(regionId?: number): Promise<{ number: number; formatted_number?: string }> {
    const qb = this.cartridgesRepo
      .createQueryBuilder('cartridge')
      .select('MAX(cartridge.number)', 'max');

    if (regionId) {
      qb.where('cartridge.region_id = :regionId', { regionId });
    } else {
      qb.where('cartridge.region_id IS NULL');
    }

    const row = await qb.getRawOne<{ max: string | null }>();

    const max = row?.max ? Number(row.max) : 0;
    const number = max + 1;

    if (!regionId) {
      return { number };
    }

    const region = await this.regionsRepo.findOne({ where: { id: regionId } });
    if (!region) {
      throw new BadRequestException('Region not found');
    }
    if (region.code === null || region.code === undefined) {
      throw new BadRequestException('Region code is not configured');
    }

    return {
      number,
      formatted_number: this.formatCartridgeNumber(region.code, number),
    };
  }

  async getNameSuggestions(query?: string): Promise<string[]> {
    const qb = this.cartridgesRepo
      .createQueryBuilder('cartridge')
      .select('DISTINCT cartridge.name', 'name')
      .where('cartridge.name IS NOT NULL')
      .andWhere("cartridge.name <> ''")
      .orderBy('name', 'ASC')
      .take(10);

    if (query?.trim()) {
      qb.andWhere('cartridge.name LIKE :query', { query: `%${query.trim()}%` });
    }

    const rows = await qb.getRawMany<{ name: string }>();
    return rows.map((r) => r.name);
  }

  private async assertNumberUnique(
    number: number,
    regionId?: number,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.cartridgesRepo
      .createQueryBuilder('cartridge')
      .where('cartridge.number = :number', { number });

    if (regionId) {
      qb.andWhere('cartridge.region_id = :regionId', { regionId });
    } else {
      qb.andWhere('cartridge.region_id IS NULL');
    }

    const exists = await qb.getOne();
    if (exists && exists.id !== excludeId) {
      throw new BadRequestException('Cartridge number already exists in this region');
    }
  }

  private formatCartridgeNumber(regionCode: number, cartridgeNumber: number): string {
    return `${String(Number(regionCode))}_${String(cartridgeNumber).padStart(4, '0')}`;
  }
}
