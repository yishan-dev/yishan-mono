CREATE TABLE "workspace_pull_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"pr_id" text NOT NULL,
	"title" text,
	"url" text,
	"branch" text,
	"base_branch" text,
	"state" text NOT NULL,
	"metadata" jsonb,
	"detected_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_pull_requests" ADD CONSTRAINT "workspace_pull_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspace_pull_requests" ADD CONSTRAINT "workspace_pull_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_pull_requests_workspace_id_pr_id_uq" ON "workspace_pull_requests" USING btree ("workspace_id","pr_id");
--> statement-breakpoint
CREATE INDEX "workspace_pull_requests_workspace_id_idx" ON "workspace_pull_requests" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "workspace_pull_requests_organization_id_idx" ON "workspace_pull_requests" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "workspace_pull_requests_state_idx" ON "workspace_pull_requests" USING btree ("state");
