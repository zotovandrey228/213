import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { User } from '../users/user.entity';
import { Cartridge } from '../cartridges/cartridge.entity';
import { CartridgeStatusLog } from '../cartridges/cartridge-status-log.entity';
import { Work } from '../works/work.entity';
import { Note } from '../notes/note.entity';
import { Region } from '../regions/region.entity';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  username: process.env.DB_USERNAME || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrong@Password123',
  database: process.env.DB_DATABASE || 'cartridge_db',
  entities: [User, Cartridge, CartridgeStatusLog, Work, Note, Region],
  synchronize: true,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
});

async function seed() {
  await AppDataSource.initialize();
  console.log('Database connected');

  const userRepo = AppDataSource.getRepository(User);

  const existing = await userRepo.findOne({ where: { username: 'admin' } });
  if (existing) {
    console.log('Admin user already exists, skipping seed.');
    await AppDataSource.destroy();
    return;
  }

  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash('admin123', salt);

  const admin = userRepo.create({
    username: 'admin',
    password_hash: hash,
    role: 'admin',
  });

  await userRepo.save(admin);
  console.log('✅ Admin user created: username=admin, password=admin123');

  await AppDataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
