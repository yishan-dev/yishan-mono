import { randomBytes, createHmac } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { isDevMode } from "../runtime/environment";

const JWT_EXPIRY_SECONDS = 24 * 60 * 60;
const YAML_KEY = "daemon_jwt_secret";

type JwtHeader = {
  alg: string;
  typ: string;
};

type JwtPayload = {
  sub: string;
  iat: number;
  exp: number;
};

function resolveCliProfileName(): string {
  if (isDevMode()) {
    return "dev";
  }
  return process.env.YISHAN_PROFILE?.trim() || "default";
}

function resolveCredentialPath(): string {
  return resolve(homedir(), ".yishan", "profiles", resolveCliProfileName(), "credential.yaml");
}

function base64urlEncode(data: Buffer): string {
  return data.toString("base64url");
}

function generateSecret(): string {
  return randomBytes(32).toString("hex");
}

async function readYamlKey(filePath: string, key: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith("#") || trimmed === "") {
        continue;
      }
      const eqIndex = trimmed.indexOf(":");
      if (eqIndex < 0) {
        continue;
      }
      const currentKey = trimmed.slice(0, eqIndex).trimEnd();
      if (currentKey === key) {
        const value = trimmed.slice(eqIndex + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          return value.slice(1, -1);
        }
        if (value.startsWith("'") && value.endsWith("'")) {
          return value.slice(1, -1);
        }
        return value;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function writeYamlKey(filePath: string, key: string, value: string): Promise<void> {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch {
    content = "";
  }

  const lines = content.split("\n");
  let replaced = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line) {
      continue;
    }
    const trimmed = line.trimStart();
    if (trimmed.startsWith("#") || trimmed === "") {
      continue;
    }
    const eqIndex = trimmed.indexOf(":");
    if (eqIndex < 0) {
      continue;
    }
    const currentKey = trimmed.slice(0, eqIndex).trimEnd();
    if (currentKey === key) {
      lines[i] = `${key}: ${value}`;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push("");
    }
    lines.push(`${key}: ${value}`);
  }

  await writeFile(filePath, lines.join("\n"), "utf8");
}

function signJwt(secret: string): string {
  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub: "desktop",
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  };

  const headerB64 = base64urlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = createHmac("sha256", secret).update(signingInput).digest();
  const signatureB64 = base64urlEncode(signature);

  return `${signingInput}.${signatureB64}`;
}

export async function ensureDaemonJwtSecret(): Promise<string> {
  const credentialPath = resolveCredentialPath();
  let secret = await readYamlKey(credentialPath, YAML_KEY);
  if (!secret || secret.length < 16) {
    secret = generateSecret();
    await writeYamlKey(credentialPath, YAML_KEY, secret);
  }
  return secret;
}

export function createDaemonJwt(secret: string): string {
  return signJwt(secret);
}
