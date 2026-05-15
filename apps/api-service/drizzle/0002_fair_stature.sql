CREATE TABLE "scheduled_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"node_id" text NOT NULL,
	"name" text NOT NULL,
	"agent_kind" text DEFAULT 'opencode' NOT NULL,
	"prompt" text NOT NULL,
	"model" text,
	"command" text,
	"cron_expression" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_scheduled_for" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_run_status" text,
	"last_error_code" text,
	"last_error_message" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_job_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"project_id" text NOT NULL,
	"node_id" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_body" text,
	"error_code" text,
	"error_message" text,
	"error_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_job_id_scheduled_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."scheduled_jobs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "scheduled_job_runs" ADD CONSTRAINT "scheduled_job_runs_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "scheduled_jobs_organization_id_idx" ON "scheduled_jobs" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "scheduled_jobs_project_id_idx" ON "scheduled_jobs" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "scheduled_jobs_node_id_idx" ON "scheduled_jobs" USING btree ("node_id");
--> statement-breakpoint
CREATE INDEX "scheduled_jobs_status_idx" ON "scheduled_jobs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "scheduled_jobs_next_run_at_idx" ON "scheduled_jobs" USING btree ("next_run_at");
--> statement-breakpoint
CREATE INDEX "scheduled_jobs_created_by_user_id_idx" ON "scheduled_jobs" USING btree ("created_by_user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "scheduled_job_runs_job_id_scheduled_for_uq" ON "scheduled_job_runs" USING btree ("job_id","scheduled_for");
--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_job_id_idx" ON "scheduled_job_runs" USING btree ("job_id");
--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_project_id_idx" ON "scheduled_job_runs" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_node_id_idx" ON "scheduled_job_runs" USING btree ("node_id");
--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_status_idx" ON "scheduled_job_runs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "scheduled_job_runs_scheduled_for_idx" ON "scheduled_job_runs" USING btree ("scheduled_for");
