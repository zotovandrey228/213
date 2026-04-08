import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cartridge } from './cartridge.entity';
import { CartridgesService } from './cartridges.service';
import { CartridgesController } from './cartridges.controller';
import { Region } from '../regions/region.entity';
import { CartridgeStatusLog } from './cartridge-status-log.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Cartridge, Region, CartridgeStatusLog, User])],
  providers: [CartridgesService],
  controllers: [CartridgesController],
  exports: [CartridgesService],
})
export class CartridgesModule {}
