import { Module } from '@nestjs/common';
import { JobSnapshotsController } from './job-snapshots.controller';
import { JobSnapshotsService } from './job-snapshots.service';

@Module({
  controllers: [JobSnapshotsController],
  providers: [JobSnapshotsService],
  exports: [JobSnapshotsService],
})
export class JobSnapshotsModule {}
