import { Module } from '@nestjs/common';
import { ProfileSnapshotsController } from './profile-snapshots.controller';
import { ProfileSnapshotsService } from './profile-snapshots.service';

@Module({
  controllers: [ProfileSnapshotsController],
  providers: [ProfileSnapshotsService],
  exports: [ProfileSnapshotsService],
})
export class ProfileSnapshotsModule {}
