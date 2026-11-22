import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { ExtensionOriginGuard } from './extension-origin.guard';
import { LocalAuthGuard } from './local-auth.guard';

@Module({
  imports: [UsersModule],
  providers: [
    { provide: APP_GUARD, useClass: ExtensionOriginGuard },
    { provide: APP_GUARD, useClass: LocalAuthGuard },
  ],
})
export class AuthModule {}
