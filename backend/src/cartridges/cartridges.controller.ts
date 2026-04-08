import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CartridgesService } from './cartridges.service';
import { CreateCartridgeDto } from './dto/create-cartridge.dto';
import { UpdateCartridgeDto } from './dto/update-cartridge.dto';

@Controller('cartridges')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CartridgesController {
  constructor(private readonly cartridgesService: CartridgesService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.cartridgesService.findAll(search);
  }

  @Get('next-number')
  @Roles('admin', 'editor')
  getNextNumber(@Query('region_id') regionId?: string) {
    const parsedRegionId = regionId ? parseInt(regionId, 10) : undefined;
    return this.cartridgesService.getNextNumber(parsedRegionId);
  }

  @Get('name-suggestions')
  getNameSuggestions(@Query('query') query?: string) {
    return this.cartridgesService.getNameSuggestions(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cartridgesService.findOne(id);
  }

  @Post()
  @Roles('admin', 'editor')
  create(@Body() dto: CreateCartridgeDto) {
    return this.cartridgesService.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'editor')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartridgeDto,
    @Req() req: any,
  ) {
    return this.cartridgesService.update(id, dto, req.user?.sub);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.cartridgesService.remove(id);
  }
}
