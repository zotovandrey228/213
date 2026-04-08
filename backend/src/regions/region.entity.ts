import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('regions')
export class Region {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 120 })
  name: string;

  @Column({ type: 'int', nullable: true })
  code: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
