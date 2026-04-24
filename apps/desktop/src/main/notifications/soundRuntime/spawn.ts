import { spawn } from "node:child_process";

/** Runs one process command and resolves when it exits successfully. */
export async function runSoundCommand(command: string[]): Promise<void> {
  const [executable, ...args] = command;
  if (!executable) {
    throw new Error("missing sound player executable");
  }

  await new Promise<void>((resolve, reject) => {
    const processHandle = spawn(executable, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    processHandle.stderr?.setEncoding("utf8");
    processHandle.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });

    processHandle.once("error", (error) => {
      reject(error);
    });

    processHandle.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const details = stderr.trim();
      reject(
        new Error(
          details
            ? `sound command failed with exit code ${code ?? "unknown"}: ${details}`
            : `sound command failed with exit code ${code ?? "unknown"}`,
        ),
      );
    });
  });
}
