CREATE TABLE IF NOT EXISTS "organizations" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "organizations_created_at_idx"
  ON "organizations" ("created_at");

CREATE TABLE IF NOT EXISTS "organization_members" (
  "id" text PRIMARY KEY NOT NULL,
  "organization_id" text NOT NULL,
  "user_id" text NOT NULL,
  "role" text DEFAULT 'member' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_members_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade,
  CONSTRAINT "organization_members_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_members_org_id_user_id_uq"
  ON "organization_members" ("organization_id", "user_id");

CREATE INDEX IF NOT EXISTS "organization_members_org_id_idx"
  ON "organization_members" ("organization_id");

CREATE INDEX IF NOT EXISTS "organization_members_user_id_idx"
  ON "organization_members" ("user_id");
