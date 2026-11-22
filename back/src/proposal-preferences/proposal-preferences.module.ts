import { Module } from '@nestjs/common';
import { ProposalPreferencesController } from './proposal-preferences.controller';
import { ProposalPreferencesService } from './proposal-preferences.service';

@Module({
  controllers: [ProposalPreferencesController],
  providers: [ProposalPreferencesService],
  exports: [ProposalPreferencesService],
})
export class ProposalPreferencesModule {}
