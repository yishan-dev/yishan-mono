import { spawn } from "node:child_process";

/** Runs one process command and resolves when it exits successfully. */
export async function runSoundCommand(command: string[]): Promise<void> {
  const [executable, ...args] = command;
  if (!executable) {
    throw new Error("missing sound player executable");
  }

  await new Promise<void>((resolve, reject) => {
    const processHandle = spawn(executable, args, {
      stdio: "ignore",
    });

    processHandle.once("error", (error) => {
      reject(error);
    });

    processHandle.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`sound command failed with exit code ${code ?? "unknown"}`));
    });
  });
}
