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
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Controller('notes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get('cartridge/:cartridgeId')
  findByCartridge(@Param('cartridgeId', ParseIntPipe) cartridgeId: number) {
    return this.notesService.findByCartridge(cartridgeId);
  }

  @Post()
  @Roles('admin', 'editor')
  create(@Body() dto: CreateNoteDto, @Request() req: any) {
    return this.notesService.create(dto, req.user.id);
  }

  @Delete(':id')
  @Roles('admin', 'editor')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.notesService.remove(id);
  }
}
