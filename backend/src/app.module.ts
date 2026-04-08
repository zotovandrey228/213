import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CartridgesModule } from './cartridges/cartridges.module';
import { WorksModule } from './works/works.module';
import { NotesModule } from './notes/notes.module';
import { TelegramModule } from './telegram/telegram.module';
import { User } from './users/user.entity';
import { Cartridge } from './cartridges/cartridge.entity';
import { Work } from './works/work.entity';
import { Note } from './notes/note.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mssql',
        host: config.get('DB_HOST'),
        port: parseInt(config.get('DB_PORT') || '1433'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_DATABASE'),
        entities: [User, Cartridge, Work, Note],
        synchronize: true,
        options: {
          encrypt: false,
          trustServerCertificate: true,
        },
        retryAttempts: 10,
        retryDelay: 5000,
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    CartridgesModule,
    WorksModule,
    NotesModule,
    TelegramModule,
  ],
})
export class AppModule {}
