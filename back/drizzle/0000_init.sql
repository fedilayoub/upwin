CREATE TABLE "freelancer_contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"experience" jsonb NOT NULL,
	"skills" jsonb NOT NULL,
	"portfolio" jsonb NOT NULL,
	"preferences" jsonb NOT NULL,
	"positioning" jsonb NOT NULL,
	"source" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"objective" text NOT NULL,
	"target_role" text NOT NULL,
	"target_project_types" jsonb NOT NULL,
	"target_clients" jsonb NOT NULL,
	"preferred_skills" jsonb NOT NULL,
	"target_rate_min" double precision,
	"target_rate_max" double precision,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ciphertext" text NOT NULL,
	"url" text NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"job_snapshot_id" uuid NOT NULL,
	"match_score" integer NOT NULL,
	"dimension_scores" jsonb NOT NULL,
	"summary" text NOT NULL,
	"strengths" jsonb NOT NULL,
	"concerns" jsonb NOT NULL,
	"question_count" integer NOT NULL,
	"prompt_version" text NOT NULL,
	"rubric_version" text NOT NULL,
	"scoring_version" text NOT NULL,
	"requested_model" text NOT NULL,
	"gateway" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"usage" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_selections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capability" text NOT NULL,
	"primary_model_id" text NOT NULL,
	"fallback_model_id" text NOT NULL,
	"notes" text,
	"updated_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"profile_snapshot_id" uuid NOT NULL,
	"prompt_revision_id" uuid,
	"winning_score" integer NOT NULL,
	"completeness_score" integer,
	"section_scores" jsonb NOT NULL,
	"summary" text NOT NULL,
	"prompt_version" text NOT NULL,
	"rubric_version" text NOT NULL,
	"scoring_version" text NOT NULL,
	"requested_model" text NOT NULL,
	"gateway" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"usage" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capability" text NOT NULL,
	"revision_number" integer NOT NULL,
	"status" text NOT NULL,
	"content" jsonb NOT NULL,
	"notes" text,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "profile_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"section" text NOT NULL,
	"rank" integer NOT NULL,
	"impact" text NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"reason" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendation" text NOT NULL,
	"kind" text,
	"signal" text,
	"field" text,
	"item_index" integer,
	"original_value" text,
	"suggested_value" text,
	"guidance" text,
	"items" jsonb,
	"suggestion_style" text,
	"variant_index" integer,
	"prompt_version" text,
	"requested_model" text,
	"gateway" text,
	"provider" text,
	"model" text,
	"usage" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"outcome_status" text,
	"outcome_note" text,
	"outcome_analysis_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_recommendations_suggestion_variant_uidx" UNIQUE NULLS NOT DISTINCT("analysis_id","section","signal","item_index","suggestion_style","variant_index")
);
--> statement-breakpoint
CREATE TABLE "profile_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"completeness" jsonb NOT NULL,
	"name" text,
	"title" text,
	"overview" text,
	"hourly_rate" double precision,
	"skills" jsonb NOT NULL,
	"portfolio" jsonb NOT NULL,
	"employment" jsonb NOT NULL,
	"education" jsonb NOT NULL,
	"certifications" jsonb NOT NULL,
	"languages" jsonb NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"proposal_length" text NOT NULL,
	"proposal_tone" text NOT NULL,
	"answer_length" text NOT NULL,
	"language" text NOT NULL,
	"sign_off_name" text,
	"custom_instructions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_analysis_id" uuid NOT NULL,
	"proposal" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"prompt_version" text NOT NULL,
	"word_budget_version" text NOT NULL,
	"requested_model" text NOT NULL,
	"gateway" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"usage" jsonb NOT NULL,
	"block_statuses" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_analysis_id" uuid NOT NULL,
	"proposal_draft_id" uuid,
	"status" text NOT NULL,
	"connects_spent" integer,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_views" (
	"id" uuid PRIMARY KEY NOT NULL,
	"video_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"watched_ms" integer DEFAULT 0 NOT NULL,
	"finished" boolean DEFAULT false NOT NULL,
	CONSTRAINT "video_views_watched_ms" CHECK ("video_views"."watched_ms" >= 0)
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"failure_reason" text,
	"source_kind" text NOT NULL,
	"has_camera" boolean NOT NULL,
	"has_audio" boolean NOT NULL,
	"job_snapshot_id" uuid,
	"storage_prefix" text NOT NULL,
	"upload_id" text,
	"part_size_bytes" integer NOT NULL,
	"max_bytes" bigint NOT NULL,
	"max_duration_ms" integer NOT NULL,
	"raw_size_bytes" bigint,
	"size_bytes" bigint,
	"duration_ms" integer,
	"width" integer,
	"height" integer,
	"playback_ready" boolean DEFAULT false NOT NULL,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"storage_purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	CONSTRAINT "videos_slug_unique" UNIQUE("slug"),
	CONSTRAINT "videos_title_length" CHECK (char_length("videos"."title") between 1 and 120),
	CONSTRAINT "videos_status" CHECK ("videos"."status" in ('uploading','processing','ready','failed')),
	CONSTRAINT "videos_failure_reason" CHECK ("videos"."failure_reason" in ('upload_abandoned','invalid_media','too_long','processing_error')),
	CONSTRAINT "videos_failure_status" CHECK (("videos"."status" = 'failed') = ("videos"."failure_reason" is not null)),
	CONSTRAINT "videos_source_kind" CHECK ("videos"."source_kind" in ('screen','window','tab','area')),
	CONSTRAINT "videos_view_count" CHECK ("videos"."view_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "freelancer_contexts" ADD CONSTRAINT "freelancer_contexts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_snapshots" ADD CONSTRAINT "job_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_analyses" ADD CONSTRAINT "job_analyses_job_snapshot_id_job_snapshots_id_fk" FOREIGN KEY ("job_snapshot_id") REFERENCES "public"."job_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_selections" ADD CONSTRAINT "model_selections_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_analyses" ADD CONSTRAINT "profile_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_analyses" ADD CONSTRAINT "profile_analyses_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_analyses" ADD CONSTRAINT "profile_analyses_profile_snapshot_id_profile_snapshots_id_fk" FOREIGN KEY ("profile_snapshot_id") REFERENCES "public"."profile_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_analyses" ADD CONSTRAINT "profile_analyses_prompt_revision_id_prompt_revisions_id_fk" FOREIGN KEY ("prompt_revision_id") REFERENCES "public"."prompt_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_revisions" ADD CONSTRAINT "prompt_revisions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_recommendations" ADD CONSTRAINT "profile_recommendations_analysis_id_profile_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."profile_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_recommendations" ADD CONSTRAINT "profile_recommendations_outcome_analysis_id_profile_analyses_id_fk" FOREIGN KEY ("outcome_analysis_id") REFERENCES "public"."profile_analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_preferences" ADD CONSTRAINT "proposal_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_drafts" ADD CONSTRAINT "proposal_drafts_job_analysis_id_job_analyses_id_fk" FOREIGN KEY ("job_analysis_id") REFERENCES "public"."job_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_outcomes" ADD CONSTRAINT "proposal_outcomes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_outcomes" ADD CONSTRAINT "proposal_outcomes_job_analysis_id_job_analyses_id_fk" FOREIGN KEY ("job_analysis_id") REFERENCES "public"."job_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_outcomes" ADD CONSTRAINT "proposal_outcomes_proposal_draft_id_proposal_drafts_id_fk" FOREIGN KEY ("proposal_draft_id") REFERENCES "public"."proposal_drafts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_views" ADD CONSTRAINT "video_views_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_job_snapshot_id_job_snapshots_id_fk" FOREIGN KEY ("job_snapshot_id") REFERENCES "public"."job_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "freelancer_contexts_user_uidx" ON "freelancer_contexts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goals_user_active_idx" ON "goals" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_one_active_per_user_uidx" ON "goals" USING btree ("user_id") WHERE "goals"."is_active";--> statement-breakpoint
CREATE INDEX "job_snapshots_user_created_idx" ON "job_snapshots" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "job_analyses_user_created_idx" ON "job_analyses" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "model_selections_capability_uidx" ON "model_selections" USING btree ("capability");--> statement-breakpoint
CREATE INDEX "profile_analyses_user_created_idx" ON "profile_analyses" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_revisions_capability_revision_uidx" ON "prompt_revisions" USING btree ("capability","revision_number");--> statement-breakpoint
CREATE UNIQUE INDEX "prompt_revisions_one_active_capability_uidx" ON "prompt_revisions" USING btree ("capability") WHERE "prompt_revisions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "profile_recommendations_analysis_rank_idx" ON "profile_recommendations" USING btree ("analysis_id","rank");--> statement-breakpoint
CREATE INDEX "profile_snapshots_user_captured_idx" ON "profile_snapshots" USING btree ("user_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_preferences_user_uidx" ON "proposal_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "proposal_drafts_analysis_created_idx" ON "proposal_drafts" USING btree ("user_id","job_analysis_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_outcomes_job_analysis_uidx" ON "proposal_outcomes" USING btree ("job_analysis_id");--> statement-breakpoint
CREATE INDEX "proposal_outcomes_user_sent_idx" ON "proposal_outcomes" USING btree ("user_id","sent_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "proposal_outcomes_user_created_idx" ON "proposal_outcomes" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "proposal_outcomes_user_status_idx" ON "proposal_outcomes" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "video_views_video_idx" ON "video_views" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "videos_user_created_idx" ON "videos" USING btree ("user_id","created_at" DESC NULLS LAST) WHERE "videos"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "videos_processing_idx" ON "videos" USING btree ("next_attempt_at") WHERE "videos"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "videos_uploading_idx" ON "videos" USING btree ("created_at") WHERE "videos"."status" = 'uploading';--> statement-breakpoint
CREATE INDEX "videos_job_snapshot_idx" ON "videos" USING btree ("job_snapshot_id") WHERE "videos"."job_snapshot_id" is not null;