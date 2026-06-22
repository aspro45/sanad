import { Canvas, useFrame } from "@react-three/fiber";
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  Copy,
  FileText,
  Gauge,
  Globe2,
  HeartPulse,
  Landmark,
  Link as LinkIcon,
  LockKeyhole,
  Network,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Wallet,
} from "lucide-react";
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ARC_TESTNET } from "./arc";
import {
  SANAD_CONTRACT_ADDRESS,
  connectArcWallet,
  contractExplorerUrl,
  fundSanadRequest,
  loadSanadRequests,
  paySanadProvider,
  rejectSanadRequest,
  submitSanadRequest,
  verifySanadRequest,
  type SanadAidRequest as AidRequest,
  type SanadCategory as Category,
  type SanadStatus as Status,
  type SanadToken,
} from "./sanadContract";

type Role = "beneficiary" | "verifier" | "donor" | "provider";

type EventLog = {
  id: number;
  label: string;
  detail: string;
  time: string;
};

type StoryStep = {
  id: string;
  label: string;
  role: Role;
  requestId: number;
  title: string;
  detail: string;
  proof: string;
};

const roleCopy: Record<Role, { label: string; blurb: string }> = {
  beneficiary: {
    label: "Beneficiary",
    blurb: "Submit a private essential bill with encrypted evidence.",
  },
  verifier: {
    label: "Verifier",
    blurb: "Approve requests with offchain checks and onchain hashes.",
  },
  donor: {
    label: "Donor",
    blurb: "Fund verified bills and receive proof without exposing people.",
  },
  provider: {
    label: "Provider",
    blurb: "Claim direct settlement once the escrow is fully funded.",
  },
};

const arcStack = [
  {
    icon: <CircleDollarSign size={19} />,
    title: "USDC-native settlement",
    text: "Stablecoin-denominated gas and escrow make aid operations budgetable.",
    href: "https://docs.arc.io/arc/references/gas-and-fees",
  },
  {
    icon: <TimerReset size={19} />,
    title: "Under-second finality",
    text: "Provider payout can be reconciled immediately after settlement.",
    href: "https://www.arc.io/",
  },
  {
    icon: <LockKeyhole size={19} />,
    title: "Privacy-ready rails",
    text: "Today: hashes and encrypted evidence. Later: confidential ArcaneVM state.",
    href: "https://docs.arc.io/arc/concepts/opt-in-privacy",
  },
  {
    icon: <Boxes size={19} />,
    title: "App Kits path",
    text: "Bridge, send, swap, and unified balance flows map directly to SANAD operations.",
    href: "https://www.arc.io/app-kits",
  },
];

const links = [
  ["Arc docs", "https://docs.arc.io/"],
  ["Circle faucet", "https://faucet.circle.com/"],
  ["Arcscan testnet", "https://testnet.arcscan.app/"],
  ["App Kits", "https://www.arc.io/app-kits"],
  ["Ecosystem", "https://www.arc.io/ecosystem"],
  ["Litepaper", "https://www.arc.io/litepaper"],
  ["Privacy whitepaper", "https://6778953.fs1.hubspotusercontent-na1.net/hubfs/6778953/PDFs/Whitepapers/Arc_Privacy_Sector%20(5).pdf"],
  ["Post-quantum paper", "https://www.arc.io/post-quantum-whitepaper"],
];

const storySteps: StoryStep[] = [
  {
    id: "intake",
    label: "01 Intake",
    role: "beneficiary",
    requestId: 0,
    title: "Private bill object created",
    detail: "A beneficiary submits an encrypted bill bundle with a public metadata hash.",
    proof: "Arc memo links the request intent without exposing the family identity or invoice image.",
  },
  {
    id: "verify",
    label: "02 Verify",
    role: "verifier",
    requestId: 0,
    title: "Verifier desk opened",
    detail: "The verifier checks offchain evidence and prepares a verification hash for donors.",
    proof: "Only the reviewer, verdict hash, memo ID, and request state become public.",
  },
  {
    id: "fund",
    label: "03 Fund",
    role: "donor",
    requestId: 0,
    title: "Donor routes stablecoin escrow",
    detail: "A donor routes USDC or EURC into the request escrow.",
    proof: "USDC movement is auditable while the beneficiary story stays shielded.",
  },
  {
    id: "settle",
    label: "04 Settle",
    role: "provider",
    requestId: 0,
    title: "Provider payout ready",
    detail: "The approved provider can claim settlement after request conditions are met.",
    proof: "The payout event reconciles clinic, token, amount, and memo for Arcscan review.",
  },
];

const arcRuntimeRefs = [
  {
    code: "REF-01",
    title: "Predictable stablecoin fees",
    text: "SANAD can quote aid operations in the same unit donors fund with, avoiding surprise gas drift.",
    href: "https://docs.arc.io/arc/references/gas-and-fees",
  },
  {
    code: "REF-02",
    title: "Deterministic settlement ledger",
    text: "Every request moves through submitted, verified, funded, and paid states with explicit events.",
    href: "https://testnet.arcscan.app/",
  },
  {
    code: "REF-03",
    title: "Optional privacy path",
    text: "The MVP keeps evidence encrypted offchain today and leaves a clean path to Arc privacy primitives.",
    href: "https://docs.arc.io/arc/concepts/opt-in-privacy",
  },
];

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function nowLabel() {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown contract error.";
}

