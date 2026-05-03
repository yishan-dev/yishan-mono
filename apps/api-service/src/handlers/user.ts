import type { AppContext } from "@/hono";
import { normalizeNotificationPreferences } from "@/lib/notification-preferences";
import type { UpdateNotificationPreferencesBodyInput } from "@/validation/user";

export async function meHandler(c: AppContext) {
  const user = c.get("sessionUser");
  return c.json({
    user: {
      ...user,
      notificationPreferences: normalizeNotificationPreferences(user.notificationPreferences),
    },
  });
}

export async function updateNotificationPreferencesHandler(
  c: AppContext,
  body: UpdateNotificationPreferencesBodyInput,
) {
  const actorUser = c.get("sessionUser");
  const preferences = await c.get("services").user.updateNotificationPreferences(actorUser.id, body);
  return c.json({ preferences });
}
