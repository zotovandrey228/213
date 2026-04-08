import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Note } from './note.entity';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(
    @InjectRepository(Note)
    private readonly notesRepo: Repository<Note>,
  ) {}

  async findByCartridge(cartridgeId: number): Promise<Note[]> {
    return this.notesRepo.find({
      where: { cartridge: { id: cartridgeId } },
      relations: ['created_by'],
      order: { created_at: 'DESC' },
    });
  }

  async create(dto: CreateNoteDto, userId: number): Promise<Note> {
    const note = this.notesRepo.create({
      cartridge: { id: dto.cartridge_id } as any,
      content: dto.content,
      created_by: { id: dto.created_by_id ?? userId } as any,
    });
    return this.notesRepo.save(note);
  }

  async remove(id: number): Promise<void> {
    const note = await this.notesRepo.findOne({ where: { id } });
    if (!note) throw new NotFoundException('Note not found');
    await this.notesRepo.remove(note);
  }
}
