import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  formatUnits,
  hexToString,
  http,
  isAddress,
  keccak256,
  numberToHex,
  parseAbi,
  parseUnits,
  stringToHex,
  toBytes,
  type Address,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { ARC_TESTNET, SANAD_ABI } from "./arc";

export type SanadStatus =
  | "Submitted"
  | "Verified"
  | "Funded"
  | "Paid"
  | "Rejected"
  | "Cancelled"
  | "Refunded";
export type SanadCategory = "Medical" | "Rent" | "School" | "Utilities" | "Food";
export type SanadToken = "USDC" | "EURC";

export type SanadAidRequest = {
  id: number;
  beneficiary: string;
  beneficiaryAddress: Address;
  provider: string;
  providerAddress: Address;
  verifier?: string;
  verifierAddress?: Address;
  category: SanadCategory;
  title: string;
  amount: number;
  amountRaw: bigint;
  funded: number;
  fundedRaw: bigint;
  token: SanadToken;
  tokenAddress: Address;
  deadline: string;
  deadlineSeconds: bigint;
  status: SanadStatus;
  metadataHash: Hex;
  verificationHash?: Hex;
  memoId: string;
  privateNote: string;
};

type RawRequestCore =
  | readonly [Address, Address, Address, Address, bigint, bigint, bigint, number]
  | {
      beneficiary: Address;
      provider: Address;
      verifier: Address;
      token: Address;
      requestedAmount: bigint;
      fundedAmount: bigint;
      deadline: bigint;
      status: number;
    };

type RawRequestProof =
  | readonly [bigint, Hex, Hex, Hex, Hex]
  | {
      createdAt: bigint;
      category: Hex;
      metadataHash: Hex;
      verificationHash: Hex;
      memoId: Hex;
    };

type NormalizedRequestCore = {
  beneficiary: Address;
  provider: Address;
  verifier: Address;
  token: Address;
  requestedAmount: bigint;
  fundedAmount: bigint;
  deadline: bigint;
  status: number;
};

type NormalizedRequestProof = {
  createdAt: bigint;
  category: Hex;
  metadataHash: Hex;
  verificationHash: Hex;
  memoId: Hex;
};

const zeroAddress = "0x0000000000000000000000000000000000000000" as const;
const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;
const tokenDecimals = 6;
const statusLabels: SanadStatus[] = [
  "Submitted",
  "Verified",
  "Funded",
  "Paid",
  "Rejected",
  "Cancelled",
  "Refunded",
];
const categories: SanadCategory[] = ["Medical", "Rent", "School", "Utilities", "Food"];
const tokenAddresses = ARC_TESTNET.tokens as Record<SanadToken, Address>;
const defaultSanadContractAddress = "0xbf1ec5dc0ed9ca9356a2d5531894eaefdf111a03";

export const SANAD_CONTRACT_ADDRESS = normalizeOptionalAddress(
  import.meta.env.VITE_SANAD_CONTRACT_ADDRESS ?? defaultSanadContractAddress,
);

export const sanadAbi = parseAbi(SANAD_ABI);

const erc20Abi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);

export const arcChain = defineChain({
  id: ARC_TESTNET.chainId,
  name: ARC_TESTNET.name,
  nativeCurrency: {
    decimals: tokenDecimals,
    name: "USDC",
    symbol: "USDC",
  },
  rpcUrls: {
    default: {
      http: [ARC_TESTNET.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Arcscan",
      url: ARC_TESTNET.explorerUrl,
    },
  },
});

export const publicClient = createPublicClient({
  chain: arcChain,
  transport: http(ARC_TESTNET.rpcUrl),
});

export function hasSanadContract() {
  return Boolean(SANAD_CONTRACT_ADDRESS);
}

export function tokenAddressFor(symbol: SanadToken) {
  return tokenAddresses[symbol];
}

export async function connectArcWallet() {
  const provider = getInjectedProvider();
  await ensureArcChain(provider);
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
  const account = accounts[0];
  if (!account || !isAddress(account)) {
    throw new Error("Wallet did not return a valid account.");
  }
  return account;
}

export async function loadSanadRequests(contractAddress = requireSanadAddress()) {
  const count = (await publicClient.readContract({
    address: contractAddress,
    abi: sanadAbi,
    functionName: "requestCount",
  })) as unknown as bigint;

  const requestIds = Array.from({ length: Number(count) }, (_, index) => BigInt(index + 1)).reverse();
  const requests = await Promise.all(
    requestIds.map(async (requestId) => {
      const [core, proof] = (await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: sanadAbi,
          functionName: "getRequestCore",
          args: [requestId],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: sanadAbi,
          functionName: "getRequestProof",
          args: [requestId],
        }),
      ])) as [RawRequestCore, RawRequestProof];

      return normalizeRequest(Number(requestId), core, proof);
    }),
  );

  return requests;
}

