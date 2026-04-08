import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Cartridge } from './cartridge.entity';
import { CreateCartridgeDto } from './dto/create-cartridge.dto';
import { UpdateCartridgeDto } from './dto/update-cartridge.dto';

@Injectable()
export class CartridgesService {
  constructor(
    @InjectRepository(Cartridge)
    private readonly cartridgesRepo: Repository<Cartridge>,
  ) {}

  async findAll(search?: string): Promise<Cartridge[]> {
    if (search) {
      return this.cartridgesRepo.find({
        where: [
          { name: ILike(`%${search}%`) },
          { model: ILike(`%${search}%`) },
          { serial_number: ILike(`%${search}%`) },
        ],
        order: { created_at: 'DESC' },
      });
    }
    return this.cartridgesRepo.find({ order: { created_at: 'DESC' } });
  }

  async findOne(id: number): Promise<Cartridge> {
    const cartridge = await this.cartridgesRepo.findOne({
      where: { id },
      relations: ['works', 'works.performed_by', 'notes', 'notes.created_by'],
    });
    if (!cartridge) {
      throw new NotFoundException('Cartridge not found');
    }
    return cartridge;
  }

  async create(dto: CreateCartridgeDto): Promise<Cartridge> {
    const cartridge = this.cartridgesRepo.create(dto);
    return this.cartridgesRepo.save(cartridge);
  }

  async update(id: number, dto: UpdateCartridgeDto): Promise<Cartridge> {
    const cartridge = await this.findOne(id);
    Object.assign(cartridge, dto);
    return this.cartridgesRepo.save(cartridge);
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
}
