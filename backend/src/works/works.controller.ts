import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { WorksService } from './works.service';
import { CreateWorkDto } from './dto/create-work.dto';

@Controller('works')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorksController {
  constructor(private readonly worksService: WorksService) {}

  @Get('cartridge/:cartridgeId')
  findByCartridge(@Param('cartridgeId', ParseIntPipe) cartridgeId: number) {
    return this.worksService.findByCartridge(cartridgeId);
  }

  @Post()
  @Roles('admin', 'editor')
  create(@Body() dto: CreateWorkDto, @Request() req: any) {
    return this.worksService.create(dto, req.user.id);
  }

  @Delete(':id')
  @Roles('admin', 'editor')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.worksService.remove(id);
  }
}
