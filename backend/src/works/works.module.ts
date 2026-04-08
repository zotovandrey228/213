import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Work } from './work.entity';
import { WorksService } from './works.service';
import { WorksController } from './works.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Work])],
  providers: [WorksService],
  controllers: [WorksController],
  exports: [WorksService],
})
export class WorksModule {}
