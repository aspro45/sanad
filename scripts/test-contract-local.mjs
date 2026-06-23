import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import solc from "solc";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  keccak256,
  stringToHex,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const chainId = 1337;
const rpcPort = 18545;
const rpcUrl = `http://127.0.0.1:${rpcPort}`;
const privateKeys = Array.from({ length: 8 }, (_, index) => {
  const value = (index + 1).toString(16).padStart(64, "0");
  return `0x${value}`;
});

const protocolSource = fs.readFileSync("contracts/SanadProtocol.sol", "utf8");
const mockTokenSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockToken {
    string public name = "Mock USDC";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        require(allowed >= amount, "allowance");
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}`;

const { protocol, token } = compileContracts(protocolSource, mockTokenSource);
const ganache = startGanache();

let publicClient;
let protocolAddress;
let tokenAddress;

try {
  await waitForRpc();
  await runTests();
} finally {
  stopGanache(ganache);
}

async function runTests() {
  const localChain = defineChain({
    id: chainId,
    name: "Local Sanad VM",
    nativeCurrency: { decimals: 18, name: "Ether", symbol: "ETH" },
    rpcUrls: { default: { http: [rpcUrl] } },
  });
  const transport = http(rpcUrl);
  publicClient = createPublicClient({ chain: localChain, transport });
  const accounts = privateKeys.map((privateKey) => privateKeyToAccount(privateKey));
  const clients = accounts.map((account) => createWalletClient({ account, chain: localChain, transport }));

  const [owner, verifier, providerAccount, donorA, donorB, beneficiary, outsider, badProvider] = accounts;
  const [ownerClient, verifierClient, providerClient, donorAClient, donorBClient, beneficiaryClient, outsiderClient] =
    clients;
  void providerClient;

  protocolAddress = await deploy(ownerClient, "SanadProtocol", protocol.abi, protocol.bytecode, [owner.address]);
  tokenAddress = await deploy(ownerClient, "MockToken", token.abi, token.bytecode, []);
  console.log(`Local protocol: ${protocolAddress}`);
  console.log(`Local token: ${tokenAddress}`);

  await write("mint donor A", ownerClient, tokenAddress, token.abi, "mint", [donorA.address, 1000n]);
  await write("mint donor B", ownerClient, tokenAddress, token.abi, "mint", [donorB.address, 1000n]);

  await expectRevert("non-owner cannot approve provider", () =>
    write("bad setProvider", outsiderClient, protocolAddress, protocol.abi, "setProvider", [
      providerAccount.address,
      true,
    ]),
  );
  await write("approve provider", ownerClient, protocolAddress, protocol.abi, "setProvider", [
    providerAccount.address,
    true,
  ]);
  await write("approve verifier", ownerClient, protocolAddress, protocol.abi, "setVerifier", [verifier.address, true]);
  assertEq(
    await read(protocolAddress, protocol.abi, "approvedProviders", [providerAccount.address]),
    true,
    "provider allowlist",
  );
  assertEq(
    await read(protocolAddress, protocol.abi, "approvedVerifiers", [verifier.address]),
    true,
    "verifier allowlist",
  );

  const amount = 100n;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const category = stringToHex("Medical", { size: 32 });
  const metadataHash = hash("metadata-1");
  const memoId = stringToHex("SANAD-LOCAL-0001", { size: 32 });

  await expectRevert("unapproved provider rejected", () =>
    write("bad submit", beneficiaryClient, protocolAddress, protocol.abi, "submitRequest", [
      badProvider.address,
      tokenAddress,
      amount,
      category,
      metadataHash,
      memoId,
      deadline,
    ]),
  );

  const requestId = await submitRequest(
    beneficiaryClient,
    providerAccount.address,
    tokenAddress,
    amount,
    deadline,
    "0001",
  );
  let core = await getCore(requestId);
  assertEq(core[0].toLowerCase(), beneficiary.address.toLowerCase(), "beneficiary stored");
  assertEq(core[1].toLowerCase(), providerAccount.address.toLowerCase(), "provider stored");
  assertEq(core[7], 0, "new request is Submitted");

  await expectRevert("non-verifier cannot verify", () =>
    write("bad verify", outsiderClient, protocolAddress, protocol.abi, "verifyRequest", [requestId, hash("bad")]),
  );
  await write("verify request", verifierClient, protocolAddress, protocol.abi, "verifyRequest", [
    requestId,
    hash("verified-1"),
  ]);
  core = await getCore(requestId);
  assertEq(core[2].toLowerCase(), verifier.address.toLowerCase(), "verifier stored");
  assertEq(core[7], 1, "verified status");

  await write("donor A approve", donorAClient, tokenAddress, token.abi, "approve", [protocolAddress, 40n]);
  await write("donor A fund partial", donorAClient, protocolAddress, protocol.abi, "fundRequest", [requestId, 40n]);
  core = await getCore(requestId);
  assertEq(core[5], 40n, "partial funding stored");
  assertEq(core[7], 1, "partial funding stays Verified");

  await write("donor B approve", donorBClient, tokenAddress, token.abi, "approve", [protocolAddress, 100n]);
  await expectRevert("overfund rejected", () =>
    write("overfund", donorBClient, protocolAddress, protocol.abi, "fundRequest", [requestId, 70n]),
  );
  await write("donor B fund remaining", donorBClient, protocolAddress, protocol.abi, "fundRequest", [requestId, 60n]);
  core = await getCore(requestId);
  assertEq(core[5], 100n, "full funding stored");
  assertEq(core[7], 2, "full funding becomes Funded");

  await expectRevert("outsider cannot pay provider", () =>
    write("bad pay", outsiderClient, protocolAddress, protocol.abi, "payProvider", [requestId]),
  );

  await rpc("evm_increaseTime", [3700]);
  await rpc("evm_mine", []);

  await write("donor A refund expired", donorAClient, protocolAddress, protocol.abi, "refundExpired", [requestId]);
  core = await getCore(requestId);
  assertEq(core[5], 60n, "refund subtracts contribution");
  assertEq(core[7], 1, "partial refund resets status to Verified");
  await expectRevert("partial-refunded request cannot pay provider", () =>
    write("pay after partial refund", beneficiaryClient, protocolAddress, protocol.abi, "payProvider", [requestId]),
  );

  await write("donor B refund expired", donorBClient, protocolAddress, protocol.abi, "refundExpired", [requestId]);
  core = await getCore(requestId);
  assertEq(core[5], 0n, "all refunds clear funded amount");
  assertEq(core[7], 6, "all refunds become Refunded");

  const payRequestId = await submitRequest(
    beneficiaryClient,
    providerAccount.address,
    tokenAddress,
    75n,
    BigInt(Math.floor(Date.now() / 1000) + 7200),
    "0002",
  );
  await write("verify pay request", verifierClient, protocolAddress, protocol.abi, "verifyRequest", [
    payRequestId,
    hash("verified-2"),
  ]);
  await write("donor A approve pay", donorAClient, tokenAddress, token.abi, "approve", [protocolAddress, 75n]);
  const providerBalanceBefore = await read(tokenAddress, token.abi, "balanceOf", [providerAccount.address]);
  await write("donor A fund pay", donorAClient, protocolAddress, protocol.abi, "fundRequest", [payRequestId, 75n]);
  await write("verifier pays provider", verifierClient, protocolAddress, protocol.abi, "payProvider", [payRequestId]);
  core = await getCore(payRequestId);
  const providerBalanceAfter = await read(tokenAddress, token.abi, "balanceOf", [providerAccount.address]);
  assertEq(core[7], 3, "paid status");
  assertEq(providerBalanceAfter - providerBalanceBefore, 75n, "provider receives payout");

  const cancelRequestId = await submitRequest(
    beneficiaryClient,
    providerAccount.address,
    tokenAddress,
    20n,
    BigInt(Math.floor(Date.now() / 1000) + 7200),
    "0003",
  );
  await write("beneficiary cancels submitted request", beneficiaryClient, protocolAddress, protocol.abi, "cancelRequest", [
    cancelRequestId,
  ]);
  core = await getCore(cancelRequestId);
  assertEq(core[7], 5, "cancelled status");
  await expectRevert("cancelled request cannot be verified", () =>
    write("verify cancelled", verifierClient, protocolAddress, protocol.abi, "verifyRequest", [
      cancelRequestId,
      hash("bad"),
    ]),
  );

  const rejectRequestId = await submitRequest(
    beneficiaryClient,
    providerAccount.address,
    tokenAddress,
    25n,
    BigInt(Math.floor(Date.now() / 1000) + 7200),
    "0004",
  );
  await write("verifier rejects request", verifierClient, protocolAddress, protocol.abi, "rejectRequest", [
    rejectRequestId,
    hash("reason"),
  ]);
  core = await getCore(rejectRequestId);
  assertEq(core[7], 4, "rejected status");
  await write("donor B approve rejected", donorBClient, tokenAddress, token.abi, "approve", [protocolAddress, 25n]);
  await expectRevert("rejected request cannot be funded", () =>
    write("fund rejected", donorBClient, protocolAddress, protocol.abi, "fundRequest", [rejectRequestId, 25n]),
  );

  console.log("All local SanadProtocol runtime tests passed.");
}

function startGanache() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const ganacheAccounts = privateKeys.flatMap((privateKey) => [
    "--wallet.accounts",
    `${privateKey},1000000000000000000000`,
  ]);
  const child = spawn(
    npx,
    [
      "--yes",
      "ganache@7.9.2",
      "--quiet",
      "--chain.chainId",
      String(chainId),
      ...ganacheAccounts,
      "--server.host",
      "127.0.0.1",
      "--server.port",
      String(rpcPort),
    ],
    { shell: process.platform === "win32", stdio: ["ignore", "pipe", "pipe"] },
  );
  child.stderrText = "";
  child.stderr.on("data", (chunk) => {
    child.stderrText += String(chunk);
  });
  child.stdout.on("data", () => {});
  return child;
}

function stopGanache(child) {
  if (child.exitCode !== null || !child.pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill();
}

async function waitForRpc() {
  for (let index = 0; index < 90; index += 1) {
    try {
      await rpc("eth_chainId", []);
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`Ganache did not start on ${rpcUrl}.\n${ganache.stderrText || ""}`);
}

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`${method}: ${payload.error.message}`);
  return payload.result;
}

async function submitRequest(client, provider, tokenAddress, amount, deadline, suffix) {
  const nextId = (await read(protocolAddress, protocol.abi, "requestCount", [])) + 1n;
  await write(`submit request ${suffix}`, client, protocolAddress, protocol.abi, "submitRequest", [
    provider,
    tokenAddress,
    amount,
    stringToHex("Medical", { size: 32 }),
    hash(`metadata-${suffix}`),
    stringToHex(`SANAD-LOCAL-${suffix}`, { size: 32 }),
    deadline,
  ]);
  assertEq(await read(protocolAddress, protocol.abi, "requestCount", []), nextId, `requestCount increments ${suffix}`);
  return nextId;
}

async function getCore(requestId) {
  return read(protocolAddress, protocol.abi, "getRequestCore", [requestId]);
}

async function deploy(client, label, abi, bytecode, args) {
  const hash = await client.deployContract({ abi, bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success" || !receipt.contractAddress) {
    throw new Error(`${label} deployment failed`);
  }
  console.log(`PASS: deploy ${label}`);
  return receipt.contractAddress;
}

async function read(address, abi, functionName, args) {
  return publicClient.readContract({ address, abi, functionName, args });
}

async function write(label, client, address, abi, functionName, args) {
  const hash = await client.writeContract({ address, abi, functionName, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`${label} reverted`);
  }
  console.log(`PASS: ${label}`);
  return receipt;
}

async function expectRevert(label, action) {
  try {
    await action();
  } catch {
    console.log(`PASS: ${label}`);
    return;
  }
  throw new Error(`${label} did not revert`);
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} failed. Expected ${String(expected)}, got ${String(actual)}`);
  }
  console.log(`PASS: ${label}`);
}

function hash(value) {
  return keccak256(toBytes(value));
}

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function compileContracts(sanadSource, mockSource) {
  const input = {
    language: "Solidity",
    sources: {
      "SanadProtocol.sol": { content: sanadSource },
      "MockToken.sol": { content: mockSource },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  for (const item of output.errors || []) {
    const prefix = item.severity === "error" ? "ERROR" : "WARN";
    console.log(`${prefix}: ${item.formattedMessage}`);
  }
  if ((output.errors || []).some((item) => item.severity === "error")) {
    throw new Error("Solidity compilation failed");
  }
  const sanad = output.contracts?.["SanadProtocol.sol"]?.SanadProtocol;
  const mock = output.contracts?.["MockToken.sol"]?.MockToken;
  if (!sanad?.abi || !sanad?.evm?.bytecode?.object || !mock?.abi || !mock?.evm?.bytecode?.object) {
    throw new Error("Missing compiler output");
  }
  return {
    protocol: { abi: sanad.abi, bytecode: `0x${sanad.evm.bytecode.object}` },
    token: { abi: mock.abi, bytecode: `0x${mock.evm.bytecode.object}` },
  };
}
