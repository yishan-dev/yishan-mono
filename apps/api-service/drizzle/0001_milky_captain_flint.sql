ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "user_preferences" jsonb;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'language_preference'
  ) THEN
    EXECUTE '
      UPDATE "users"
      SET "user_preferences" = jsonb_build_object(
        ''languagePreference'',
        COALESCE(NULLIF("language_preference", ''''), ''en''),
        ''notificationPreferences'',
        COALESCE("notification_preferences", ''{}''::jsonb)
      )
      WHERE "user_preferences" IS NULL
    ';
  ELSE
    EXECUTE '
      UPDATE "users"
      SET "user_preferences" = jsonb_build_object(
        ''languagePreference'',
        ''en'',
        ''notificationPreferences'',
        COALESCE("notification_preferences", ''{}''::jsonb)
      )
      WHERE "user_preferences" IS NULL
    ';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "notification_preferences";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "language_preference";
