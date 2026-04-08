import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Work } from './work.entity';
import { CreateWorkDto } from './dto/create-work.dto';

@Injectable()
export class WorksService {
  constructor(
    @InjectRepository(Work)
    private readonly worksRepo: Repository<Work>,
  ) {}

  async findByCartridge(cartridgeId: number): Promise<Work[]> {
    return this.worksRepo.find({
      where: { cartridge: { id: cartridgeId } },
      relations: ['performed_by'],
      order: { performed_at: 'DESC' },
    });
  }

  async create(dto: CreateWorkDto, userId: number): Promise<Work> {
    const work = this.worksRepo.create({
      cartridge: { id: dto.cartridge_id } as any,
      description: dto.description,
      performed_at: new Date(dto.performed_at),
      performed_by: { id: dto.performed_by_id ?? userId } as any,
    });
    return this.worksRepo.save(work);
  }

  async remove(id: number): Promise<void> {
    const work = await this.worksRepo.findOne({ where: { id } });
    if (!work) throw new NotFoundException('Work not found');
    await this.worksRepo.remove(work);
  }
}
