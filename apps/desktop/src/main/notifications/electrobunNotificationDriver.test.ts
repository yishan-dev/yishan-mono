import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationShowMock = vi.fn();
const notificationOnMock = vi.fn();
const createdNotifications: Array<{
  __handlers: Record<string, () => void>;
}> = [];
const NotificationMock = vi.fn(function NotificationMockImplementation(this: {
  __handlers: Record<string, () => void>;
  show: typeof notificationShowMock;
  on: (event: string, listener: () => void) => unknown;
}) {
  this.__handlers = {};
  this.show = notificationShowMock;
  this.on = (event: string, listener: () => void) => {
    notificationOnMock(event, listener);
    this.__handlers[event] = listener;
    return this;
  };
  createdNotifications.push(this);
});

vi.mock("electron", () => ({
  Notification: NotificationMock,
}));

describe("createElectrobunNotificationDriver", () => {
  beforeEach(() => {
    NotificationMock.mockClear();
    notificationShowMock.mockReset();
    notificationOnMock.mockReset();
    createdNotifications.splice(0, createdNotifications.length);
  });

  it("forwards notifications to Electron Notification", async () => {
    const { createElectrobunNotificationDriver } = await import("./electrobunNotificationDriver");
    const driver = createElectrobunNotificationDriver();

    const result = await driver.show({
      title: "Run finished",
      body: "Workspace checkout",
      subtitle: "agent session",
      silent: true,
    });

    expect(NotificationMock).toHaveBeenCalledWith({
      title: "Run finished",
      body: "Workspace checkout",
      silent: true,
    });
    expect(notificationShowMock).toHaveBeenCalledTimes(1);
    expect(result?.notificationId).toEqual(expect.any(String));
  });

  it("emits click events to subscribers with notification identity", async () => {
    const { createElectrobunNotificationDriver } = await import("./electrobunNotificationDriver");
    const driver = createElectrobunNotificationDriver();
    const onClick = vi.fn();
    const unsubscribe = driver.subscribeClick?.(onClick);

    const result = await driver.show({
      title: "Run finished",
      body: "Workspace checkout",
      subtitle: "agent session",
      silent: true,
    });

    const notificationInstance = createdNotifications[0];
    expect(notificationInstance).toBeDefined();
    if (!notificationInstance) {
      throw new Error("Expected one notification instance");
    }
    notificationInstance.__handlers.click?.();

    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: result?.notificationId,
        title: "Run finished",
        body: "Workspace checkout",
      }),
    );

    unsubscribe?.();
  });
});
