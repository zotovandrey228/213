import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { UsersModule } from '../users/users.module';
import { CartridgesModule } from '../cartridges/cartridges.module';
import { WorksModule } from '../works/works.module';
import { NotesModule } from '../notes/notes.module';

@Module({
  imports: [UsersModule, CartridgesModule, WorksModule, NotesModule],
  providers: [TelegramService],
})
export class TelegramModule {}
