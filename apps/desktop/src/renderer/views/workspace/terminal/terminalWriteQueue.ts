import type { Terminal } from "@xterm/xterm";

const MAX_TERMINAL_LIVE_WRITE_QUEUE_BYTES = 1024 * 1024;

export type TerminalWriteChunk = string | Uint8Array;

export type TerminalWriteQueue = {
  enqueue: (chunk: TerminalWriteChunk) => void;
  dispose: () => void;
};

/** Creates one bounded frame-batched writer so small PTY chunks do not spam xterm.write. */
export function createTerminalWriteQueue(terminal: Terminal): TerminalWriteQueue {
  let pendingBytes = 0;
  let disposed = false;
  let scheduledFrameId: number | null = null;
  let writeInFlight = false;
  const chunks: TerminalWriteChunk[] = [];

  const scheduleFlush = (): void => {
    if (disposed || writeInFlight || scheduledFrameId !== null || chunks.length === 0) {
      return;
    }

    scheduledFrameId = window.requestAnimationFrame(() => {
      scheduledFrameId = null;
      flushNextBatch();
    });
  };

  const flushNextBatch = (): void => {
    if (disposed || writeInFlight || chunks.length === 0) {
      return;
    }

    const batch = takeTerminalWriteBatch(chunks);
    pendingBytes = Math.max(0, pendingBytes - getTerminalWriteChunkLength(batch));
    writeInFlight = true;
    terminal.write(batch, () => {
      writeInFlight = false;
      scheduleFlush();
    });
  };

  const enqueue = (chunk: TerminalWriteChunk): void => {
    if (disposed) {
      return;
    }

    const shouldScheduleFlush = chunks.length === 0;
    chunks.push(chunk);
    pendingBytes += getTerminalWriteChunkLength(chunk);

    while (pendingBytes > MAX_TERMINAL_LIVE_WRITE_QUEUE_BYTES && chunks.length > 1) {
      const droppedChunk = chunks.shift();
      if (!droppedChunk) {
        break;
      }
      pendingBytes = Math.max(0, pendingBytes - getTerminalWriteChunkLength(droppedChunk));
    }

    if (shouldScheduleFlush) {
      scheduleFlush();
    }
  };

  return {
    enqueue,
    dispose: () => {
      disposed = true;
      if (scheduledFrameId !== null) {
        window.cancelAnimationFrame(scheduledFrameId);
        scheduledFrameId = null;
      }
      chunks.length = 0;
      pendingBytes = 0;
    },
  };
}

/** Takes and combines one run of same-type chunks into a single xterm.write payload. */
function takeTerminalWriteBatch(chunks: TerminalWriteChunk[]): TerminalWriteChunk {
  const first = chunks.shift();
  if (!first) {
    return "";
  }

  if (typeof first === "string") {
    let output = first;
    while (typeof chunks[0] === "string") {
      output += chunks.shift() as string;
    }
    return output;
  }

  const byteChunks = [first];
  let byteLength = first.byteLength;
  while (chunks[0] instanceof Uint8Array) {
    const next = chunks.shift() as Uint8Array;
    byteChunks.push(next);
    byteLength += next.byteLength;
  }

  if (byteChunks.length === 1) {
    return first;
  }

  const output = new Uint8Array(byteLength);
  let offset = 0;
  for (const byteChunk of byteChunks) {
    output.set(byteChunk, offset);
    offset += byteChunk.byteLength;
  }
  return output;
}

/** Returns the queued write payload size in bytes for pressure control. */
function getTerminalWriteChunkLength(chunk: TerminalWriteChunk): number {
  return typeof chunk === "string" ? chunk.length : chunk.byteLength;
}
