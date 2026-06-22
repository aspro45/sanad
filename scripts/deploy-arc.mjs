import fs from "node:fs";
import path from "node:path";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = process.cwd();
const envPath = path.join(root, ".env");
const contractPath = path.join(root, "contracts", "SanadProtocol.sol");

loadEnv(envPath);

const rpcUrl = process.env.VITE_ARC_RPC_URL || "https://rpc.testnet.arc.network";
const chainId = Number(process.env.VITE_ARC_CHAIN_ID || 5042002);
const privateKey = normalizePrivateKey(process.env.ARC_DEPLOYER_PRIVATE_KEY);
const account = privateKeyToAccount(privateKey);
const initialOwner = process.env.SANAD_INITIAL_OWNER || account.address;

const arcTestnet = defineChain({
  id: chainId,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USDC",
    symbol: "USDC",
  },
  rpcUrls: {
    default: {
      http: [rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Arcscan",
      url: "https://testnet.arcscan.app",
    },
  },
});

console.log(`Deploying SanadProtocol to ${arcTestnet.name} (${chainId})`);
console.log(`Deployer: ${account.address}`);
console.log(`Initial owner: ${initialOwner}`);

const { abi, bytecode } = compileContract(contractPath);
const walletClient = createWalletClient({
  account,
  chain: arcTestnet,
  transport: http(rpcUrl),
});
const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(rpcUrl),
});

const hash = await walletClient.deployContract({
  abi,
  bytecode,
  args: [initialOwner],
});

console.log(`Deploy tx: ${hash}`);
console.log("Waiting for confirmation...");

const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (!receipt.contractAddress) {
  throw new Error("Deployment confirmed, but no contract address was returned.");
}

console.log(`Contract address: ${receipt.contractAddress}`);
console.log(`Arcscan: https://testnet.arcscan.app/address/${receipt.contractAddress}`);
upsertEnv(envPath, {
  VITE_ARC_RPC_URL: rpcUrl,
  VITE_ARC_CHAIN_ID: String(chainId),
  VITE_SANAD_CONTRACT_ADDRESS: receipt.contractAddress,
});
console.log("Updated .env with VITE_SANAD_CONTRACT_ADDRESS.");

function compileContract(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const input = {
    language: "Solidity",
    sources: {
      "SanadProtocol.sol": {
        content: source,
      },
    },
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const diagnostics = output.errors || [];
  for (const item of diagnostics) {
    const prefix = item.severity === "error" ? "ERROR" : "WARN";
    console.log(`${prefix}: ${item.formattedMessage}`);
  }
  if (diagnostics.some((item) => item.severity === "error")) {
    throw new Error("Solidity compilation failed.");
  }

  const contract = output.contracts?.["SanadProtocol.sol"]?.SanadProtocol;
  if (!contract?.abi || !contract?.evm?.bytecode?.object) {
    throw new Error("Compiler output did not include SanadProtocol bytecode.");
  }

  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
}

function normalizePrivateKey(value) {
  if (!value) {
    throw new Error(
      "Missing ARC_DEPLOYER_PRIVATE_KEY in .env. Export a funded test wallet private key locally; do not share it in chat.",
    );
  }
  const key = value.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("ARC_DEPLOYER_PRIVATE_KEY must be a 0x-prefixed 32-byte private key.");
  }
  return key;
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function upsertEnv(filePath, values) {
  const lines = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8").split(/\r?\n/u) : [];
  const seen = new Set();
  const next = lines.map((line) => {
    const index = line.indexOf("=");
    if (index === -1) return line;
    const key = line.slice(0, index);
    if (!(key in values)) return line;
    seen.add(key);
    return `${key}=${values[key]}`;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }

  fs.writeFileSync(filePath, `${next.filter(Boolean).join("\n")}\n`);
}
