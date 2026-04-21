CREATE TABLE IF NOT EXISTS "nodes" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "scope" text NOT NULL,
  "endpoint" text,
  "metadata" jsonb,
  "owner_user_id" text,
  "organization_id" text,
  "created_by_user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "nodes_owner_user_id_users_id_fk"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE cascade,
  CONSTRAINT "nodes_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade,
  CONSTRAINT "nodes_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "nodes_scope_idx"
  ON "nodes" ("scope");

CREATE INDEX IF NOT EXISTS "nodes_owner_user_id_idx"
  ON "nodes" ("owner_user_id");

CREATE INDEX IF NOT EXISTS "nodes_organization_id_idx"
  ON "nodes" ("organization_id");

CREATE INDEX IF NOT EXISTS "nodes_created_by_user_id_idx"
  ON "nodes" ("created_by_user_id");
