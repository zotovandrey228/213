import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cartridge } from './cartridge.entity';
import { CartridgesService } from './cartridges.service';
import { CartridgesController } from './cartridges.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cartridge])],
  providers: [CartridgesService],
  controllers: [CartridgesController],
  exports: [CartridgesService],
})
export class CartridgesModule {}
