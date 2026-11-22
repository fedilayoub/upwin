import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { User } from '../database/schema';
import { CreateGoalDto, UpdateGoalDto } from './goal.schema';
import { type GoalResponse, GoalsService } from './goals.service';

@ApiTags('goals')
@ApiBearerAuth()
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'List goals owned by the authenticated user' })
  @ApiOkResponse({ description: 'Goals, newest first.' })
  list(@CurrentUser() user: User): Promise<GoalResponse[]> {
    return this.goals.list(user.id);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get the active goal' })
  @ApiOkResponse({ description: 'The active goal.' })
  getActive(@CurrentUser() user: User): Promise<GoalResponse> {
    return this.goals.getActive(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create and activate a goal' })
  @ApiCreatedResponse({ description: 'The newly active goal.' })
  create(
    @CurrentUser() user: User,
    @Body() input: CreateGoalDto,
  ): Promise<GoalResponse> {
    return this.goals.create(user.id, input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit or activate an owned goal' })
  @ApiOkResponse({ description: 'The updated goal.' })
  update(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) goalId: string,
    @Body() input: UpdateGoalDto,
  ): Promise<GoalResponse> {
    return this.goals.update(user.id, goalId, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an owned goal' })
  @ApiNoContentResponse({ description: 'The goal is gone.' })
  @ApiConflictResponse({ description: 'GOAL_IN_USE — saved analyses use it.' })
  remove(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) goalId: string,
  ): Promise<void> {
    return this.goals.delete(user.id, goalId);
  }
}
