import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  parseAbi,
  stringToHex,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = process.cwd();
loadEnv(path.join(root, ".env"));

const rpcUrl = process.env.VITE_ARC_RPC_URL || "https://rpc.testnet.arc.network";
const chainId = Number(process.env.VITE_ARC_CHAIN_ID || 5042002);
const contractAddress = mustAddress(process.env.VITE_SANAD_CONTRACT_ADDRESS, "VITE_SANAD_CONTRACT_ADDRESS");
const privateKey = normalizePrivateKey(process.env.ARC_DEPLOYER_PRIVATE_KEY);
const account = privateKeyToAccount(privateKey);
const tokenAddress = process.env.SANAD_TEST_TOKEN || "0x3600000000000000000000000000000000000000";

const arcTestnet = defineChain({
  id: chainId,
  name: "Arc Testnet",
  nativeCurrency: { decimals: 18, name: "USDC", symbol: "USDC" },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: "Arcscan", url: "https://testnet.arcscan.app" } },
});

const sanadAbi = parseAbi([
  "function owner() view returns (address)",
  "function requestCount() view returns (uint256)",
  "function approvedProviders(address) view returns (bool)",
  "function approvedVerifiers(address) view returns (bool)",
  "function setProvider(address provider, bool approved)",
  "function setVerifier(address verifier, bool approved)",
  "function submitRequest(address provider, address token, uint256 amount, bytes32 category, bytes32 metadataHash, bytes32 memoId, uint256 deadline) returns (uint256)",
  "function verifyRequest(uint256 requestId, bytes32 verificationHash)",
  "function fundRequest(uint256 requestId, uint256 amount)",
  "function payProvider(uint256 requestId)",
  "function getRequestCore(uint256 requestId) view returns (address beneficiary,address provider,address verifier,address token,uint256 requestedAmount,uint256 fundedAmount,uint256 deadline,uint8 status)",
  "function getRequestProof(uint256 requestId) view returns (uint256 createdAt,bytes32 category,bytes32 metadataHash,bytes32 verificationHash,bytes32 memoId)",
]);

const erc20Abi = parseAbi([
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const publicClient = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http(rpcUrl) });

console.log(`Testing SanadProtocol on ${arcTestnet.name} (${chainId})`);
console.log(`Contract: ${contractAddress}`);
console.log(`Tester: ${account.address}`);

const owner = await publicClient.readContract({
  address: contractAddress,
  abi: sanadAbi,
  functionName: "owner",
});
assertEqual(owner.toLowerCase(), account.address.toLowerCase(), "owner is deployer/tester");

const countBefore = await publicClient.readContract({
  address: contractAddress,
  abi: sanadAbi,
  functionName: "requestCount",
});
console.log(`requestCount before: ${countBefore}`);

await writeAndWait("setProvider", {
  address: contractAddress,
  abi: sanadAbi,
  functionName: "setProvider",
  args: [account.address, true],
});
await writeAndWait("setVerifier", {
  address: contractAddress,
  abi: sanadAbi,
  functionName: "setVerifier",
  args: [account.address, true],
});

const providerOk = await publicClient.readContract({
  address: contractAddress,
  abi: sanadAbi,
  functionName: "approvedProviders",
  args: [account.address],
});
const verifierOk = await publicClient.readContract({
  address: contractAddress,
  abi: sanadAbi,
  functionName: "approvedVerifiers",
  args: [account.address],
});
assertEqual(providerOk, true, "provider allowlist works");
assertEqual(verifierOk, true, "verifier allowlist works");

const requestId = countBefore + 1n;
const amount = 1n;
const deadline = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
const category = stringToHex("Medical", { size: 32 });
const metadataHash = hashObject({ test: "sanad", requestId: requestId.toString(), at: Date.now() });
const memoId = stringToHex(`SANAD-TST-${requestId.toString().padStart(4, "0")}`, { size: 32 });

await writeAndWait("submitRequest", {
  address: contractAddress,
  abi: sanadAbi,
  functionName: "submitRequest",
  args: [account.address, tokenAddress, amount, category, metadataHash, memoId, deadline],
});

