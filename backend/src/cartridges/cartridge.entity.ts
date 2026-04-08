import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Work } from '../works/work.entity';
import { Note } from '../notes/note.entity';
import { Region } from '../regions/region.entity';
import { CartridgeStatusLog } from './cartridge-status-log.entity';

export type CartridgeStatus =
  | 'refill'
  | 'ready_to_install'
  | 'installed'
  | 'broken';

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

  @ManyToOne(() => Region, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'region_id' })
  region: Region;

  @Column({ name: 'number', type: 'int', nullable: true })
  number: number;

  @Column({ name: 'formatted_number', length: 16, nullable: true })
  formatted_number: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: 'refill',
  })
  status: CartridgeStatus;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  comment: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  @OneToMany(() => Work, (work) => work.cartridge)
  works: Work[];

  @OneToMany(() => Note, (note) => note.cartridge)
  notes: Note[];

  @OneToMany(() => CartridgeStatusLog, (log) => log.cartridge)
  status_logs: CartridgeStatusLog[];
}
