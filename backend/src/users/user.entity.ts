import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Work } from '../works/work.entity';
import { Note } from '../notes/note.entity';

export type UserRole = 'admin' | 'editor' | 'viewer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 100 })
  username: string;

  @Column({ name: 'password_hash' })
  password_hash: string;

  @Column({ type: 'varchar', length: 20, default: 'viewer' })
  role: UserRole;

  @Column({ name: 'tg_id', nullable: true, length: 50 })
  tg_id: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @OneToMany(() => Work, (work) => work.performed_by)
  works: Work[];

  @OneToMany(() => Note, (note) => note.created_by)
  notes: Note[];
}
