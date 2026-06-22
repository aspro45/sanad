export const ARC_TESTNET = {
  chainId: 5042002,
  name: "Arc Testnet",
  rpcUrl: import.meta.env.VITE_ARC_RPC_URL ?? "https://rpc.testnet.arc.network",
  explorerUrl: "https://testnet.arcscan.app",
  faucetUrl: "https://faucet.circle.com",
  tokens: {
    USDC: "0x3600000000000000000000000000000000000000",
    EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
  },
  extensions: {
    memo: "0x5294E9927c3306DcBaDb03fe70b92e01cCede505",
    multicall3From: "0x522fAf9A91c41c443c66765030741e4AaCe147D0",
  },
} as const;

export const SANAD_ABI = [
  "function setVerifier(address verifier, bool approved)",
  "function setProvider(address provider, bool approved)",
  "function requestCount() view returns (uint256)",
  "function submitRequest(address provider, address token, uint256 amount, bytes32 category, bytes32 metadataHash, bytes32 memoId, uint256 deadline) returns (uint256)",
  "function verifyRequest(uint256 requestId, bytes32 verificationHash)",
  "function rejectRequest(uint256 requestId, bytes32 reasonHash)",
  "function fundRequest(uint256 requestId, uint256 amount)",
  "function payProvider(uint256 requestId)",
  "function refundExpired(uint256 requestId)",
  "function getRequestCore(uint256 requestId) view returns (address beneficiary,address provider,address verifier,address token,uint256 requestedAmount,uint256 fundedAmount,uint256 deadline,uint8 status)",
  "function getRequestProof(uint256 requestId) view returns (uint256 createdAt,bytes32 category,bytes32 metadataHash,bytes32 verificationHash,bytes32 memoId)",
  "event RequestSubmitted(uint256 indexed requestId,address indexed beneficiary,address indexed provider)",
  "event RequestVerified(uint256 indexed requestId,address indexed verifier,bytes32 verificationHash)",
  "event RequestFunded(uint256 indexed requestId,address indexed donor,uint256 amount)",
  "event RequestPaid(uint256 indexed requestId,address indexed provider,uint256 amount)",
] as const;
