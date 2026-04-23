// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import { ThreeColumnLayout } from "./ThreeColumnLayout";

type MountProbeProps = {
  paneId: string;
  onMount: (paneId: string) => void;
  onUnmount: (paneId: string) => void;
};

/**
 * Emits mount/unmount lifecycle events so tests can verify panes are hidden without remounting.
 */
function MountProbe({ paneId, onMount, onUnmount }: MountProbeProps) {
  useEffect(() => {
    onMount(paneId);
    return () => {
      onUnmount(paneId);
    };
  }, [onMount, onUnmount, paneId]);

  return <div data-testid={`${paneId}-pane`}>{paneId}</div>;
}

describe("ThreeColumnLayout", () => {
  it("keeps left and right panes mounted while collapsed state toggles", () => {
    const onMount = vi.fn();
    const onUnmount = vi.fn();

    const { rerender } = render(
      <ThreeColumnLayout
        left={<MountProbe paneId="left" onMount={onMount} onUnmount={onUnmount} />}
        main={<div data-testid="main-pane">main</div>}
        right={<MountProbe paneId="right" onMount={onMount} onUnmount={onUnmount} />}
        leftCollapsed={false}
        rightCollapsed={false}
        leftResizeLabel="Resize left"
        rightResizeLabel="Resize right"
        onResizeLeftStart={() => {}}
        onResizeRightStart={() => {}}
      />,
    );

    rerender(
      <ThreeColumnLayout
        left={<MountProbe paneId="left" onMount={onMount} onUnmount={onUnmount} />}
        main={<div data-testid="main-pane">main</div>}
        right={<MountProbe paneId="right" onMount={onMount} onUnmount={onUnmount} />}
        leftCollapsed={true}
        rightCollapsed={true}
        leftResizeLabel="Resize left"
        rightResizeLabel="Resize right"
        onResizeLeftStart={() => {}}
        onResizeRightStart={() => {}}
      />,
    );

    rerender(
      <ThreeColumnLayout
        left={<MountProbe paneId="left" onMount={onMount} onUnmount={onUnmount} />}
        main={<div data-testid="main-pane">main</div>}
        right={<MountProbe paneId="right" onMount={onMount} onUnmount={onUnmount} />}
        leftCollapsed={false}
        rightCollapsed={false}
        leftResizeLabel="Resize left"
        rightResizeLabel="Resize right"
        onResizeLeftStart={() => {}}
        onResizeRightStart={() => {}}
      />,
    );

    expect(onMount).toHaveBeenCalledTimes(2);
    expect(onMount).toHaveBeenCalledWith("left");
    expect(onMount).toHaveBeenCalledWith("right");
    expect(onUnmount).not.toHaveBeenCalled();
  });
});
