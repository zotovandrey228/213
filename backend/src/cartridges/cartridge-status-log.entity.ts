import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Cartridge, CartridgeStatus } from './cartridge.entity';
import { User } from '../users/user.entity';

@Entity('cartridge_status_logs')
export class CartridgeStatusLog {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Cartridge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cartridge_id' })
  cartridge: Cartridge;

  @Column({ name: 'from_status', type: 'varchar', length: 30 })
  from_status: CartridgeStatus;

  @Column({ name: 'to_status', type: 'varchar', length: 30 })
  to_status: CartridgeStatus;

  @Column({ type: 'nvarchar', length: 'max', nullable: true })
  reason: string;

  @ManyToOne(() => User, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by' })
  changed_by: User;

  @CreateDateColumn({ name: 'changed_at' })
  changed_at: Date;
}
