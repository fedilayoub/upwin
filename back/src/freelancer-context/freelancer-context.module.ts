import { Module } from '@nestjs/common';
import { CvExtractionService } from './cv-extraction.service';
import { CvTextService } from './cv-text.service';
import { FreelancerContextController } from './freelancer-context.controller';
import { FreelancerContextService } from './freelancer-context.service';

@Module({
  imports: [],
  controllers: [FreelancerContextController],
  providers: [CvExtractionService, CvTextService, FreelancerContextService],
  exports: [FreelancerContextService],
})
export class FreelancerContextModule {}
