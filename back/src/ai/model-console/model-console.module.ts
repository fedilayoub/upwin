import { Module } from '@nestjs/common';
import { ModelConsoleController } from './model-console.controller';
import { ModelConsoleService } from './model-console.service';
import { ModelUsageRepository } from './model-usage.repository';

@Module({
  controllers: [ModelConsoleController],
  providers: [ModelConsoleService, ModelUsageRepository],
})
export class ModelConsoleModule {}
