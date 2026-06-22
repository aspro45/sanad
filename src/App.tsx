import { Canvas, useFrame } from "@react-three/fiber";
import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  CircleDollarSign,
  Copy,
  FileText,
  Globe2,
  HeartPulse,
  Landmark,
  Link as LinkIcon,
  LockKeyhole,
  Network,
  PanelLeft,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
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

const statusFlow: Status[] = ["Submitted", "Verified", "Funded", "Paid"];
const categories: Category[] = ["Medical", "Rent", "School", "Utilities", "Food"];
const tokens: SanadToken[] = ["USDC", "EURC"];

const roles: Array<{ id: Role; label: string; action: string }> = [
  { id: "beneficiary", label: "Beneficiary", action: "Create private bill object" },
  { id: "verifier", label: "Verifier", action: "Approve evidence hash" },
  { id: "donor", label: "Donor", action: "Fund stablecoin escrow" },
  { id: "provider", label: "Provider", action: "Claim provider payout" },
];

const protocolModules = [
  {
    icon: <FileText size={19} />,
    code: "INTAKE",
    title: "Private request object",
    text: "A real bill becomes amount, token, provider, deadline, category, memo ID, and metadata hash.",
  },
  {
    icon: <SearchCheck size={19} />,
    code: "VERIFY",
    title: "Evidence gate",
    text: "Verifiers approve offchain evidence and write a verification hash instead of sensitive files.",
  },
  {
    icon: <Banknote size={19} />,
    code: "ESCROW",
    title: "Stablecoin route",
    text: "USDC or EURC funds lock to one request, one provider, and one explicit payout path.",
  },
  {
    icon: <Landmark size={19} />,
    code: "SETTLE",
    title: "Provider settlement",
    text: "Paid requests leave an Arcscan-readable state trail for donors, operators, and providers.",
  },
];

const resources = [
  ["Arc docs", "https://docs.arc.io/"],
  ["Arcscan testnet", "https://testnet.arcscan.app/"],
  ["Circle faucet", "https://faucet.circle.com/"],
  ["App Kits", "https://www.arc.io/app-kits"],
  ["Arc ecosystem", "https://www.arc.io/ecosystem"],
  ["Privacy whitepaper", "https://6778953.fs1.hubspotusercontent-na1.net/hubfs/6778953/PDFs/Whitepapers/Arc_Privacy_Sector%20(5).pdf"],
];

