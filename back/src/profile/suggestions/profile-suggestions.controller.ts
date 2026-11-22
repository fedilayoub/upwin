import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { User } from '../../database/schema';
import {
  type ProfileSuggestionResponse,
  type RecommendationStatusResponse,
  ProfileSuggestionsService,
} from './profile-suggestions.service';

@ApiTags('profile suggestions')
@ApiBearerAuth()
@Controller()
export class ProfileSuggestionsController {
  constructor(private readonly suggestions: ProfileSuggestionsService) {}

  @Post('profile-analyses/:analysisId/suggestions/:section')
  @ApiOperation({ summary: 'Generate one on-demand profile rewrite' })
  @ApiCreatedResponse({ description: 'A persisted, copy-ready alternative.' })
  create(
    @CurrentUser() user: User,
    @Param('analysisId', new ParseUUIDPipe()) analysisId: string,
    @Param('section') section: string,
    @Body() input: unknown,
  ): Promise<ProfileSuggestionResponse> {
    return this.suggestions.create(user.id, analysisId, section, input);
  }

  @Patch('profile-recommendations/:recommendationId')
  @ApiOperation({ summary: 'Record a copied or dismissed suggestion' })
  @ApiOkResponse({ description: 'The updated recommendation status.' })
  updateStatus(
    @CurrentUser() user: User,
    @Param('recommendationId', new ParseUUIDPipe()) recommendationId: string,
    @Body() input: unknown,
  ): Promise<RecommendationStatusResponse> {
    return this.suggestions.updateStatus(user.id, recommendationId, input);
  }
}
