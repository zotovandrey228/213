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

@Entity('works')
export class Work {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Cartridge, (cartridge) => cartridge.works, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'cartridge_id' })
  cartridge: Cartridge;

  @Column({ type: 'nvarchar', length: 'max' })
  description: string;

  @Column({ name: 'performed_at' })
  performed_at: Date;

  @ManyToOne(() => User, (user) => user.works, { nullable: true, eager: true })
  @JoinColumn({ name: 'performed_by' })
  performed_by: User;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