function shortAddress(address: string) {
  return address.length > 13 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;
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

function percent(request: AidRequest | null) {
  if (!request || request.amount <= 0) return 0;
  return Math.min(100, Math.round((request.funded / request.amount) * 100));
}

function amountLabel(value: number, token = "USDC") {
  const amount = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
  return `${amount} ${token}`;
}

export default function App() {
  const [role, setRole] = useState<Role>("beneficiary");
  const [requests, setRequests] = useState<AidRequest[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [wallet, setWallet] = useState("");
  const [fundAmount, setFundAmount] = useState("25");
  const [copied, setCopied] = useState("");
  const [showPrivate, setShowPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [systemMessage, setSystemMessage] = useState(
    SANAD_CONTRACT_ADDRESS ? "Arc contract state ready." : "Contract address missing.",
  );
  const [events, setEvents] = useState<EventLog[]>([
    {
      id: 1,
      label: SANAD_CONTRACT_ADDRESS ? "Contract connected" : "Setup required",
      detail: SANAD_CONTRACT_ADDRESS
        ? `SanadProtocol ${shortAddress(SANAD_CONTRACT_ADDRESS)} is configured.`
        : "Set VITE_SANAD_CONTRACT_ADDRESS to read Arc state.",
      time: nowLabel(),
    },
  ]);

  const selected = requests.find((request) => request.id === selectedId) ?? requests[0] ?? null;
  const activeRole = roles.find((item) => item.id === role) ?? roles[0];
  const contractReady = Boolean(SANAD_CONTRACT_ADDRESS);

  const pushEvent = useCallback((label: string, detail: string) => {
    setEvents((current) => [
      { id: Date.now(), label, detail, time: nowLabel() },
      ...current.slice(0, 10),
    ]);
  }, []);

  const refreshRequests = useCallback(
    async (announce = false) => {
      if (!SANAD_CONTRACT_ADDRESS) {
        setRequests([]);
        setSelectedId(0);
        setSystemMessage("Contract address missing.");
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
        setSystemMessage(
          nextRequests.length
            ? `${nextRequests.length} onchain request${nextRequests.length === 1 ? "" : "s"} loaded.`
            : "Contract connected. No requests yet.",
        );
        if (announce) pushEvent("Arc state synced", "Latest SanadProtocol state loaded.");
      } catch (error) {
        setRequests([]);
        setSelectedId(0);
        setSystemMessage(errorMessage(error));
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
    const requested = requests.reduce((sum, request) => sum + request.amount, 0);
    const funded = requests.reduce((sum, request) => sum + request.funded, 0);
    const paid = requests.filter((request) => request.status === "Paid").length;
    const open = requests.filter((request) => !["Paid", "Rejected", "Cancelled", "Refunded"].includes(request.status)).length;
    return { requested, funded, paid, open };
  }, [requests]);

  const proofPacket = useMemo(
    () =>
      JSON.stringify(
        {
          network: ARC_TESTNET.name,
          chainId: ARC_TESTNET.chainId,
          contract: SANAD_CONTRACT_ADDRESS ?? "not configured",
          arcMemo: ARC_TESTNET.extensions.memo,
          selectedRequest: selected?.memoId ?? null,
          status: selected?.status ?? "empty",
          provider: selected?.providerAddress ?? null,
          amount: selected ? amountLabel(selected.amount, selected.token) : null,
          metadataHash: selected?.metadataHash ?? null,
          verificationHash: selected?.verificationHash ?? "pending",
        },
        null,
        2,
      ),
    [selected],
  );

  const readCall = selected
    ? `getRequest(${selected.id}) => ${selected.providerAddress}, ${selected.amountRaw.toString()}, ${selected.memoId}`
    : "No request selected.";

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
      pushEvent("Contract missing", "Set VITE_SANAD_CONTRACT_ADDRESS before submitting.");
      return;
    }
    if (!wallet) {
      pushEvent("Wallet required", "Connect a wallet before sending an Arc transaction.");
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    setIsBusy(true);
    try {
      const result = await submitSanadRequest({
        amount: String(form.get("amount")),
        category: String(form.get("category")) as Category,
        deadline: String(form.get("deadline")),
        privateNote: String(form.get("privateNote")),
        provider: String(form.get("provider")),
        title: String(form.get("title")),
        token: String(form.get("token")) as SanadToken,
      });
      pushEvent("Request submitted", `${result.memoId} confirmed: ${shortAddress(result.hash)}.`);
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
      pushEvent("Request verified", `${selected.memoId}: ${shortAddress(result.hash)}.`);
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
      pushEvent("Request rejected", `${selected.memoId}: ${shortAddress(result.hash)}.`);
      await refreshRequests();
    } catch (error) {
      pushEvent("Reject failed", errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function fundSelected() {
    if (!selected) return;
    if (Number(fundAmount) <= 0) return;
    setIsBusy(true);
    try {
      const result = await fundSanadRequest(selected, fundAmount);
      pushEvent("Escrow funded", `${fundAmount} ${selected.token}: ${shortAddress(result.fundHash)}.`);
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
      pushEvent("Provider paid", `${selected.provider}: ${shortAddress(result.hash)}.`);
      await refreshRequests();
    } catch (error) {
      pushEvent("Payout failed", errorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="control-room">
      <header className="command-top">
        <a className="brand" href="#top" aria-label="SANAD home">
          <span className="brand-mark">
            <HeartPulse size={21} aria-hidden="true" />
          </span>
          <span>SANAD</span>
        </a>
        <div className="top-status">
          <span>Arc Testnet</span>
          <strong>{ARC_TESTNET.chainId}</strong>
        </div>
        <div className="top-status wide">
          <span>Contract</span>
          <strong>{SANAD_CONTRACT_ADDRESS ? shortAddress(SANAD_CONTRACT_ADDRESS) : "Missing"}</strong>
        </div>
        <button className="wallet-button" onClick={connectWallet} type="button">
          <Wallet size={17} aria-hidden="true" />
          {wallet ? shortAddress(wallet) : "Connect"}
        </button>
      </header>

      <main id="top">
        <section className="console-os" aria-label="SANAD operational console">
          <aside className="left-rail">
            <div className="rail-block intro">
              <p className="eyebrow">Arc-native settlement desk</p>
              <h1>SANAD Control Room</h1>
              <p>
                Real contract state, private evidence flow, stablecoin escrow, direct provider payout.
              </p>
            </div>
            <div className="rail-block">
              <span>System</span>
              <strong>{isLoading ? "Syncing Arc" : systemMessage}</strong>
            </div>
            <div className="rail-actions">
              <button className="primary-action wide" onClick={() => void refreshRequests(true)} type="button">
                <RefreshCw size={17} aria-hidden="true" />
                Sync state
              </button>
              <a className="ghost-action wide" href={contractExplorerUrl()} target="_blank" rel="noreferrer">
                Arcscan proof
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
            <nav className="rail-nav" aria-label="Console sections">
              <a href="#builder">Request builder</a>
              <a href="#proof">Proof packet</a>
              <a href="#protocol">Protocol modules</a>
              <a href="#resources">Resources</a>
            </nav>
          </aside>

          <section className="main-stage">
            <div className="stage-head">
              <div>
                <p className="eyebrow">Live settlement map</p>
                <strong>Four-party settlement flow</strong>
              </div>
              <StatusBadge status={selected?.status ?? "Submitted"} />
            </div>
            <div className="map-shell">
              <ArcMap status={selected?.status ?? "Submitted"} />
              <div className="map-node node-a">
                <span>Beneficiary</span>
                <strong>{selected?.beneficiary ?? "private"}</strong>
              </div>
              <div className="map-node node-b">
                <span>Verifier</span>
                <strong>{selected?.verifier ?? "pending"}</strong>
              </div>
              <div className="map-node node-c">
                <span>Provider</span>
                <strong>{selected?.provider ?? "none"}</strong>
              </div>
            </div>
            <div className="metric-strip">
              <MetricCard icon={<Network size={17} />} label="Requests" value={String(requests.length)} />
              <MetricCard icon={<Activity size={17} />} label="Open" value={String(metrics.open)} />
              <MetricCard icon={<Banknote size={17} />} label="Funded" value={amountLabel(metrics.funded, "stable")} />
              <MetricCard icon={<CircleDollarSign size={17} />} label="Paid" value={String(metrics.paid)} />
            </div>
          </section>

          <aside className="right-desk">
            <div className="desk-head">
              <div>
                <p className="eyebrow">Selected request</p>
                <h2>{selected?.memoId ?? "No request"}</h2>
              </div>
              {selected && <StatusBadge status={selected.status} />}
            </div>
            {selected ? (
              <>
                <RequestVitals request={selected} />
                <Progress request={selected} />
                <RequestQueue requests={requests} selectedId={selectedId} setSelectedId={setSelectedId} />
              </>
            ) : (
              <div className="empty-card">
                <PanelLeft size={20} aria-hidden="true" />
                <strong>No onchain request loaded</strong>
                <p>Create a request or sync the contract.</p>
              </div>
            )}
          </aside>
        </section>

        <section className="desk-grid" id="builder">
          <RequestBuilder addRequest={addRequest} contractReady={contractReady} isBusy={isBusy} wallet={wallet} />
          <RoleDesk
            activeRole={activeRole}
            copied={copied}
            copyText={copyText}
            fundAmount={fundAmount}
            fundSelected={fundSelected}
            isBusy={isBusy}
            paySelected={paySelected}
            readCall={readCall}
            rejectSelected={rejectSelected}
            role={role}
            selected={selected}
            setFundAmount={setFundAmount}
            setRole={setRole}
            verifySelected={verifySelected}
          />
          <ActivityLog events={events} />
        </section>

        <section className="proof-grid-section" id="proof">
          <PrivacyMatrix selected={selected} showPrivate={showPrivate} setShowPrivate={setShowPrivate} />
          <ProofPacket copied={copied} copyText={copyText} proofPacket={proofPacket} selected={selected} />
        </section>

        <section className="modules-section" id="protocol">
          <SectionTitle eyebrow="Protocol modules" title="The money flow is a state machine, not a pitch slide." />
          <div className="module-grid">
            {protocolModules.map((item) => (
              <article className="module-card" key={item.code}>
                <div className="module-icon">{item.icon}</div>
                <span>{item.code}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="resources-section" id="resources">
          <SectionTitle eyebrow="Builder resources" title="Arc links for judges, operators, and builders." />
          <div className="resource-grid">
            {resources.map(([label, href]) => (
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

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="section-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RequestVitals({ request }: { request: AidRequest }) {
  return (
    <div className="vitals">
      <div>
        <span>Provider</span>
        <strong>{request.provider}</strong>
      </div>
      <div>
        <span>Amount</span>
        <strong>{amountLabel(request.amount, request.token)}</strong>
      </div>
      <div>
        <span>Funded</span>
        <strong>{percent(request)}%</strong>
      </div>
      <div>
        <span>Deadline</span>
        <strong>{request.deadline}</strong>
      </div>
    </div>
  );
}

function RequestQueue({
  requests,
  selectedId,
  setSelectedId,
}: {
  requests: AidRequest[];
  selectedId: number;
  setSelectedId: (value: number) => void;
}) {
  if (!requests.length) {
    return <div className="queue-empty">No requests found on this contract.</div>;
  }

  return (
    <div className="request-queue">
      {requests.map((request) => (
        <button
          className={request.id === selectedId ? "queue-row active" : "queue-row"}
          key={request.id}
          onClick={() => setSelectedId(request.id)}
          type="button"
        >
          <span>{request.memoId}</span>
          <strong>{request.category}</strong>
          <small>{request.status}</small>
        </button>
      ))}
    </div>
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
  const label = !contractReady
    ? "Contract missing"
    : !wallet
      ? "Connect wallet"
      : isBusy
        ? "Sending"
        : "Submit request";

  return (
    <form className="panel request-builder" onSubmit={addRequest}>
      <div className="panel-head">
        <p className="eyebrow">Request builder</p>
        <h2>New private bill</h2>
      </div>
      <label>
        Bill title
        <input name="title" placeholder="Emergency medicine invoice" required />
      </label>
      <div className="field-pair">
        <label>
          Category
          <SelectInput defaultValue="Medical" name="category" options={categories} />
        </label>
        <label>
          Token
          <SelectInput defaultValue="USDC" name="token" options={tokens} />
        </label>
      </div>
      <div className="field-pair">
        <label>
          Amount
          <input min="0.000001" name="amount" placeholder="120" required step="0.000001" type="number" />
        </label>
        <label>
          Deadline
          <input name="deadline" required type="date" />
        </label>
      </div>
      <label>
        Approved provider wallet
        <input name="provider" placeholder="0xProviderWallet" required />
      </label>
      <label>
        Private note
        <textarea name="privateNote" placeholder="Encrypted evidence context for verifier review." rows={4} />
      </label>
      <button className="primary-action wide" disabled={!contractReady || !wallet || isBusy} type="submit">
        <FileText size={18} aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}

function RoleDesk({
  activeRole,
  copied,
  copyText,
  fundAmount,
  fundSelected,
  isBusy,
  paySelected,
  readCall,
  rejectSelected,
  role,
  selected,
  setFundAmount,
  setRole,
  verifySelected,
}: {
  activeRole: { id: Role; label: string; action: string };
  copied: string;
  copyText: (label: string, value: string) => Promise<void>;
  fundAmount: string;
  fundSelected: () => void | Promise<void>;
  isBusy: boolean;
  paySelected: () => void | Promise<void>;
  readCall: string;
  rejectSelected: () => void | Promise<void>;
  role: Role;
  selected: AidRequest | null;
  setFundAmount: (value: string) => void;
  setRole: (value: Role) => void;
  verifySelected: () => void | Promise<void>;
}) {
  return (
    <section className="panel role-desk">
      <div className="panel-head">
        <p className="eyebrow">Role action desk</p>
        <h2>{activeRole.action}</h2>
      </div>
      <div className="role-tabs">
        {roles.map((item) => (
          <button
            className={role === item.id ? "role-tab active" : "role-tab"}
            key={item.id}
            onClick={() => setRole(item.id)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      {selected ? (
        <RoleAction
          copied={copied}
          copyText={copyText}
          fundAmount={fundAmount}
          fundSelected={fundSelected}
          isBusy={isBusy}
          paySelected={paySelected}
          readCall={readCall}
          rejectSelected={rejectSelected}
          role={role}
          selected={selected}
          setFundAmount={setFundAmount}
          verifySelected={verifySelected}
        />
      ) : (
        <div className="empty-card">
          <strong>No request selected</strong>
          <p>Sync Arc state or create a request first.</p>
        </div>
      )}
    </section>
  );
}

function RoleAction({
  copied,
  copyText,
  fundAmount,
  fundSelected,
  isBusy,
  paySelected,
  readCall,
  rejectSelected,
  role,
  selected,
  setFundAmount,
  verifySelected,
}: {
  copied: string;
  copyText: (label: string, value: string) => Promise<void>;
  fundAmount: string;
  fundSelected: () => void | Promise<void>;
  isBusy: boolean;
  paySelected: () => void | Promise<void>;
  readCall: string;
  rejectSelected: () => void | Promise<void>;
  role: Role;
  selected: AidRequest;
  setFundAmount: (value: string) => void;
  verifySelected: () => void | Promise<void>;
}) {
  if (role === "verifier") {
    return (
      <div className="action-card">
        <p>{selected.privateNote}</p>
        <div className="dual-actions">
          <button className="primary-action" disabled={isBusy || selected.status !== "Submitted"} onClick={verifySelected} type="button">
            <BadgeCheck size={17} aria-hidden="true" />
            Verify
          </button>
          <button className="danger-action" disabled={isBusy || selected.status !== "Submitted"} onClick={rejectSelected} type="button">
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (role === "donor") {
    return (
      <div className="action-card">
        <label>
          Fund amount
          <input min="0.000001" onChange={(event) => setFundAmount(event.target.value)} step="0.000001" type="number" value={fundAmount} />
        </label>
        <button
          className="primary-action wide"
          disabled={isBusy || selected.funded >= selected.amount || (selected.status !== "Verified" && selected.status !== "Funded")}
          onClick={fundSelected}
          type="button"
        >
          <Banknote size={17} aria-hidden="true" />
          Fund escrow
        </button>
      </div>
    );
  }

  if (role === "provider") {
    return (
      <div className="action-card">
        <p>Provider payout unlocks only after escrow reaches the funded state.</p>
        <button className="primary-action wide" disabled={isBusy || selected.status !== "Funded"} onClick={paySelected} type="button">
          <Landmark size={17} aria-hidden="true" />
          Claim payout
        </button>
      </div>
    );
  }

  return (
    <div className="action-card">
      <p>Beneficiary evidence stays offchain. The contract stores memo and metadata hashes.</p>
      <CodeBox copied={copied === "read"} label="Contract read" onCopy={() => copyText("read", readCall)} value={readCall} />
    </div>
  );
}

function ActivityLog({ events }: { events: EventLog[] }) {
  return (
    <section className="panel activity-log">
      <div className="panel-head">
        <p className="eyebrow">Activity log</p>
        <h2>Operator trail</h2>
      </div>
      <div className="event-list">
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
    </section>
  );
}

function PrivacyMatrix({
  selected,
  setShowPrivate,
  showPrivate,
}: {
  selected: AidRequest | null;
  setShowPrivate: (value: boolean) => void;
  showPrivate: boolean;
}) {
  const publicRows = selected
    ? [
        ["Memo", selected.memoId],
        ["Category", selected.category],
        ["Provider", selected.providerAddress],
        ["Token", `${selected.amount} ${selected.token}`],
        ["Metadata", selected.metadataHash],
      ]
    : [
        ["Contract", SANAD_CONTRACT_ADDRESS ? shortAddress(SANAD_CONTRACT_ADDRESS) : "missing"],
        ["Request", "none"],
      ];
  const privateRows = selected
    ? [
        ["Beneficiary", selected.beneficiaryAddress],
        ["Evidence", `metadata-hash-${selected.id}`],
        ["Context", selected.privateNote],
      ]
    : [
        ["Beneficiary", "none"],
        ["Evidence", "none"],
      ];

  return (
    <section className="panel privacy-panel">
      <div className="panel-head split">
        <div>
          <p className="eyebrow">Privacy matrix</p>
          <h2>Public proof, private context</h2>
        </div>
        <button className="secondary-action" onClick={() => setShowPrivate(!showPrivate)} type="button">
          <LockKeyhole size={16} aria-hidden="true" />
          {showPrivate ? "Hide" : "Reveal"}
        </button>
      </div>
      <div className="privacy-columns">
        <Visibility title="Visible on Arc" icon={<Globe2 size={17} />} rows={publicRows} />
        <Visibility title="Selective disclosure" icon={<ShieldCheck size={17} />} rows={privateRows} locked={!showPrivate} />
      </div>
    </section>
  );
}

function ProofPacket({
  copied,
  copyText,
  proofPacket,
  selected,
}: {
  copied: string;
  copyText: (label: string, value: string) => Promise<void>;
  proofPacket: string;
  selected: AidRequest | null;
}) {
  return (
    <section className="panel proof-panel">
      <div className="panel-head split">
        <div>
          <p className="eyebrow">Proof packet</p>
          <h2>{selected?.memoId ?? "No request"}</h2>
        </div>
        <button className="ghost-action" onClick={() => copyText("proof", proofPacket)} type="button">
          <Copy size={16} aria-hidden="true" />
          {copied === "proof" ? "Copied" : "Copy"}
        </button>
      </div>
      <CodeBox copied={copied === "proof"} label="JSON" onCopy={() => copyText("proof", proofPacket)} value={proofPacket} />
    </section>
  );
}

function Visibility({
  icon,
  locked,
  rows,
  title,
}: {
  icon: ReactNode;
  locked?: boolean;
  rows: string[][];
  title: string;
}) {
  return (
    <div className={locked ? "visibility locked" : "visibility"}>
      <div className="visibility-title">
        {icon}
        <strong>{title}</strong>
      </div>
      {rows.map(([label, value]) => (
        <div className="visibility-row" key={label}>
          <span>{label}</span>
          <strong>{locked ? "encrypted" : value}</strong>
        </div>
      ))}
    </div>
  );
}

function SelectInput<T extends string>({ defaultValue, name, options }: { defaultValue: T; name: string; options: readonly T[] }) {
  return (
    <select defaultValue={defaultValue} name={name}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function CodeBox({
  copied,
  label,
  onCopy,
  value,
}: {
  copied: boolean;
  label: string;
  onCopy: () => void;
  value: string;
}) {
  return (
    <div className="code-box">
      <div className="code-top">
        <span>{label}</span>
        <button aria-label={`Copy ${label}`} className="icon-button" onClick={onCopy} type="button">
          <Copy size={15} aria-hidden="true" />
        </button>
      </div>
      <code>{value}</code>
      {copied && <small>Copied</small>}
    </div>
  );
}

function Progress({ request }: { request: AidRequest }) {
  const activeIndex = statusFlow.indexOf(request.status);
  return (
    <div className="progress">
      {statusFlow.map((status, index) => (
        <div className={index <= activeIndex ? "progress-step active" : "progress-step"} key={status}>
          <span />
          <small>{status}</small>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>;
}

function ArcMap({ status }: { status: Status }) {
  return (
    <Canvas camera={{ position: [0, 1.15, 6.6], fov: 45 }} dpr={[1, 1.7]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <color attach="background" args={["#000b24"]} />
      <ambientLight intensity={0.65} />
      <pointLight color="#cdddf2" intensity={3.5} position={[3.2, 4, 3]} />
      <pointLight color="#e9a13f" intensity={2} position={[-3, -1.7, 2.2]} />
      <MapObjects status={status} />
    </Canvas>
  );
}

function MapObjects({ status }: { status: Status }) {
  const group = useRef<THREE.Group>(null);
  const packet = useRef<THREE.Mesh>(null);
  const statusIndex = Math.max(0, statusFlow.indexOf(status));
  const nodes = useMemo(
    () => [
      { position: [-2.65, 0.35, 0] as [number, number, number], color: "#acc6e9" },
      { position: [-0.9, 1.05, -0.25] as [number, number, number], color: "#d5e0e7" },
      { position: [0.75, -0.85, 0.36] as [number, number, number], color: "#e9a13f" },
      { position: [2.75, 0.3, -0.2] as [number, number, number], color: "#416d91" },
    ],
    [],
  );

  useFrame(({ clock }) => {
    if (group.current) {
      group.current.rotation.y = Math.sin(clock.elapsedTime * 0.16) * 0.22;
      group.current.rotation.x = Math.sin(clock.elapsedTime * 0.12) * 0.07;
    }
    if (packet.current) {
      const t = (clock.elapsedTime * 0.18 + statusIndex * 0.2) % 1;
      packet.current.position.x = -2.65 + t * 5.4;
      packet.current.position.y = Math.sin(clock.elapsedTime * 1.4) * 0.18;
      packet.current.rotation.x = clock.elapsedTime * 1.2;
      packet.current.rotation.y = clock.elapsedTime * 1.7;
    }
  });

  return (
    <group ref={group}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -1.1, 0]}>
        <torusGeometry args={[3.4, 0.012, 10, 128]} />
        <meshStandardMaterial color="#416d91" emissive="#153655" transparent opacity={0.52} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0.28, 0]} position={[0, -1.12, 0]}>
        <torusGeometry args={[2.25, 0.01, 10, 128]} />
        <meshStandardMaterial color="#e9a13f" emissive="#702718" transparent opacity={0.42} />
      </mesh>
      {nodes.map((node, index) => (
        <mesh key={index} position={node.position} rotation={[0.36, 0.64, 0.22]}>
          <boxGeometry args={[0.34 + index * 0.04, 0.34 + index * 0.04, 0.34 + index * 0.04]} />
          <meshStandardMaterial color={node.color} emissive={node.color} emissiveIntensity={0.42} metalness={0.4} roughness={0.2} />
        </mesh>
      ))}
      <mesh ref={packet}>
        <boxGeometry args={[0.18, 0.18, 0.3]} />
        <meshStandardMaterial color="#acc6e9" emissive="#acc6e9" emissiveIntensity={0.85} />
      </mesh>
      {nodes.slice(0, -1).map((node, index) => (
        <NetworkLine color={index === 1 ? "#e9a13f" : "#acc6e9"} end={nodes[index + 1].position} key={index} start={node.position} />
      ))}
      <NetworkLine color="#75a8ae" start={nodes[0].position} end={nodes[2].position} />
      <NetworkLine color="#ffcc6f" start={nodes[1].position} end={nodes[3].position} />
    </group>
  );
}

function NetworkLine({
  color,
  end,
  start,
}: {
  color: string;
  end: [number, number, number];
  start: [number, number, number];
}) {
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...start), new THREE.Vector3(...end)]),
    [end, start],
  );
  const line = useMemo(
    () => new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 })),
    [color, geometry],
  );

  return <primitive object={line} />;
}