export default function App() {
  const [role, setRole] = useState<Role>("beneficiary");
  const [requests, setRequests] = useState<AidRequest[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [wallet, setWallet] = useState("");
  const [fundAmount, setFundAmount] = useState("25");
  const [copied, setCopied] = useState("");
  const [storyIndex, setStoryIndex] = useState(0);
  const [showPrivate, setShowPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [contractMessage, setContractMessage] = useState(
    SANAD_CONTRACT_ADDRESS
      ? "Reading SanadProtocol on Arc testnet."
      : "Deploy SanadProtocol and set VITE_SANAD_CONTRACT_ADDRESS.",
  );
  const [events, setEvents] = useState<EventLog[]>([
    {
      id: 1,
      label: SANAD_CONTRACT_ADDRESS ? "Contract mode" : "Contract missing",
      detail: SANAD_CONTRACT_ADDRESS
        ? `SANAD is connected to ${shortAddress(SANAD_CONTRACT_ADDRESS)}.`
        : "No onchain request is loaded. Add a deployed contract address to read Arc state.",
      time: nowLabel(),
    },
  ]);

  const selected = requests.find((request) => request.id === selectedId) ?? requests[0] ?? null;
  const activeStory = storySteps[storyIndex] ?? storySteps[0];
  const contractReady = Boolean(SANAD_CONTRACT_ADDRESS);
  const sanadContractAddress = SANAD_CONTRACT_ADDRESS ?? "not configured";

  const pushEvent = useCallback((label: string, detail: string) => {
    setEvents((current) => [
      { id: Date.now(), label, detail, time: nowLabel() },
      ...current.slice(0, 8),
    ]);
  }, []);

  const refreshRequests = useCallback(
    async (announce = false) => {
      if (!SANAD_CONTRACT_ADDRESS) {
        setRequests([]);
        setSelectedId(0);
        setContractMessage("Deploy SanadProtocol and set VITE_SANAD_CONTRACT_ADDRESS.");
        return;
      }

      setIsLoading(true);
      try {
        const nextRequests = await loadSanadRequests(SANAD_CONTRACT_ADDRESS);
        setRequests(nextRequests);
        setSelectedId((current) =>
          nextRequests.some((request) => request.id === current)
            ? current
            : (nextRequests[0]?.id ?? 0),
        );
        setContractMessage(
          nextRequests.length
            ? `${nextRequests.length} onchain request${nextRequests.length === 1 ? "" : "s"} loaded from SanadProtocol.`
            : "Contract connected. No onchain requests yet.",
        );
        if (announce) {
          pushEvent("Arc read synced", "Latest SanadProtocol state loaded from Arc testnet.");
        }
      } catch (error) {
        setRequests([]);
        setSelectedId(0);
        setContractMessage(errorMessage(error));
        pushEvent("Contract read failed", errorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [pushEvent],
  );

  useEffect(() => {
    void refreshRequests();
  }, [refreshRequests]);

  const metrics = useMemo(() => {
    const totalRequested = requests.reduce((sum, request) => sum + request.amount, 0);
    const totalFunded = requests.reduce((sum, request) => sum + request.funded, 0);
    const verified = requests.filter(
      (request) => request.status === "Verified" || request.status === "Funded",
    ).length;
    const privacyScore = requests.length ? Math.round((verified / requests.length) * 100) : 0;
    return { totalRequested, totalFunded, verified, privacyScore };
  }, [requests]);

  const proofBundle = useMemo(
    () =>
      JSON.stringify(
        {
          network: ARC_TESTNET.name,
          chainId: ARC_TESTNET.chainId,
          sanadContract: sanadContractAddress,
          arcMemoContract: ARC_TESTNET.extensions.memo,
          requestId: selected?.id ?? null,
          memoId: selected?.memoId ?? null,
          status: selected?.status ?? "empty",
          token: selected?.token ?? null,
          amount: selected?.amount ?? null,
          metadataHash: selected?.metadataHash ?? null,
          verificationHash: selected?.verificationHash ?? "pending",
          provider: selected?.providerAddress ?? null,
        },
        null,
        2,
      ),
    [sanadContractAddress, selected],
  );

  async function connectWallet() {
    try {
      const account = await connectArcWallet();
      setWallet(account);
      pushEvent("Wallet connected", `${shortAddress(account)} connected to ${ARC_TESTNET.name}.`);
    } catch (error) {
      pushEvent("Wallet connection failed", errorMessage(error));
    }
  }

  async function addRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contractReady) {
      pushEvent("Contract missing", "Set VITE_SANAD_CONTRACT_ADDRESS before submitting requests.");
      return;
    }
    if (!wallet) {
      pushEvent("Wallet required", "Connect a wallet before sending an Arc transaction.");
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const category = String(form.get("category")) as Category;
    const title = String(form.get("title"));
    const amount = String(form.get("amount"));
    const provider = String(form.get("provider"));
    const deadline = String(form.get("deadline"));
    const token = String(form.get("token")) as SanadToken;
    const privateNote = String(form.get("privateNote"));

    setIsBusy(true);
    try {
      const result = await submitSanadRequest({
        amount,
        category,
        deadline,
        privateNote,
        provider,
        title,
        token,
      });
      pushEvent("Request tx confirmed", `${result.memoId} saved on Arc: ${shortAddress(result.hash)}.`);
      await refreshRequests();
      formElement.reset();
    } catch (error) {
      pushEvent("Request failed", errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function verifySelected() {
    if (!selected) return;
    setIsBusy(true);
    try {
      const result = await verifySanadRequest(selected.id);
      pushEvent("Request verified", `${selected.memoId} confirmed: ${shortAddress(result.hash)}.`);
      await refreshRequests();
    } catch (error) {
      pushEvent("Verify failed", errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function rejectSelected() {
    if (!selected) return;
    setIsBusy(true);
    try {
      const result = await rejectSanadRequest(selected.id);
      pushEvent("Request rejected", `${selected.memoId} rejected onchain: ${shortAddress(result.hash)}.`);
      await refreshRequests();
    } catch (error) {
      pushEvent("Reject failed", errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function fundSelected() {
    if (!selected) return;
    const value = Number(fundAmount);
    if (!value || value <= 0) return;
    setIsBusy(true);
    try {
      const result = await fundSanadRequest(selected, fundAmount);
      pushEvent(
        "Escrow funded",
        `${fundAmount} ${selected.token} approved and funded: ${shortAddress(result.fundHash)}.`,
      );
      await refreshRequests();
    } catch (error) {
      pushEvent("Funding failed", errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function paySelected() {
    if (!selected) return;
    setIsBusy(true);
    try {
      const result = await paySanadProvider(selected.id);
      pushEvent("Provider paid", `${selected.provider} payout confirmed: ${shortAddress(result.hash)}.`);
      await refreshRequests();
    } catch (error) {
      pushEvent("Payout failed", errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  function activateStoryStep(index: number) {
    const step = storySteps[index];
    if (!step) return;
    setStoryIndex(index);
    setRole(step.role);
    if (requests.some((request) => request.id === step.requestId)) {
      setSelectedId(step.requestId);
    }
    pushEvent(step.title, step.detail);
  }

  function runSimulation() {
    activateStoryStep((storyIndex + 1) % storySteps.length);
  }

  async function copyText(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1600);
  }

  const submitCall = selected
    ? `getRequest(${selected.id}) => provider ${selected.providerAddress}, amount ${selected.amountRaw.toString()}, memo ${selected.memoId}`
    : "submitRequest(provider, token, amount, category, metadataHash, memoId, deadline)";
  const liveStatusCards = useMemo(
    () => [
      {
        label: "Network",
        value: ARC_TESTNET.name,
        detail: `Chain ${ARC_TESTNET.chainId}`,
      },
      {
        label: "Contract",
        value: SANAD_CONTRACT_ADDRESS ? shortAddress(SANAD_CONTRACT_ADDRESS) : "Missing",
        detail: SANAD_CONTRACT_ADDRESS ? "Live SanadProtocol" : "Set VITE_SANAD_CONTRACT_ADDRESS",
      },
      {
        label: "Onchain requests",
        value: isLoading ? "Syncing" : String(requests.length),
        detail: "Read from contract",
      },
      {
        label: "Active state",
        value: selected?.status ?? "Empty",
        detail: selected?.memoId ?? "No request selected",
      },
    ],
    [isLoading, requests.length, selected],
  );
  const actionPlan = useMemo(
    () => [
      {
        label: "Wallet",
        value: wallet ? shortAddress(wallet) : "Connect",
        state: wallet ? "Ready" : "Needed",
      },
      {
        label: "Request",
        value: selected?.memoId ?? "Create",
        state: selected ? selected.status : "Needed",
      },
      {
        label: "Role",
        value: roleCopy[role].label,
        state: "Active",
      },
      {
        label: "Next",
        value: nextActionLabel({ contractReady, selected, wallet }),
        state: nextActionState({ contractReady, isBusy, isLoading, selected, wallet }),
      },
    ],
    [contractReady, isBusy, isLoading, role, selected, wallet],
  );

  return (
    <div className="site-shell">
      <header className="site-nav">
        <a className="brand-link" href="#top" aria-label="SANAD home">
          <span className="brand-glyph">
            <HeartPulse size={22} aria-hidden="true" />
          </span>
          <span>SANAD</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#protocol">Protocol</a>
          <a href="#arc-stack">Arc stack</a>
          <a href="#proof">Proof</a>
          <a href="#console">Console</a>
          <a href="#links">Links</a>
        </nav>
        <button className="wallet-button" onClick={connectWallet} type="button">
          <Wallet size={17} aria-hidden="true" />
          {wallet ? shortAddress(wallet) : "Connect"}
        </button>
      </header>

      <main id="top">
        <section className="hero-section" aria-label="SANAD Arc-native aid protocol">
          <div className="scene-layer" aria-hidden="true">
            <SettlementScene />
          </div>
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Arc-native verified aid rail</p>
              <h1>Private aid payments.</h1>
              <p className="hero-lede">
                SANAD turns urgent medical, rent, school, and utility bills into verified
                stablecoin settlement flows: encrypted evidence in, provider payout out,
                dignity preserved.
              </p>
              <div className="hero-proof-strip" aria-label="SANAD live guarantees">
                <span>Onchain requests</span>
                <span>Provider payout</span>
                <span>Private evidence</span>
              </div>
              <div className="hero-actions">
                <button className="primary-action" onClick={runSimulation} type="button">
                  <Sparkles size={18} aria-hidden="true" />
                  Run aid flow
                </button>
                <a className="secondary-link" href="https://docs.arc.io/" target="_blank" rel="noreferrer">
                  Arc docs
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
              <StoryRail
                activeIndex={storyIndex}
                onStepSelect={activateStoryStep}
                steps={storySteps}
              />
            </div>

            <MissionConsole
              activeStory={activeStory}
              copied={copied}
              copyText={copyText}
              contractMessage={contractMessage}
              contractReady={contractReady}
              events={events}
              fundAmount={fundAmount}
              fundSelected={fundSelected}
              isBusy={isBusy}
              isLoading={isLoading}
              paySelected={paySelected}
              rejectSelected={rejectSelected}
              requests={requests}
              role={role}
              selected={selected}
              selectedId={selectedId}
              setFundAmount={setFundAmount}
              setRole={setRole}
              setSelectedId={setSelectedId}
              proofBundle={proofBundle}
              submitCall={submitCall}
              verifySelected={verifySelected}
            />
          </div>
        </section>

        <section className="ticker-band" aria-label="Live protocol state">
          {liveStatusCards.map((stat) => (
            <div className="ticker-item" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </div>
          ))}
        </section>

        <section className="section-grid" id="protocol">
          <div className="section-kicker">
            <p className="eyebrow">Protocol thesis</p>
            <h2>Not charity. Verified settlement for real human obligations.</h2>
          </div>
          <div className="thesis-grid">
            <FeatureCard
              icon={<FileText size={20} />}
              title="Private request intake"
              text="Beneficiaries submit encrypted invoice bundles while the chain sees only a canonical hash and memo ID."
            />
            <FeatureCard
              icon={<BadgeCheck size={20} />}
              title="Verifier reputation"
              text="Human operators and approved agents check evidence, emit verification hashes, and build accountable history."
            />
            <FeatureCard
              icon={<Banknote size={20} />}
              title="Donor-safe escrow"
              text="USDC or EURC funds are locked to the exact request and released only to the allowlisted provider."
            />
            <FeatureCard
              icon={<Landmark size={20} />}
              title="Direct provider payout"
              text="Clinics, pharmacies, schools, landlords, and utilities receive settlement without public exposure of the beneficiary."
            />
          </div>
        </section>

        <section className="flow-section">
          <div className="flow-copy">
            <p className="eyebrow">How money moves</p>
            <h2>One request becomes a private, auditable payment object.</h2>
            <p>
              Arc gives SANAD the financial substrate: predictable USDC fees, deterministic
              settlement, transaction memos, and App Kits for bridging and balances. SANAD adds
              policy: who can verify, who can receive, and what proof must exist before value moves.
            </p>
          </div>
          <div className="rail-map">
            {["Encrypted bill", "Verifier hash", "USDC escrow", "Provider paid"].map((step, index) => (
              <div className="rail-step" key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="section-grid arc-stack-section" id="arc-stack">
          <div className="section-kicker">
            <p className="eyebrow">Arc-native stack</p>
            <h2>Built around the exact infrastructure Arc was made for.</h2>
          </div>
          <div className="stack-grid">
            {arcStack.map((item) => (
              <a className="stack-card" href={item.href} key={item.title} target="_blank" rel="noreferrer">
                <div className="stack-icon">{item.icon}</div>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
                <span>
                  Open source
                  <ArrowUpRight size={14} aria-hidden="true" />
                </span>
              </a>
            ))}
          </div>
        </section>

        <RuntimeProofSection />

        <section className="console-section" id="console">
          <div className="console-copy">
            <p className="eyebrow">Operator console</p>
            <h2>Functional aid desk, not a static pitch deck.</h2>
            <p>
              Create requests, approve evidence, fund escrow, and pay providers through
              SanadProtocol. The console reads onchain state and only sends real Arc transactions.
            </p>
          </div>
          <ActionPlan items={actionPlan} />
          <div className="operator-grid">
            <RequestBuilder
              addRequest={addRequest}
              contractReady={contractReady}
              isBusy={isBusy}
              wallet={wallet}
            />
            <div className="insight-stack">
              <AuditPanel events={events} metrics={metrics} />
              <PrivacyDisclosurePanel
                selected={selected}
                setShowPrivate={setShowPrivate}
                showPrivate={showPrivate}
              />
            </div>
          </div>
        </section>

        <section className="links-section" id="links">
          <div>
            <p className="eyebrow">Arc resources</p>
            <h2>Everything a serious builder needs within reach.</h2>
          </div>
          <div className="resource-grid">
            {links.map(([label, href]) => (
              <a className="resource-link" href={href} key={label} target="_blank" rel="noreferrer">
                <LinkIcon size={16} aria-hidden="true" />
                <span>{label}</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function nextActionLabel({
  contractReady,
  selected,
  wallet,
}: {
  contractReady: boolean;
  selected: AidRequest | null;
  wallet: string;
}) {
  if (!contractReady) return "Configure contract";
  if (!wallet) return "Connect wallet";
  if (!selected) return "Submit request";
  if (selected.status === "Submitted") return "Verify request";
  if (selected.status === "Verified") return "Fund escrow";
  if (selected.status === "Funded") return "Claim payout";
  if (selected.status === "Paid") return "Review proof";
  return selected.status;
}

function nextActionState({
  contractReady,
  isBusy,
  isLoading,
  selected,
  wallet,
}: {
  contractReady: boolean;
  isBusy: boolean;
  isLoading: boolean;
  selected: AidRequest | null;
  wallet: string;
}) {
  if (isBusy) return "Working";
  if (isLoading) return "Syncing";
  if (!contractReady || !wallet || !selected) return "Needed";
  if (selected.status === "Paid") return "Done";
  return "Action";
}

function ActionPlan({
  items,
}: {
  items: Array<{ label: string; value: string; state: string }>;
}) {
  return (
    <div className="action-plan" aria-label="Current operation state">
      {items.map((item) => (
        <div className="action-plan-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.state}</small>
        </div>
      ))}
    </div>
  );
}

function SettlementScene() {
  return (
    <Canvas
      camera={{ position: [0, 1.4, 6.4], fov: 48 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#000b24"]} />
      <ambientLight intensity={0.62} />
      <pointLight color="#cdddf2" intensity={3.2} position={[3, 4, 4]} />
      <pointLight color="#ffcc6f" intensity={1.8} position={[-4, -2, 2]} />
      <group position={[0.35, -0.1, 0]}>
        <SettlementMesh />
      </group>
    </Canvas>
  );
}

function SettlementMesh() {
  const group = useRef<THREE.Group>(null);
  const nodes = useMemo(
    () => [
      { position: [-2.8, 0.7, 0] as [number, number, number], color: "#acc6e9", scale: 0.34 },
      { position: [-1.2, -0.85, 0.6] as [number, number, number], color: "#e9a13f", scale: 0.28 },
      { position: [0.35, 0.52, -0.2] as [number, number, number], color: "#d5e0e7", scale: 0.42 },
      { position: [1.85, -0.5, 0.45] as [number, number, number], color: "#416d91", scale: 0.3 },
      { position: [3, 0.78, -0.1] as [number, number, number], color: "#ffcc6f", scale: 0.36 },
    ],
    [],
  );

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.18) * 0.18;
    group.current.rotation.x = Math.sin(clock.elapsedTime * 0.12) * 0.06;
  });

  return (
    <group ref={group}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -1.16, -0.1]}>
        <torusGeometry args={[3.5, 0.012, 10, 96]} />
        <meshStandardMaterial color="#2f578c" emissive="#153655" transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -1.18, -0.1]}>
        <torusGeometry args={[2.35, 0.01, 10, 96]} />
        <meshStandardMaterial color="#e9a13f" emissive="#702718" transparent opacity={0.42} />
      </mesh>
      {nodes.map((node, index) => (
        <mesh key={index} position={node.position} rotation={[0.35, 0.65, 0.2]}>
          <boxGeometry args={[node.scale, node.scale, node.scale]} />
          <meshStandardMaterial
            color={node.color}
            emissive={node.color}
            emissiveIntensity={0.35}
            metalness={0.35}
            roughness={0.2}
          />
        </mesh>
      ))}
      {nodes.slice(0, -1).map((node, index) => (
        <NetworkLine
          color={index % 2 === 0 ? "#acc6e9" : "#e9a13f"}
          end={nodes[index + 1].position}
          key={index}
          start={node.position}
        />
      ))}
      <NetworkLine color="#75a8ae" start={nodes[0].position} end={nodes[3].position} />
      <NetworkLine color="#ffcc6f" start={nodes[1].position} end={nodes[4].position} />
      <Packet from={nodes[0].position} phase={0} to={nodes[2].position} color="#acc6e9" />
      <Packet from={nodes[1].position} phase={0.34} to={nodes[3].position} color="#e9a13f" />
      <Packet from={nodes[2].position} phase={0.68} to={nodes[4].position} color="#cdddf2" />
    </group>
  );
}

function NetworkLine({
  start,
  end,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
}) {
  const geometry = useMemo(() => {
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ]);
  }, [start, end]);
  const line = useMemo(() => {
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.58 });
    return new THREE.Line(geometry, material);
  }, [color, geometry]);

  return <primitive object={line} />;
}

function Packet({
  from,
  to,
  phase,
  color,
}: {
  from: [number, number, number];
  to: [number, number, number];
  phase: number;
  color: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const start = useMemo(() => new THREE.Vector3(...from), [from]);
  const end = useMemo(() => new THREE.Vector3(...to), [to]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * 0.28 + phase) % 1;
    ref.current.position.lerpVectors(start, end, t);
    ref.current.rotation.x = clock.elapsedTime * 1.4;
    ref.current.rotation.y = clock.elapsedTime * 1.8;
  });

  return (
    <mesh ref={ref}>
      <boxGeometry args={[0.12, 0.12, 0.22]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} />
    </mesh>
  );
}

function StoryRail({
  activeIndex,
  onStepSelect,
  steps,
}: {
  activeIndex: number;
  onStepSelect: (index: number) => void;
  steps: StoryStep[];
}) {
  return (
    <div className="story-rail" aria-label="Guided aid flow">
      {steps.map((step, index) => (
        <button
          className={activeIndex === index ? "story-step active" : "story-step"}
          key={step.id}
          onClick={() => onStepSelect(index)}
          type="button"
        >
          <span>{step.label}</span>
          <strong>{step.title}</strong>
          <small>{roleCopy[step.role].label}</small>
        </button>
      ))}
    </div>
  );
}

function MissionConsole({
  activeStory,
  copied,
  copyText,
  contractMessage,
  contractReady,
  events,
  fundAmount,
  fundSelected,
  isBusy,
  isLoading,
  paySelected,
  rejectSelected,
  requests,
  role,
  selected,
  selectedId,
  setFundAmount,
  setRole,
  setSelectedId,
  proofBundle,
  submitCall,
  verifySelected,
}: {
  activeStory: StoryStep;
  copied: string;
  copyText: (label: string, text: string) => Promise<void>;
  contractMessage: string;
  contractReady: boolean;
  events: EventLog[];
  fundAmount: string;
  fundSelected: () => void | Promise<void>;
  isBusy: boolean;
  isLoading: boolean;
  paySelected: () => void | Promise<void>;
  rejectSelected: () => void | Promise<void>;
  requests: AidRequest[];
  role: Role;
  selected: AidRequest | null;
  selectedId: number;
  setFundAmount: (value: string) => void;
  setRole: (value: Role) => void;
  setSelectedId: (value: number) => void;
  proofBundle: string;
  submitCall: string;
  verifySelected: () => void | Promise<void>;
}) {
  const consoleTitle = selected?.memoId ?? (contractReady ? "ONCHAIN DESK" : "CONTRACT REQUIRED");

  return (
    <div className="mission-console" id="live-console">
      <div className="console-topline">
        <div>
          <p className="eyebrow">Live rescue desk</p>
          <strong>{consoleTitle}</strong>
        </div>
        {selected ? (
          <StatusPill status={selected.status} />
        ) : (
          <span className={`status-pill ${contractReady ? "verified" : "rejected"}`}>
            {isLoading ? "Loading" : contractReady ? "Ready" : "Setup"}
          </span>
        )}
      </div>

      <div className="role-tabs" aria-label="Role controls">
        {(Object.keys(roleCopy) as Role[]).map((item) => (
          <button
            className={role === item ? "role-tab active" : "role-tab"}
            key={item}
            onClick={() => setRole(item)}
            type="button"
          >
            {roleCopy[item].label}
          </button>
        ))}
      </div>

      <div className="console-body">
        <div className="story-context">
          <span>{activeStory.label}</span>
          <div>
            <strong>{activeStory.title}</strong>
            <p>{activeStory.proof}</p>
          </div>
        </div>

        {selected ? (
          <>
            <div className="request-picker">
              {requests.map((request) => (
                <button
                  className={request.id === selectedId ? "request-chip active" : "request-chip"}
                  key={request.id}
                  onClick={() => setSelectedId(request.id)}
                  type="button"
                >
                  <span>{request.category}</span>
                  <strong>{request.title}</strong>
                </button>
              ))}
            </div>

            <div className="request-card">
              <div>
                <span className="field-label">Provider</span>
                <strong>{selected.provider}</strong>
              </div>
              <div>
                <span className="field-label">Amount</span>
                <strong>
                  {selected.amount} {selected.token}
                </strong>
              </div>
              <div>
                <span className="field-label">Funded</span>
                <strong>{Math.round((selected.funded / selected.amount) * 100)}%</strong>
              </div>
            </div>

            <Progress request={selected} />

            <RoleAction
              copied={copied}
              copyText={copyText}
              fundAmount={fundAmount}
              fundSelected={fundSelected}
              isBusy={isBusy}
              paySelected={paySelected}
              rejectSelected={rejectSelected}
              role={role}
              selected={selected}
              setFundAmount={setFundAmount}
              submitCall={submitCall}
              verifySelected={verifySelected}
            />

            <ProofPanel
              copied={copied}
              copyText={copyText}
              proofBundle={proofBundle}
              selected={selected}
            />
          </>
        ) : (
          <EmptyConsoleState
            contractMessage={contractMessage}
            contractReady={contractReady}
            isLoading={isLoading}
          />
        )}

        <div className="mini-feed">
          {events.slice(0, 2).map((event) => (
            <div className="mini-feed-row" key={event.id}>
              <span>{event.time}</span>
              <div>
                <strong>{event.label}</strong>
                <p>{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyConsoleState({
  contractMessage,
  contractReady,
  isLoading,
}: {
  contractMessage: string;
  contractReady: boolean;
  isLoading: boolean;
}) {
  return (
    <div className="empty-console">
      <div>
        <span className="field-label">{contractReady ? "Arc contract" : "Setup"}</span>
        <strong>
          {isLoading
            ? "Reading SanadProtocol"
            : contractReady
              ? "No onchain requests yet"
              : "Contract address required"}
        </strong>
        <p>{contractMessage}</p>
      </div>
      <div className="proof-grid">
        <div className="proof-row">
          <span>Network</span>
          <strong>
            {ARC_TESTNET.name} / {ARC_TESTNET.chainId}
          </strong>
        </div>
        <div className="proof-row">
          <span>Contract</span>
          <strong>{SANAD_CONTRACT_ADDRESS ? shortAddress(SANAD_CONTRACT_ADDRESS) : "not configured"}</strong>
        </div>
        <div className="proof-row">
          <span>Mode</span>
          <strong>onchain only</strong>
        </div>
      </div>
    </div>
  );
}

function ProofPanel({
  copied,
  copyText,
  proofBundle,
  selected,
}: {
  copied: string;
  copyText: (label: string, text: string) => Promise<void>;
  proofBundle: string;
  selected: AidRequest;
}) {
  const contractLabel = SANAD_CONTRACT_ADDRESS ? shortAddress(SANAD_CONTRACT_ADDRESS) : "not configured";
  const explorerTarget = contractExplorerUrl();
  const proofRows = [
    ["Network", `${ARC_TESTNET.name} / ${ARC_TESTNET.chainId}`],
    ["Arc memo", shortAddress(ARC_TESTNET.extensions.memo)],
    ["SANAD contract", contractLabel],
    ["Metadata hash", selected.metadataHash],
    ["Verifier hash", selected.verificationHash ?? "pending"],
  ];

  return (
    <div className="proof-panel" id="proof">
      <div className="proof-panel-top">
        <div>
          <p className="eyebrow">Arc proof mode</p>
          <strong>{selected.memoId}</strong>
        </div>
        <button
          aria-label="Copy proof bundle"
          className="icon-button"
          onClick={() => copyText("proof", proofBundle)}
          title="Copy proof bundle"
          type="button"
        >
          <Copy size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="proof-grid">
        {proofRows.map(([label, value]) => (
          <div className="proof-row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="proof-actions">
        <a className="proof-link" href={explorerTarget} target="_blank" rel="noreferrer">
          Arcscan
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
        <a
          className="proof-link"
          href={`${ARC_TESTNET.explorerUrl}/address/${ARC_TESTNET.extensions.memo}`}
          target="_blank"
          rel="noreferrer"
        >
          Memo
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
        {copied === "proof" && <small>Proof copied</small>}
      </div>
    </div>
  );
}

function RoleAction({
  copied,
  copyText,
  fundAmount,
  fundSelected,
  isBusy,
  paySelected,
  rejectSelected,
  role,
  selected,
  setFundAmount,
  submitCall,
  verifySelected,
}: {
  copied: string;
  copyText: (label: string, text: string) => Promise<void>;
  fundAmount: string;
  fundSelected: () => void | Promise<void>;
  isBusy: boolean;
  paySelected: () => void | Promise<void>;
  rejectSelected: () => void | Promise<void>;
  role: Role;
  selected: AidRequest;
  setFundAmount: (value: string) => void;
  submitCall: string;
  verifySelected: () => void | Promise<void>;
}) {
  if (role === "verifier") {
    return (
      <div className="role-action">
        <p>{selected.privateNote}</p>
        <div className="dual-actions">
          <button
            className="primary-action"
            disabled={isBusy || selected.status !== "Submitted"}
            onClick={verifySelected}
            type="button"
          >
            <BadgeCheck size={18} aria-hidden="true" />
            Verify
          </button>
          <button
            className="secondary-action"
            disabled={isBusy || selected.status !== "Submitted"}
            onClick={rejectSelected}
            type="button"
          >
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (role === "donor") {
    return (
      <div className="role-action">
        <label className="compact-label">
          Fund amount
          <input
            min="1"
            onChange={(event) => setFundAmount(event.target.value)}
            type="number"
            value={fundAmount}
          />
        </label>
        <button
          className="primary-action"
          disabled={
            isBusy ||
            selected.funded >= selected.amount ||
            (selected.status !== "Verified" && selected.status !== "Funded")
          }
          onClick={fundSelected}
          type="button"
        >
          <Banknote size={18} aria-hidden="true" />
          Fund verified bill
        </button>
      </div>
    );
  }

  if (role === "provider") {
    return (
      <div className="role-action">
        <p>Provider payout emits SANAD and Arc memo events for reconciliation.</p>
        <button
          className="primary-action"
          disabled={isBusy || selected.status !== "Funded"}
          onClick={paySelected}
          type="button"
        >
          <Landmark size={18} aria-hidden="true" />
          Claim payout
        </button>
      </div>
    );
  }

  return (
    <div className="role-action">
      <p>Encrypted evidence stays offchain. SANAD stores metadata hashes and memo IDs.</p>
      <div className="code-box">
        <div className="code-box-top">
          <span>Contract call</span>
          <button
            aria-label="Copy contract call"
            className="icon-button"
            onClick={() => copyText("call", submitCall)}
            title="Copy contract call"
            type="button"
          >
            <Copy size={16} aria-hidden="true" />
          </button>
        </div>
        <code>{submitCall}</code>
        {copied === "call" && <small>Copied</small>}
      </div>
    </div>
  );
}

function RuntimeProofSection() {
  const icons = [
    <CircleDollarSign size={20} key="fees" />,
    <Network size={20} key="ledger" />,
    <LockKeyhole size={20} key="privacy" />,
  ];

  return (
    <section className="runtime-section" aria-label="Arc runtime references">
      <div className="runtime-copy">
        <p className="eyebrow">Arc runtime thesis</p>
        <h2>Why this belongs on Arc, not on a generic chain.</h2>
        <p>
          SANAD needs payments that feel operational: cheap enough for small bills, final enough for
          providers, and private enough for people asking for help.
        </p>
      </div>
      <div className="runtime-grid">
        {arcRuntimeRefs.map((item, index) => (
          <a className="runtime-card" href={item.href} key={item.code} target="_blank" rel="noreferrer">
            <div className="runtime-icon">{icons[index]}</div>
            <span>{item.code}</span>
            <strong>{item.title}</strong>
            <p>{item.text}</p>
            <small>
              Read reference
              <ArrowUpRight size={13} aria-hidden="true" />
            </small>
          </a>
        ))}
      </div>
    </section>
  );
}

function RequestBuilder({
  addRequest,
  contractReady,
  isBusy,
  wallet,
}: {
  addRequest: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  contractReady: boolean;
  isBusy: boolean;
  wallet: string;
}) {
  const submitLabel = !contractReady
    ? "Contract missing"
    : !wallet
      ? "Connect wallet first"
      : isBusy
        ? "Sending transaction"
        : "Submit onchain request";

  return (
    <form className="builder-panel" onSubmit={addRequest}>
      <div>
        <p className="eyebrow">Request builder</p>
        <h3>Create an onchain aid object</h3>
      </div>
      <label>
        Bill title
        <input name="title" placeholder="Emergency medicine invoice" required />
      </label>
      <div className="form-pair">
        <label>
          Category
          <StyledSelect
            defaultValue="Medical"
            name="category"
            options={["Medical", "Rent", "School", "Utilities", "Food"]}
          />
        </label>
        <label>
          Token
          <StyledSelect defaultValue="USDC" name="token" options={["USDC", "EURC"]} />
        </label>
      </div>
      <div className="form-pair">
        <label>
          Amount
          <input min="1" name="amount" placeholder="120" required type="number" />
        </label>
        <label>
          Deadline
          <input name="deadline" required type="date" />
        </label>
      </div>
      <label>
        Approved provider address
        <input name="provider" placeholder="0xProviderWallet" required />
      </label>
      <label>
        Private note
        <textarea
          name="privateNote"
          placeholder="Describe the encrypted evidence bundle."
          rows={3}
        />
      </label>
      <button className="primary-action" disabled={!contractReady || !wallet || isBusy} type="submit">
        <FileText size={18} aria-hidden="true" />
        {submitLabel}
      </button>
    </form>
  );
}

function StyledSelect({
  defaultValue,
  name,
  options,
}: {
  defaultValue: string;
  name: string;
  options: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);

  return (
    <div className={isOpen ? "styled-select open" : "styled-select"}>
      <input name={name} type="hidden" value={value} />
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="select-trigger"
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span>{value}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="select-menu" role="listbox">
          {options.map((option) => (
            <button
              aria-selected={option === value}
              className={option === value ? "select-option selected" : "select-option"}
              key={option}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setValue(option);
                setIsOpen(false);
              }}
              role="option"
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PrivacyDisclosurePanel({
  selected,
  setShowPrivate,
  showPrivate,
}: {
  selected: AidRequest | null;
  setShowPrivate: (value: boolean) => void;
  showPrivate: boolean;
}) {
  if (!selected) {
    return (
      <div className="privacy-panel">
        <div className="privacy-head">
          <div>
            <p className="eyebrow">Privacy disclosure</p>
            <h3>Waiting for onchain request</h3>
          </div>
        </div>
        <div className="visibility-list">
          <div className="list-title">
            <Globe2 size={17} aria-hidden="true" />
            <strong>Visible on Arc</strong>
          </div>
          <div className="visibility-row">
            <span>Contract</span>
            <strong>{SANAD_CONTRACT_ADDRESS ? shortAddress(SANAD_CONTRACT_ADDRESS) : "not configured"}</strong>
          </div>
          <div className="visibility-row">
            <span>Request data</span>
            <strong>none loaded</strong>
          </div>
        </div>
      </div>
    );
  }

  const publicRows = [
    ["Memo ID", selected.memoId],
    ["Category", selected.category],
    ["Provider", selected.providerAddress],
    ["Token route", `${selected.amount} ${selected.token}`],
    ["Metadata", selected.metadataHash],
    ["Verification", selected.verificationHash ?? "pending"],
  ];
  const privateRows = [
    ["Beneficiary", selected.beneficiaryAddress],
    ["Invoice file", `metadata-hash-${selected.id}`],
    ["Need context", selected.privateNote],
    ["Disclosure key", selected.memoId],
  ];

  return (
    <div className="privacy-panel">
      <div className="privacy-head">
        <div>
          <p className="eyebrow">Privacy disclosure</p>
          <h3>Public proof, private human context</h3>
        </div>
        <button
          className="secondary-link disclosure-toggle"
          onClick={() => setShowPrivate(!showPrivate)}
          type="button"
        >
          <LockKeyhole size={16} aria-hidden="true" />
          {showPrivate ? "Hide private" : "Reveal private"}
        </button>
      </div>
      <div className="privacy-grid">
        <div className="visibility-list">
          <div className="list-title">
            <Globe2 size={17} aria-hidden="true" />
            <strong>Visible on Arc</strong>
          </div>
          {publicRows.map(([label, value]) => (
            <div className="visibility-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <div className={showPrivate ? "visibility-list private revealed" : "visibility-list private"}>
          <div className="list-title">
            <ShieldCheck size={17} aria-hidden="true" />
            <strong>Selective disclosure</strong>
          </div>
          {privateRows.map(([label, value]) => (
            <div className="visibility-row" key={label}>
              <span>{label}</span>
              <strong>{showPrivate ? value : "encrypted"}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditPanel({
  events,
  metrics,
}: {
  events: EventLog[];
  metrics: { totalRequested: number; totalFunded: number; verified: number; privacyScore: number };
}) {
  return (
    <div className="audit-panel">
      <div>
        <p className="eyebrow">Protocol telemetry</p>
        <h3>Proof without public exposure</h3>
      </div>
      <div className="audit-metrics">
        <Metric icon={<ReceiptText size={19} />} label="Requested" value={`$${metrics.totalRequested}`} />
        <Metric icon={<Banknote size={19} />} label="Funded" value={`$${metrics.totalFunded}`} />
        <Metric icon={<ShieldCheck size={19} />} label="Verified" value={String(metrics.verified)} />
        <Metric icon={<Gauge size={19} />} label="Privacy score" value={`${metrics.privacyScore}%`} />
      </div>
      <div className="event-feed">
        {events.map((event) => (
          <div className="event-row" key={event.id}>
            <span>{event.time}</span>
            <div>
              <strong>{event.label}</strong>
              <p>{event.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <article className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>;
}

function Progress({ request }: { request: AidRequest }) {
  const statuses: Status[] = ["Submitted", "Verified", "Funded", "Paid"];
  const activeIndex = statuses.indexOf(request.status);
  return (
    <div className="progress-track">
      {statuses.map((status, index) => (
        <div className={index <= activeIndex ? "progress-step active" : "progress-step"} key={status}>
          <span />
          <small>{status}</small>
        </div>
      ))}
    </div>
  );
}
