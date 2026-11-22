import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { createZodValidationPipe } from 'nestjs-zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { User } from '../../database/schema';
import type { ModelSelectableCapability } from '../capabilities';
import {
  modelSelectableCapabilitySchema,
  setCapabilityModelsSchema,
  SetCapabilityModelsDto,
} from './model-console.schema';
import { ModelConsoleService } from './model-console.service';

const ModelConsoleValidationPipe = createZodValidationPipe({
  createValidationException: () =>
    new UnprocessableEntityException({
      code: 'MODEL_SELECTION_INVALID',
      message: 'The model selection is invalid.',
    }),
});
const capabilityPipe = new ModelConsoleValidationPipe(
  modelSelectableCapabilitySchema,
);
const inputPipe = new ModelConsoleValidationPipe(setCapabilityModelsSchema);

@ApiTags('admin-models')
@ApiBearerAuth()
@Controller('admin/models')
export class ModelConsoleController {
  constructor(private readonly console: ModelConsoleService) {}

  @Get()
  @ApiOperation({ summary: 'Load effective model selections and cost estimates' })
  @ApiOkResponse({ description: 'The three admin-selectable AI capabilities.' })
  getConsole() {
    return this.console.getConsole();
  }

  @Get('catalog')
  @ApiOperation({ summary: 'List live structured-output-capable gateway models' })
  listCatalog() {
    return this.console.listCatalog();
  }

  @Put(':capability')
  set(
    @CurrentUser() user: User,
    @Param('capability', capabilityPipe) capability: ModelSelectableCapability,
    @Body(inputPipe) input: SetCapabilityModelsDto,
  ) {
    return this.console.set(capability, user.id, input);
  }

  @Delete(':capability')
  clear(
    @Param('capability', capabilityPipe) capability: ModelSelectableCapability,
  ) {
    return this.console.clear(capability);
  }

  @Post(':capability/probe')
  @ApiOperation({
    summary: 'Probe effective primary and fallback with two tiny paid structured calls',
  })
  probe(
    @Param('capability', capabilityPipe) capability: ModelSelectableCapability,
  ) {
    return this.console.probe(capability);
  }
}
