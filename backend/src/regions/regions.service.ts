import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Region } from './region.entity';
import { CreateRegionDto } from './dto/create-region.dto';

@Injectable()
export class RegionsService {
  constructor(
    @InjectRepository(Region)
    private readonly regionsRepo: Repository<Region>,
  ) {}

  async findAll(search?: string): Promise<Region[]> {
    if (search?.trim()) {
      return this.regionsRepo.find({
        where: { name: ILike(`%${search.trim()}%`) },
        order: { name: 'ASC' },
      });
    }

    return this.regionsRepo.find({ order: { name: 'ASC' } });
  }

  async create(dto: CreateRegionDto): Promise<Region> {
    const name = dto.name.trim();
    const existsByName = await this.regionsRepo.findOne({ where: { name } });
    if (existsByName) {
      throw new BadRequestException('Region already exists');
    }

    const existsByCode = await this.regionsRepo.findOne({ where: { code: dto.code } });
    if (existsByCode) {
      throw new BadRequestException('Region code already exists');
    }

    const region = this.regionsRepo.create({ name, code: dto.code });
    return this.regionsRepo.save(region);
  }

  async remove(id: number): Promise<void> {
    const region = await this.regionsRepo.findOne({ where: { id } });
    if (!region) {
      throw new NotFoundException('Region not found');
    }
    await this.regionsRepo.remove(region);
  }
}
