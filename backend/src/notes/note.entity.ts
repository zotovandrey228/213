import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cartridge } from '../cartridges/cartridge.entity';
import { User } from '../users/user.entity';

@Entity('notes')
export class Note {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Cartridge, (cartridge) => cartridge.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cartridge_id' })
  cartridge: Cartridge;

  @Column({ type: 'nvarchar', length: 'max' })
  content: string;

  @ManyToOne(() => User, (user) => user.notes, { nullable: true, eager: true })
  @JoinColumn({ name: 'created_by' })
  created_by: User;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
