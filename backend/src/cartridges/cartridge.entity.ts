import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Work } from '../works/work.entity';
import { Note } from '../notes/note.entity';

@Entity('cartridges')
export class Cartridge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 200 })
  model: string;

  @Column({ name: 'serial_number', nullable: true, length: 100 })
  serial_number: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => Work, (work) => work.cartridge)
  works: Work[];

  @OneToMany(() => Note, (note) => note.cartridge)
  notes: Note[];
}