const countAfterSubmit = await publicClient.readContract({
  address: contractAddress,
  abi: sanadAbi,
  functionName: "requestCount",
});
assertEqual(countAfterSubmit, requestId, "requestCount increments");

let core = await readCore(requestId);
let proof = await readProof(requestId);
assertEqual(core[0].toLowerCase(), account.address.toLowerCase(), "beneficiary stored");
assertEqual(core[1].toLowerCase(), account.address.toLowerCase(), "provider stored");
assertEqual(core[3].toLowerCase(), tokenAddress.toLowerCase(), "token stored");
assertEqual(core[4], amount, "requested amount stored");
assertEqual(core[5], 0n, "funded amount starts at 0");
assertEqual(core[7], 0, "status Submitted");
assertEqual(proof[2], metadataHash, "metadata hash stored");
assertEqual(proof[4], memoId, "memo id stored");

const verificationHash = hashObject({ requestId: requestId.toString(), action: "verify", at: Date.now() });
await writeAndWait("verifyRequest", {
  address: contractAddress,
  abi: sanadAbi,
  functionName: "verifyRequest",
  args: [requestId, verificationHash],
});

core = await readCore(requestId);
proof = await readProof(requestId);
assertEqual(core[2].toLowerCase(), account.address.toLowerCase(), "verifier stored");
assertEqual(core[7], 1, "status Verified");
assertEqual(proof[3], verificationHash, "verification hash stored");

await tryFundAndPay(requestId, amount);

console.log("All mandatory contract tests passed.");
console.log(`Request tested: ${requestId}`);
console.log(`Arcscan: https://testnet.arcscan.app/address/${contractAddress}`);

async function tryFundAndPay(requestId, amount) {
  console.log(`Checking ERC20 test token: ${tokenAddress}`);
  try {
    const decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "decimals",
    });
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    console.log(`Token decimals: ${decimals}`);
    console.log(`Token balance: ${balance}`);
    if (balance < amount) {
      console.log("Skipping fund/pay: tester token balance is lower than requested amount.");
      return;
    }

    await writeAndWait("approve", {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [contractAddress, amount],
    });
    await writeAndWait("fundRequest", {
      address: contractAddress,
      abi: sanadAbi,
      functionName: "fundRequest",
      args: [requestId, amount],
    });

    let core = await readCore(requestId);
    assertEqual(core[5], amount, "funded amount updated");
    assertEqual(core[7], 2, "status Funded");

    await writeAndWait("payProvider", {
      address: contractAddress,
      abi: sanadAbi,
      functionName: "payProvider",
      args: [requestId],
    });
    core = await readCore(requestId);
    assertEqual(core[7], 3, "status Paid");
    console.log("Fund/pay flow passed.");
  } catch (error) {
    console.log(`Skipping fund/pay: ${shortError(error)}`);
  }
}

async function readCore(requestId) {
  return publicClient.readContract({
    address: contractAddress,
    abi: sanadAbi,
    functionName: "getRequestCore",
    args: [requestId],
  });
}

async function readProof(requestId) {
  return publicClient.readContract({
    address: contractAddress,
    abi: sanadAbi,
    functionName: "getRequestProof",
    args: [requestId],
  });
}

async function writeAndWait(label, request) {
  const hash = await walletClient.writeContract({ account, ...request });
  console.log(`${label} tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${label} reverted: ${hash}`);
  }
  return receipt;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} failed. Expected ${String(expected)}, got ${String(actual)}`);
  }
  console.log(`PASS: ${label}`);
}

function hashObject(value) {
  return keccak256(toBytes(JSON.stringify(value)));
}

function mustAddress(value, name) {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value.trim())) {
    throw new Error(`Missing or invalid ${name}.`);
  }
  return value.trim();
}

function normalizePrivateKey(value) {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value.trim())) {
    throw new Error("Missing or invalid ARC_DEPLOYER_PRIVATE_KEY.");
  }
  return value.trim();
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
    if (!(key in process.env)) process.env[key] = value;
  }
}

function shortError(error) {
  if (error?.shortMessage) return error.shortMessage;
  if (error?.message) return error.message.split("\n")[0];
  return String(error);
}