export async function submitSanadRequest({
  provider,
  token,
  amount,
  category,
  deadline,
  title,
  privateNote,
}: {
  provider: string;
  token: SanadToken;
  amount: string;
  category: SanadCategory;
  deadline: string;
  title: string;
  privateNote: string;
}) {
  const contractAddress = requireSanadAddress();
  if (!isAddress(provider)) {
    throw new Error("Provider must be a valid approved wallet address.");
  }

  const requestedAmount = parseUnits(amount, tokenDecimals);
  const deadlineSeconds = deadlineToSeconds(deadline);
  const nextRequestId = await nextSanadRequestId(contractAddress);
  const memoId = buildMemoId(category, nextRequestId);
  const evidenceSalt = randomHex(16);
  const metadataHash = metadataHashFor({
    amount,
    category,
    deadline,
    evidenceSalt,
    privateNoteDigest: metadataHashFor({ privateNote, salt: evidenceSalt }),
    provider,
    title,
    token,
  });

  const { account, walletClient } = await getWalletClient();
  const hash = await walletClient.writeContract({
    account,
    address: contractAddress,
    abi: sanadAbi,
    functionName: "submitRequest",
    args: [
      provider as Address,
      tokenAddressFor(token),
      requestedAmount,
      labelToBytes32(category),
      metadataHash,
      labelToBytes32(memoId),
      deadlineSeconds,
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, memoId, metadataHash };
}

export async function verifySanadRequest(requestId: number) {
  const verificationHash = metadataHashFor({ requestId, action: "verified", at: Date.now() });
  const { account, walletClient } = await getWalletClient();
  const hash = await walletClient.writeContract({
    account,
    address: requireSanadAddress(),
    abi: sanadAbi,
    functionName: "verifyRequest",
    args: [BigInt(requestId), verificationHash],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, verificationHash };
}

export async function rejectSanadRequest(requestId: number) {
  const reasonHash = metadataHashFor({ requestId, action: "rejected", at: Date.now() });
  const { account, walletClient } = await getWalletClient();
  const hash = await walletClient.writeContract({
    account,
    address: requireSanadAddress(),
    abi: sanadAbi,
    functionName: "rejectRequest",
    args: [BigInt(requestId), reasonHash],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash, reasonHash };
}

export async function fundSanadRequest(request: SanadAidRequest, amount: string) {
  const contractAddress = requireSanadAddress();
  const parsedAmount = parseUnits(amount, tokenDecimals);
  const { account, walletClient } = await getWalletClient();
  const approveHash = await walletClient.writeContract({
    account,
    address: request.tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [contractAddress, parsedAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const fundHash = await walletClient.writeContract({
    account,
    address: contractAddress,
    abi: sanadAbi,
    functionName: "fundRequest",
    args: [BigInt(request.id), parsedAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  return { approveHash, fundHash };
}

export async function paySanadProvider(requestId: number) {
  const { account, walletClient } = await getWalletClient();
  const hash = await walletClient.writeContract({
    account,
    address: requireSanadAddress(),
    abi: sanadAbi,
    functionName: "payProvider",
    args: [BigInt(requestId)],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return { hash };
}

export function contractExplorerUrl(address = SANAD_CONTRACT_ADDRESS) {
  return address ? `${ARC_TESTNET.explorerUrl}/address/${address}` : ARC_TESTNET.explorerUrl;
}

export function transactionExplorerUrl(hash: Hex) {
  return `${ARC_TESTNET.explorerUrl}/tx/${hash}`;
}

export function shortHash(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function normalizeOptionalAddress(value?: string) {
  return value && isAddress(value) ? (value as Address) : undefined;
}

function requireSanadAddress() {
  if (!SANAD_CONTRACT_ADDRESS) {
    throw new Error("Set VITE_SANAD_CONTRACT_ADDRESS after deploying SanadProtocol.");
  }
  return SANAD_CONTRACT_ADDRESS;
}

async function getWalletClient() {
  const provider = getInjectedProvider();
  await ensureArcChain(provider);
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as Address[];
  const account = accounts[0];
  if (!account || !isAddress(account)) {
    throw new Error("Connect a valid wallet account first.");
  }

  return {
    account,
    walletClient: createWalletClient({
      account,
      chain: arcChain,
      transport: custom(provider),
    }),
  };
}

function getInjectedProvider() {
  const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) {
    throw new Error("No injected wallet found. Install a wallet and switch it to Arc testnet.");
  }
  return provider;
}

async function ensureArcChain(provider: EIP1193Provider) {
  const chainId = numberToHex(ARC_TESTNET.chainId);
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? Number(error.code) : 0;
    if (code !== 4902) {
      throw error;
    }
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          blockExplorerUrls: [ARC_TESTNET.explorerUrl],
          chainId,
          chainName: ARC_TESTNET.name,
          nativeCurrency: {
            decimals: tokenDecimals,
            name: "USDC",
            symbol: "USDC",
          },
          rpcUrls: [ARC_TESTNET.rpcUrl],
        },
      ],
    });
  }
}

async function nextSanadRequestId(contractAddress: Address) {
  const count = (await publicClient.readContract({
    address: contractAddress,
    abi: sanadAbi,
    functionName: "requestCount",
  })) as unknown as bigint;
  return Number(count) + 1;
}

function normalizeRequest(
  id: number,
  rawCore: RawRequestCore,
  rawProof: RawRequestProof,
): SanadAidRequest {
  const core = (Array.isArray(rawCore)
    ? {
        beneficiary: rawCore[0],
        provider: rawCore[1],
        verifier: rawCore[2],
        token: rawCore[3],
        requestedAmount: rawCore[4],
        fundedAmount: rawCore[5],
        deadline: rawCore[6],
        status: rawCore[7],
      }
    : rawCore) as NormalizedRequestCore;
  const proof = (Array.isArray(rawProof)
    ? {
        createdAt: rawProof[0],
        category: rawProof[1],
        metadataHash: rawProof[2],
        verificationHash: rawProof[3],
        memoId: rawProof[4],
      }
    : rawProof) as NormalizedRequestProof;
  const category = categoryFromBytes(proof.category);
  const token = tokenFromAddress(core.token);
  const memoId = bytes32ToText(proof.memoId, `SANAD-${String(id).padStart(4, "0")}`);

  return {
    id,
    amount: Number(formatUnits(core.requestedAmount, tokenDecimals)),
    amountRaw: core.requestedAmount,
    beneficiary: shortHash(core.beneficiary),
    beneficiaryAddress: core.beneficiary,
    category,
    deadline: secondsToDate(core.deadline),
    deadlineSeconds: core.deadline,
    funded: Number(formatUnits(core.fundedAmount, tokenDecimals)),
    fundedRaw: core.fundedAmount,
    memoId,
    metadataHash: proof.metadataHash,
    privateNote: "Encrypted evidence is offchain; Arc stores only metadata and verifier hashes.",
    provider: shortHash(core.provider),
    providerAddress: core.provider,
    status: statusLabels[Number(core.status)] ?? "Submitted",
    title: `${category} request #${id}`,
    token,
    tokenAddress: core.token,
    verificationHash: proof.verificationHash === zeroHash ? undefined : proof.verificationHash,
    verifier: core.verifier === zeroAddress ? undefined : shortHash(core.verifier),
    verifierAddress: core.verifier === zeroAddress ? undefined : core.verifier,
  };
}

function tokenFromAddress(address: Address): SanadToken {
  const normalized = address.toLowerCase();
  if (normalized === tokenAddresses.EURC.toLowerCase()) return "EURC";
  return "USDC";
}

function categoryFromBytes(value: Hex): SanadCategory {
  const text = bytes32ToText(value, "Utilities").toLowerCase();
  return categories.find((category) => text.includes(category.toLowerCase())) ?? "Utilities";
}

function bytes32ToText(value: Hex, fallback: string) {
  if (!value || value === zeroHash) return fallback;
  const compact = value.replace(/(00)+$/u, "") as Hex;
  if (compact === "0x") return fallback;

  try {
    return hexToString(compact).trim() || fallback;
  } catch {
    return fallback;
  }
}

function labelToBytes32(value: string) {
  return stringToHex(value.slice(0, 31), { size: 32 }) as Hex;
}

function metadataHashFor(value: unknown) {
  return keccak256(toBytes(JSON.stringify(value))) as Hex;
}

function randomHex(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function deadlineToSeconds(deadline: string) {
  const timestamp = Date.parse(`${deadline}T23:59:59Z`);
  if (!Number.isFinite(timestamp)) {
    throw new Error("Deadline must be a valid date.");
  }
  const seconds = BigInt(Math.floor(timestamp / 1000));
  if (seconds <= BigInt(Math.floor(Date.now() / 1000))) {
    throw new Error("Deadline must be in the future.");
  }
  return seconds;
}

function secondsToDate(seconds: bigint) {
  return new Date(Number(seconds) * 1000).toISOString().slice(0, 10);
}

function buildMemoId(category: SanadCategory, requestId: number) {
  return `SANAD-${category.slice(0, 3).toUpperCase()}-${String(requestId).padStart(4, "0")}`;
}
