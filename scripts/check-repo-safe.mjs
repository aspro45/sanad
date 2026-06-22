import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  ".codex",
  ".agents",
  ".playwright-cli",
  "coverage",
  "dist",
  "node_modules",
  "work",
]);
const ignoredFiles = new Set([".env"]);
const allowedPlaceholders = [
  "0xYOUR_FUNDED_TEST_WALLET_PRIVATE_KEY",
  "0xYOUR_OWNER_WALLET_ADDRESS",
  "your-secret",
  "changeme",
  "placeholder",
];

const secretAssignmentPattern =
  /\b(?:PRIVATE_KEY|MNEMONIC|SEED_PHRASE|PASSWORD|SECRET|API_KEY|ACCESS_TOKEN)\b\s*=\s*([^\s#]+)/gi;
const privateKeyPattern = /\b0x[a-fA-F0-9]{64}\b/g;

const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const rel = relative(root, path).replaceAll("\\", "/");
    const stats = statSync(path);

    if (stats.isDirectory()) {
      if (!ignoredDirs.has(entry)) walk(path);
      continue;
    }

    if (ignoredFiles.has(entry) || stats.size > 1_000_000) continue;
    scanFile(path, rel);
  }
}

function scanFile(path, rel) {
  const content = readFileSync(path, "utf8");

  for (const match of content.matchAll(secretAssignmentPattern)) {
    const value = match[1].trim().replace(/^["']|["']$/g, "");
    if (!isAllowedPlaceholder(value)) {
      findings.push(`${rel}: secret-looking assignment for ${match[0].split("=")[0].trim()}`);
    }
  }

  for (const match of content.matchAll(privateKeyPattern)) {
    const value = match[0];
    if (isLikelyTransactionHash(rel, content, match.index ?? 0) || isKnownPublicHash(value)) continue;
    findings.push(`${rel}: 64-hex value found; verify it is not a private key`);
  }
}

function isAllowedPlaceholder(value) {
  const normalized = value.toLowerCase();
  return allowedPlaceholders.some((placeholder) => normalized.includes(placeholder.toLowerCase()));
}

function isLikelyTransactionHash(rel, content, index) {
  if (rel.startsWith("docs/") || rel === "README.md") return true;
  const before = content.slice(Math.max(0, index - 32), index).toLowerCase();
  return before.includes("/tx/") || before.includes("deploy tx") || before.includes("transaction");
}

function isKnownPublicHash(value) {
  return value === "0x0000000000000000000000000000000000000000000000000000000000000000";
}

if (!existsSync(join(root, ".gitignore"))) {
  findings.push(".gitignore is missing");
} else {
  const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
  if (!gitignore.includes(".env")) findings.push(".gitignore does not ignore .env");
}

walk(root);

if (findings.length) {
  console.error("Repo safety check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Repo safety check passed. No private-key style secrets found outside ignored files.");
