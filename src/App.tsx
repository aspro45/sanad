import {
  Activity,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  Globe2,
  HeartPulse,
  Landmark,
  LockKeyhole,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  CSSProperties,
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

type ChoicePickerProps<T extends string> = {
  label: string;
  name: string;
  onChange: (value: T) => void;
  options: readonly T[];
  value: T;
};

const roles: Array<{ id: Role; label: string; icon: ReactNode }> = [
  { id: "beneficiary", label: "Beneficiary", icon: <HeartPulse size={16} /> },
  { id: "verifier", label: "Verifier", icon: <SearchCheck size={16} /> },
  { id: "donor", label: "Donor", icon: <Banknote size={16} /> },
  { id: "provider", label: "Provider", icon: <Landmark size={16} /> },
];

const statusPath: Status[] = ["Submitted", "Verified", "Funded", "Paid"];
const allCategories: Category[] = ["Medical", "Rent", "School", "Utilities", "Food"];
const allTokens: SanadToken[] = ["USDC", "EURC"];

const missionCards = [
  ["No public hardship feed", "The request can be funded without turning a family story into public content."],
  ["Verifier trust layer", "Evidence is checked by a real reviewer while the chain stores compact hashes."],
  ["Provider-first payout", "Money moves to clinics, landlords, schools, and utilities, not to a vague campaign wallet."],
];

const reliefAreas = [
  {
    image: "/sanad-relief-medical.png",
    text: "Medication, clinics, emergency prescriptions, and provider invoices.",
    title: "Medical",
  },
  {
    image: "/sanad-relief-housing.png",
    text: "Rent gaps, eviction prevention, and verified shelter payments.",
    title: "Housing",
  },
  {
    image: "/sanad-relief-school.png",
    text: "Tuition bridges, supplies, uniforms, and urgent student support.",
    title: "School",
  },
  {
    image: "/sanad-relief-utilities.png",
    text: "Power, water, internet access, and essential household bills.",
    title: "Utilities",
  },
];

const showcaseCards = [
  {
    accent: "gold",
    eyebrow: "01 // intake",
    image: "/sanad-showcase-intake.png",
    metric: "Offchain evidence",
    rows: [
      ["Memo", "SANAD-TST-0002"],
      ["Token", "USDC"],
      ["Provider", "0xf6d0...3Cf6"],
    ],
    text: "A beneficiary creates a private bill object with route facts, metadata hash, provider wallet, and deadline.",
    title: "Private bill desk",
  },
  {
    accent: "blue",
    eyebrow: "02 // verify",
    image: "/sanad-showcase-verifier.png",
    metric: "Selective disclosure",
    rows: [
      ["Evidence", "Private"],
      ["Verifier", "Hash posted"],
      ["Invoice", "Never public"],
    ],
    text: "Reviewers approve only after offchain evidence review. The chain stores proof handles, not family documents.",
    title: "Reviewer proof room",
  },
  {
    accent: "mint",
    eyebrow: "03 // escrow",
    image: "/sanad-showcase-escrow.png",
    metric: "Arc 5042002",
    rows: [
      ["Requested", "0.000002 stable"],
      ["Open", "0"],
      ["Funded", "100%"],
    ],
    text: "Donors route stablecoin into a single request escrow, with a clean state path from submitted to paid.",
    title: "Stablecoin route",
  },
  {
    accent: "peach",
    eyebrow: "04 // settle",
    image: "/sanad-showcase-settlement.png",
    metric: "Proof packet",
    rows: [
      ["Payout", "Provider"],
      ["Arcscan", "Ready"],
      ["Memo", "Exportable"],
    ],
    text: "Provider payout leaves an Arc-readable trail for operators, donors, providers, and grant reviewers.",
    title: "Provider settlement",
  },
];

const typeSpecimens = [
  ["Display", "SANAD", "Direct aid rail"],
  ["Memo", "TST-0002", "Request handle"],
  ["Hash", "0xdce8...5f77", "Verifier proof"],
  ["State", "PAID", "Provider settled"],
];

const steps = [
  ["01", "Request", "A private bill object is created with route facts, memo ID, and metadata hash."],
  ["02", "Review", "The verifier checks offchain evidence and posts a compact approval hash."],
  ["03", "Escrow", "Donors fund USDC or EURC into the request on Arc testnet."],
  ["04", "Settle", "The provider receives payout after the request reaches the funded state."],
];

const blogChapters = [
  {
    eyebrow: "Problem",
    title: "Emergency aid still leaks too much human context.",
    text:
      "Most online fundraisers ask people to publish a hardship story, screenshots, invoices, names, and family context before money can move. SANAD starts from the opposite direction: keep the human situation private, expose only the settlement facts needed to route and audit aid.",
  },
  {
    eyebrow: "Product",
    title: "A bill becomes a request object, not a public campaign.",
    text:
      "A beneficiary creates a request with a provider wallet, token, amount, category, deadline, memo ID, and metadata hash. The invoice or private note stays offchain. The onchain record is compact enough for donors and operators to verify state without turning personal evidence into public content.",
  },
  {
    eyebrow: "Arc rail",
    title: "Stablecoin settlement is the interface, not a back-office step.",
    text:
      "SANAD uses Arc testnet as the payment and proof layer: donors fund a request in USDC or EURC, the contract tracks escrow state, and provider payout creates a clean trail on Arcscan. The website reads directly from the contract, so the interface can show what the rail actually knows.",
  },
  {
    eyebrow: "Governance",
    title: "Provider and verifier allowlists keep the flow accountable.",
    text:
      "The contract owner approves providers and verifiers. Verifiers can approve or reject submitted requests after offchain review. Providers receive payout only after full funding. Expired requests can be refunded back to contributors, and the latest contract test covers the refund edge case.",
  },
];

const blogFlow = [
  ["01", "Submit", "Beneficiary seals the request with memo ID and metadata hash."],
  ["02", "Review", "Verifier approves a hash after checking offchain evidence."],
  ["03", "Fund", "Donors escrow stablecoin into a specific request."],
  ["04", "Pay", "Provider receives payout after the request reaches funded state."],
];

const blogSecurityNotes = [
  "No invoice images are stored onchain.",
  "Provider wallets must be approved before requests can target them.",
  "Verifier actions write proof handles, not private documents.",
  "Refund logic prevents partial-refunded requests from being paid out.",
];

const footerLinks = [
  ["GitHub", "https://github.com/aspro45/sanad"],
  ["README", "https://github.com/aspro45/sanad#readme"],
  ["ASPRO on X", "https://x.com/ASPRO_22"],
  ["Live rail", "#rail"],
  ["Proof", "#proof"],
];

function shortAddress(value: string) {
  return value.length > 13 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function timeLabel() {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown contract error.";
}

function amountLabel(value: number, token = "USDC") {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
  return `${formatted} ${token}`;
}

function statusIndex(status: Status | undefined) {
  const index = status ? statusPath.indexOf(status) : 0;
  return index >= 0 ? index : 0;
}

function fundedPercent(request: AidRequest | null) {
  if (!request || request.amount <= 0) return 0;
  return Math.min(100, Math.round((request.funded / request.amount) * 100));
}

export default function App() {
  const [role, setRole] = useState<Role>("beneficiary");
  const [requests, setRequests] = useState<AidRequest[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [wallet, setWallet] = useState("");
  const [activeSection, setActiveSection] = useState("mission");
  const [fundAmount, setFundAmount] = useState("25");
  const [copied, setCopied] = useState("");
  const [showPrivate, setShowPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [systemMessage, setSystemMessage] = useState(
    SANAD_CONTRACT_ADDRESS ? "Arc contract linked." : "Contract address missing.",
  );
  const [events, setEvents] = useState<EventLog[]>([
    {
      id: 1,
      label: SANAD_CONTRACT_ADDRESS ? "Contract online" : "Setup required",
      detail: SANAD_CONTRACT_ADDRESS
        ? `SanadProtocol ${shortAddress(SANAD_CONTRACT_ADDRESS)} configured.`
        : "Set VITE_SANAD_CONTRACT_ADDRESS before using the live rail.",
      time: timeLabel(),
    },
  ]);

  const selected = requests.find((request) => request.id === selectedId) ?? requests[0] ?? null;
  const contractReady = Boolean(SANAD_CONTRACT_ADDRESS);

  const pushEvent = useCallback((label: string, detail: string) => {
    setEvents((current) => [
      { id: Date.now(), label, detail, time: timeLabel() },
      ...current.slice(0, 9),
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
        const next = await loadSanadRequests(SANAD_CONTRACT_ADDRESS);
        setRequests(next);
        setSelectedId((current) =>
          next.some((request) => request.id === current) ? current : (next[0]?.id ?? 0),
        );
        setSystemMessage(
          next.length
            ? `${next.length} live request${next.length === 1 ? "" : "s"} loaded from Arc.`
            : "Contract connected. No requests yet.",
        );
        if (announce) pushEvent("Arc state synced", "Latest contract state loaded.");
      } catch (error) {
        setRequests([]);
        setSelectedId(0);
        setSystemMessage(errorMessage(error));
        pushEvent("Arc read failed", errorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [pushEvent],
  );

  useEffect(() => {
    void refreshRequests();
  }, [refreshRequests]);

  useEffect(() => {
    if (!window.location.hash) return;
    const targetId = window.location.hash.slice(1);
    if (["mission", "model", "rail", "proof", "blog"].includes(targetId)) {
      setActiveSection(targetId);
    }
    const timers = [250, 900, 1600].map((delay) =>
      window.setTimeout(() => {
        document.getElementById(targetId)?.scrollIntoView();
      }, delay),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    let cancelled = false;
    let context: { revert: () => void } | undefined;

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);

      context = gsap.context(() => {
        gsap.set(".scroll-progress", { scaleX: 0, transformOrigin: "left center" });
        gsap.set(".proof-lane", { "--route-progress": 0 });

        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => {
            gsap.to(".scroll-progress", {
              duration: 0.12,
              ease: "none",
              overwrite: true,
              scaleX: self.progress,
            });
          },
        });

        gsap.fromTo(
          ".site-nav",
          { autoAlpha: 0, scale: 0.985, y: -16 },
          { autoAlpha: 1, duration: 0.7, ease: "power3.out", scale: 1, y: 0 },
        );

        gsap.fromTo(
          ".hero-media",
          { filter: "saturate(0.88) contrast(0.96)", scale: 1.06 },
          { duration: 1.35, ease: "power2.out", filter: "saturate(1) contrast(1.03)", scale: 1.02 },
        );

        gsap.fromTo(
          [".hero-copy .kicker", ".hero-copy h1", ".hero-copy > p:not(.kicker)", ".hero-actions", ".hero-assurance"],
          { autoAlpha: 0, y: 28 },
          { autoAlpha: 1, delay: 0.08, duration: 0.82, ease: "power3.out", stagger: 0.08, y: 0 },
        );

        gsap.fromTo(
          ".hero-impact-dock .mini-stat",
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, delay: 0.42, duration: 0.6, ease: "power3.out", stagger: 0.06, y: 0 },
        );

        gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
          gsap.fromTo(
            element,
            { autoAlpha: 0, y: 30 },
            {
              autoAlpha: 1,
              duration: 0.72,
              ease: "power3.out",
              scrollTrigger: {
                once: true,
                start: "top 88%",
                trigger: element,
              },
              y: 0,
            },
          );
        });

        gsap.to(".proof-lane", {
          "--route-progress": 1,
          duration: 1.2,
          ease: "power2.out",
          scrollTrigger: { once: true, start: "top 72%", trigger: ".proof-board" },
        });

        gsap.fromTo(
          ".proof-node",
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            duration: 0.58,
            ease: "power3.out",
            scrollTrigger: { once: true, start: "top 72%", trigger: ".proof-board" },
            stagger: 0.08,
            y: 0,
          },
        );
      });
    })();

    return () => {
      cancelled = true;
      context?.revert();
    };
  }, [requests.length]);

  useEffect(() => {
    const ids = ["mission", "model", "rail", "proof", "blog"];
    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const marker = window.innerHeight * 0.34;
      const current = ids.reduce((active, id) => {
        const section = document.getElementById(id);
        if (!section) return active;
        return section.getBoundingClientRect().top <= marker ? id : active;
      }, ids[0]);
      setActiveSection(current);
    };
    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  const metrics = useMemo(() => {
    const requested = requests.reduce((sum, request) => sum + request.amount, 0);
    const funded = requests.reduce((sum, request) => sum + request.funded, 0);
    const open = requests.filter(
      (request) => !["Paid", "Rejected", "Cancelled", "Refunded"].includes(request.status),
    ).length;
    const paid = requests.filter((request) => request.status === "Paid").length;
    return { funded, open, paid, requested };
  }, [requests]);

  const proofPacket = useMemo(
    () =>
      JSON.stringify(
        {
          network: ARC_TESTNET.name,
          chainId: ARC_TESTNET.chainId,
          contract: SANAD_CONTRACT_ADDRESS ?? "not configured",
          arcMemo: ARC_TESTNET.extensions.memo,
          selectedRequest: selected
            ? {
                id: selected.id,
                memoId: selected.memoId,
                status: selected.status,
                provider: selected.providerAddress,
                token: selected.token,
                amount: selected.amountRaw.toString(),
                funded: selected.fundedRaw.toString(),
                metadataHash: selected.metadataHash,
                verificationHash: selected.verificationHash ?? "pending",
              }
            : null,
        },
        null,
        2,
      ),
    [selected],
  );

  const readCall = selected
    ? `getRequestCore(${selected.id}) -> provider ${selected.providerAddress}, token ${selected.token}, funded ${selected.fundedRaw.toString()}`
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
      pushEvent("Wallet required", "Connect Rabby or another injected wallet first.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;

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
      pushEvent("Request submitted", `${result.memoId} confirmed with ${shortAddress(result.hash)}.`);
      await refreshRequests();
      formElement.reset();
    } catch (error) {
      pushEvent("Submit failed", errorMessage(error));
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
    if (!selected || Number(fundAmount) <= 0) return;
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
      pushEvent("Provider paid", `${selected.memoId}: ${shortAddress(result.hash)}.`);
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
    <div className="sanad-site">
      <div className="scroll-progress" aria-hidden="true" />
      <header className="site-nav">
        <a className="brand-lockup" href="#top">
          <span className="brand-mark">
            <HeartPulse size={20} aria-hidden="true" />
          </span>
          <span>
            <strong>SANAD</strong>
            <small>private aid rail</small>
          </span>
        </a>
        <nav className="nav-links" aria-label="Primary">
          <a className={activeSection === "mission" ? "active" : undefined} href="#mission" onClick={() => setActiveSection("mission")}>Mission</a>
          <a className={activeSection === "model" ? "active" : undefined} href="#model" onClick={() => setActiveSection("model")}>Model</a>
          <a className={activeSection === "rail" ? "active" : undefined} href="#rail" onClick={() => setActiveSection("rail")}>Live rail</a>
          <a className={activeSection === "proof" ? "active" : undefined} href="#proof" onClick={() => setActiveSection("proof")}>Proof</a>
          <a className={activeSection === "blog" ? "active" : undefined} href="#blog" onClick={() => setActiveSection("blog")}>Blog</a>
        </nav>
        <button className="connect-button" onClick={connectWallet} type="button">
          <Wallet size={17} aria-hidden="true" />
          {wallet ? shortAddress(wallet) : "Connect"}
        </button>
      </header>

      <main>
        <section className="hero-foundation" id="top">
          <img
            className="hero-media"
            src="/sanad-hero-cinematic.png"
            alt="Private aid envelope and encrypted provider settlement desk"
          />
          <div className="hero-shade" />
          <div className="hero-copy" data-reveal>
            <p className="kicker">Arc-native verified aid rail</p>
            <h1>Help paid directly. Proof without exposure.</h1>
            <p>
              SANAD routes urgent medical, rent, school, utility, and food bills into verified
              stablecoin settlement flows. Families keep dignity. Donors see proof. Providers get paid.
            </p>
            <div className="hero-actions">
              <a className="primary-link" href="#rail">
                Run live flow
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
              <a className="secondary-link" href={contractExplorerUrl()} target="_blank" rel="noreferrer">
                Arc contract
              </a>
            </div>
            <div className="hero-assurance">
              <span>Public on Arc</span>
              <strong>memo IDs, metadata hashes, escrow state, provider payout</strong>
            </div>
          </div>
          <div className="hero-impact-dock" data-reveal>
            <MiniStat label="Network" value={`Arc ${ARC_TESTNET.chainId}`} />
            <MiniStat label="Requests" value={String(requests.length)} />
            <MiniStat label="Open" value={String(metrics.open)} />
            <MiniStat label="Funded" value={amountLabel(metrics.funded, "stable")} />
          </div>
        </section>

        <section className="signal-strip" aria-label="Live Arc status" data-reveal>
          <MiniStat label="Network" value={`Arc ${ARC_TESTNET.chainId}`} />
          <MiniStat label="Requests" value={String(requests.length)} />
          <MiniStat label="Open" value={String(metrics.open)} />
          <MiniStat label="Requested" value={amountLabel(metrics.requested, "stable")} />
          <MiniStat label="Funded" value={amountLabel(metrics.funded, "stable")} />
          <button onClick={() => void refreshRequests(true)} type="button">
            <RefreshCw size={15} aria-hidden="true" />
            {isLoading ? "Syncing" : "Sync Arc"}
          </button>
        </section>

        <section className="protocol-gallery" aria-label="SANAD protocol showcase">
          <div className="gallery-copy" data-reveal>
            <p className="kicker">Protocol showcase</p>
            <h2>Not a donation page. A live settlement interface.</h2>
            <p>
              SANAD now reads like an operating product: intake, verification, escrow, payout,
              and proof presented as real protocol surfaces.
            </p>
            <div className="gallery-filters" aria-label="Protocol views">
              <span>All flows</span>
              <span>Privacy</span>
              <span>Escrow</span>
              <span>Arc proof</span>
            </div>
          </div>
          <div className="gallery-grid">
            {showcaseCards.map((card, index) => (
              <article
                className={`gallery-card ${card.accent}`}
                data-reveal
                key={card.title}
                style={{ "--reveal-delay": `${index * 70}ms` } as CSSProperties}
              >
                <div className="gallery-media">
                  <img src={card.image} alt={`${card.title} protocol visual`} />
                  <div className="gallery-badge">{card.eyebrow}</div>
                </div>
                <div className="gallery-body">
                  <div className="gallery-card-head">
                    <h3>{card.title}</h3>
                    <strong>{card.metric}</strong>
                  </div>
                  <p>{card.text}</p>
                  <div className="gallery-data">
                    {card.rows.map(([label, value]) => (
                      <span key={label}>
                        <small>{label}</small>
                        <b>{value}</b>
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="type-ledger" aria-label="SANAD readable proof language">
          <div className="type-ledger-head" data-reveal>
            <p className="kicker">Readable proof layer</p>
            <h2>Memo, hash, provider, payout. Big enough to trust at a glance.</h2>
          </div>
          <div className="type-runner" aria-hidden="true" data-reveal>
            <div className="type-runner-track">
              <span>Memo ID</span>
              <span>Metadata hash</span>
              <span>Provider wallet</span>
              <span>Escrow state</span>
              <span>Arc proof</span>
              <span>Memo ID</span>
              <span>Metadata hash</span>
              <span>Provider wallet</span>
              <span>Escrow state</span>
              <span>Arc proof</span>
            </div>
          </div>
          <div className="type-specimen-grid">
            {typeSpecimens.map(([label, sample, detail], index) => (
              <article
                className="type-specimen-card"
                data-reveal
                key={label}
                style={{ "--reveal-delay": `${index * 60}ms` } as CSSProperties}
              >
                <span>{label}</span>
                <strong>{sample}</strong>
                <small>{detail}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="mission-section" id="mission">
          <div className="section-head wide" data-reveal>
            <p className="kicker">Built like a foundation, settled like infrastructure</p>
            <h2>A private payment layer for people who need help before paperwork catches up.</h2>
          </div>
          <div className="mission-grid">
            <div className="mission-portrait" data-reveal>
              <img src="/sanad-collage-hero.png" alt="Private aid desk with sealed bill evidence" />
            </div>
            <div className="mission-cards">
              {missionCards.map(([title, text]) => (
                <article className="mission-card" data-reveal key={title}>
                  <span>{title}</span>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="route-showcase">
          <div className="section-head" data-reveal>
            <p className="kicker">Proof route</p>
            <h2>The transaction path is visible. The private hardship is not.</h2>
            <p>
              This is where the visual system earns the technology: offchain evidence enters once,
              Arc keeps the settlement trail, and the provider receives the payout.
            </p>
          </div>
          <ProofBoard metrics={metrics} selected={selected} />
        </section>

        <section className="model-section" id="model">
          <div className="section-head" data-reveal>
            <p className="kicker">Operating model</p>
            <h2>One rail for urgent bills across real provider categories.</h2>
          </div>
          <div className="relief-grid">
            {reliefAreas.map((area, index) => (
              <article className="relief-card" data-reveal key={area.title}>
                <div className="relief-visual">
                  <img src={area.image} alt={`${area.title} aid category visual`} />
                </div>
                <div className="relief-copy">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{area.title}</h3>
                  <p>{area.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="steps-section" aria-label="SANAD flow">
          {steps.map(([number, title, text]) => (
            <article className="step-row" data-reveal key={number}>
              <span>{number}</span>
              <strong>{title}</strong>
              <p>{text}</p>
            </article>
          ))}
        </section>

        <section className="rail-section" id="rail">
          <div className="section-head rail-head" data-reveal>
            <p className="kicker">Live contract rail</p>
            <h2>Submit, verify, fund, and settle from the same page.</h2>
            <p>{systemMessage}</p>
          </div>
          <div className="rail-console" data-reveal>
            <div className="rail-console-head">
              <div>
                <p className="kicker">Arc ops console</p>
                <h3>Request command room</h3>
              </div>
              <div className="console-metrics">
                <ConsoleMetric label="Network" value={`Arc ${ARC_TESTNET.chainId}`} />
                <ConsoleMetric label="Wallet" tone={wallet ? "live" : "idle"} value={wallet ? shortAddress(wallet) : "Disconnected"} />
                <ConsoleMetric label="Requests" tone={requests.length ? "live" : "idle"} value={String(requests.length)} />
                <ConsoleMetric label="Contract" tone={contractReady ? "live" : "alert"} value={contractReady ? "Online" : "Missing"} />
              </div>
            </div>
            <div className="rail-grid">
              <RequestBuilder addRequest={addRequest} contractReady={contractReady} isBusy={isBusy} wallet={wallet} />
              <section className="tool-panel selected-panel command-panel">
                <PanelHeader
                  icon={<ShieldCheck size={18} />}
                  eyebrow="Selected request"
                  title={selected?.memoId ?? "No request"}
                />
                {selected ? (
                  <>
                    <div className="selected-title command-title">
                      <div>
                        <span>{selected.category}</span>
                        <h3>{selected.title}</h3>
                      </div>
                      <StatusPill status={selected.status} />
                    </div>
                    <div className="fact-grid command-facts">
                      <InfoPair label="Provider" value={shortAddress(selected.providerAddress)} />
                      <InfoPair label="Amount" value={amountLabel(selected.amount, selected.token)} />
                      <InfoPair label="Funded" value={`${fundedPercent(selected)}%`} />
                      <InfoPair label="Deadline" value={selected.deadline} />
                    </div>
                    <FlowRail status={selected.status} />
                    <div className="request-switcher">
                      <span>Live queue</span>
                      <div className="request-list">
                        {requests.map((request) => (
                          <button
                            className={request.id === selectedId ? "request-pill active" : "request-pill"}
                            key={request.id}
                            onClick={() => setSelectedId(request.id)}
                            type="button"
                          >
                            {request.memoId}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="role-tabs">
                      {roles.map((item) => (
                        <button
                          className={role === item.id ? "role-tab active" : "role-tab"}
                          key={item.id}
                          onClick={() => setRole(item.id)}
                          type="button"
                        >
                          {item.icon}
                          {item.label}
                        </button>
                      ))}
                    </div>
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
                  </>
                ) : (
                  <div className="empty-state">
                    <FilePlus2 size={22} aria-hidden="true" />
                    <strong>No request loaded.</strong>
                    <p>Create a request or sync the contract.</p>
                  </div>
                )}
              </section>
              <ActivityPanel
                contractReady={contractReady}
                events={events}
                isLoading={isLoading}
                requestsCount={requests.length}
                selected={selected}
                wallet={wallet}
              />
            </div>
          </div>
        </section>

        <section className="proof-section" data-reveal id="proof">
          <PrivacyPanel selected={selected} setShowPrivate={setShowPrivate} showPrivate={showPrivate} />
          <ProofPanel copied={copied} copyText={copyText} proofPacket={proofPacket} selected={selected} />
        </section>

        <BlogSection metrics={metrics} requestsCount={requests.length} selected={selected} />

        <section className="resource-section arc-footer-section">
          <div className="arc-footer-shell" data-reveal>
            <div className="arc-footer-top">
              <div className="arc-footer-brand">
                <div className="arc-logo-mark">
                  <HeartPulse size={38} aria-hidden="true" />
                </div>
                <div>
                  <strong>SANAD</strong>
                  <span>Arc-native verified aid rail</span>
                </div>
              </div>
              <div className="arc-footer-summary">
                <p className="kicker">//project links</p>
                <h3>Source, proof, and updates for SANAD.</h3>
                <p>
                  A private aid settlement rail on Arc testnet. Source code, README, live demo,
                  and builder updates stay tied to the project.
                </p>
                <div className="footer-action-links">
                  <a href="https://github.com/aspro45/sanad" rel="noreferrer" target="_blank">
                    GitHub repo
                  </a>
                  <a href="https://x.com/ASPRO_22" rel="noreferrer" target="_blank">
                    ASPRO on X
                  </a>
                </div>
              </div>
            </div>
            <div className="arc-footer-bottom">
              <p>(c) 2026 SANAD Protocol. Built for Arc testnet research and public-good settlement demos.</p>
              <div>
                {footerLinks.map(([label, href]) => {
                  const isExternal = href.startsWith("http");
                  return (
                    <a
                      href={href}
                      key={label}
                      rel={isExternal ? "noreferrer" : undefined}
                      target={isExternal ? "_blank" : undefined}
                    >
                      {label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function BlogSection({
  metrics,
  requestsCount,
  selected,
}: {
  metrics: { funded: number; open: number; paid: number; requested: number };
  requestsCount: number;
  selected: AidRequest | null;
}) {
  const contractLabel = SANAD_CONTRACT_ADDRESS ? shortAddress(SANAD_CONTRACT_ADDRESS) : "not configured";
  const requestLabel = selected?.memoId ?? (requestsCount ? `${requestsCount} live requests` : "ready for first request");
  const facts = [
    ["Network", `Arc ${ARC_TESTNET.chainId}`],
    ["Contract", contractLabel],
    ["Live state", requestLabel],
    ["Funded", amountLabel(metrics.funded, "stable")],
  ];

  return (
    <section className="blog-section" data-reveal id="blog">
      <div className="blog-shell">
        <div className="blog-hero">
          <div>
            <p className="kicker">// protocol blog</p>
            <h2>SANAD turns private bills into verifiable provider payments.</h2>
          </div>
          <p>
            This is the project brief in plain language: what problem SANAD solves, why Arc is the
            right rail, how the contract moves state, and what a donor, verifier, provider, or
            builder can inspect before trusting the flow.
          </p>
        </div>

        <div className="blog-fact-strip" aria-label="SANAD blog facts">
          {facts.map(([label, value]) => (
            <span key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </span>
          ))}
        </div>

        <div className="blog-layout">
          <aside className="blog-aside">
            <span>Field note 001</span>
            <h3>Why this exists</h3>
            <p>
              SANAD is not trying to make aid more performative. It makes aid more operational:
              verify the need privately, move stablecoin transparently, and pay the real provider.
            </p>
            <div className="blog-link-stack">
              <a href="https://github.com/aspro45/sanad" rel="noreferrer" target="_blank">
                GitHub repo <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <a href={contractExplorerUrl()} rel="noreferrer" target="_blank">
                Arcscan contract <ArrowUpRight size={14} aria-hidden="true" />
              </a>
              <a href="#rail">
                Try live rail <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </div>
          </aside>

          <article className="blog-article">
            {blogChapters.map((chapter, index) => (
              <section className="blog-chapter" key={chapter.title}>
                <span>{String(index + 1).padStart(2, "0")} / {chapter.eyebrow}</span>
                <h3>{chapter.title}</h3>
                <p>{chapter.text}</p>
              </section>
            ))}
          </article>
        </div>

        <div className="blog-bottom-grid">
          <div className="blog-flow-card">
            <p className="kicker">Execution path</p>
            <div className="blog-flow-list">
              {blogFlow.map(([step, title, text]) => (
                <span key={step}>
                  <small>{step}</small>
                  <strong>{title}</strong>
                  <em>{text}</em>
                </span>
              ))}
            </div>
          </div>

          <div className="blog-security-card">
            <p className="kicker">Security posture</p>
            <h3>Public proof, private context, tested refund state.</h3>
            <ul>
              {blogSecurityNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p>
              SANAD is an Arc testnet public-good settlement demo. It is not a regulated financial
              product, and production deployment would need legal, compliance, and operational review.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProofBoard({
  metrics,
  selected,
}: {
  metrics: { funded: number; open: number; paid: number; requested: number };
  selected: AidRequest | null;
}) {
  const provider = selected ? shortAddress(selected.providerAddress) : "provider pending";
  const amount = selected ? amountLabel(selected.amount, selected.token) : "waiting";
  const proofNodes = [
    {
      detail: "Beneficiary creates the request without publishing the bill image.",
      label: "Bill sealed",
      meta: selected?.metadataHash ? shortAddress(selected.metadataHash) : "metadata pending",
      step: "01",
    },
    {
      detail: "Verifier approves only after offchain evidence review.",
      label: "Verifier hash",
      meta: selected?.verificationHash ? shortAddress(selected.verificationHash) : "review pending",
      step: "02",
    },
    {
      detail: "Donor funds the request with stablecoin escrow on Arc.",
      label: "Escrow state",
      meta: selected ? `${fundedPercent(selected)}% funded` : `${metrics.open} open`,
      step: "03",
    },
    {
      detail: "Provider receives payout when the request reaches funded state.",
      label: "Provider payout",
      meta: provider,
      step: "04",
    },
  ];
  const packetRows = [
    ["Memo", selected?.memoId ?? "waiting"],
    ["Provider", provider],
    ["Amount", amount],
    ["Metadata", selected?.metadataHash ? shortAddress(selected.metadataHash) : "hash pending"],
  ];

  return (
    <div className="proof-board" aria-label="Arc settlement route" data-reveal>
      <div className="proof-board-copy">
        <p className="kicker">Live proof route</p>
        <h3>{selected?.memoId ?? "SANAD rail ready"}</h3>
        <p>
          A stable public board for the parts that should be visible: memo ID, metadata hash,
          escrow state, and provider payout. Private evidence stays outside the page and outside
          public chain data.
        </p>
        <div className="proof-board-stats">
          <MiniStat label="Open" value={String(metrics.open)} />
          <MiniStat label="Paid" value={String(metrics.paid)} />
          <MiniStat label="Funded" value={amountLabel(metrics.funded, "stable")} />
        </div>
      </div>
      <div className="proof-lane" aria-label="Settlement steps">
        {proofNodes.map((node) => (
          <article className="proof-node" data-reveal key={node.step}>
            <span>{node.step}</span>
            <strong>{node.label}</strong>
            <p>{node.detail}</p>
            <small>{node.meta}</small>
          </article>
        ))}
      </div>
      <div className="proof-packet">
        <div className="proof-packet-intro">
          <LockKeyhole size={20} aria-hidden="true" />
          <div>
            <span>Redacted packet</span>
            <strong>Public trail, private hardship.</strong>
          </div>
        </div>
        <div className="packet-grid">
          {packetRows.map(([label, value]) => (
            <div className="packet-row" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ConsoleMetric({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "live" | "idle" | "alert";
  value: string;
}) {
  return (
    <div className={`console-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-pair">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill ${status.toLowerCase()}`}>{status}</span>;
}

function FlowRail({ status }: { status: Status }) {
  const current = statusIndex(status);
  return (
    <div className="flow-rail">
      {statusPath.map((item, index) => (
        <div className={index <= current ? "flow-stop active" : "flow-stop"} key={item}>
          <span />
          <small>{item}</small>
        </div>
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
  const [category, setCategory] = useState<Category>("Medical");
  const [token, setToken] = useState<SanadToken>("USDC");
  const buttonText = !contractReady
    ? "Contract missing"
    : !wallet
      ? "Connect wallet first"
      : isBusy
        ? "Sending"
        : "Submit private request";

  return (
    <form className="tool-panel request-form" onSubmit={addRequest}>
      <PanelHeader icon={<FilePlus2 size={18} />} eyebrow="Request desk" title="Create a private bill" />
      <div className="form-assurance">
        <span>
          <LockKeyhole size={15} aria-hidden="true" />
          Offchain evidence
        </span>
        <span>
          <Globe2 size={15} aria-hidden="true" />
          Arc memo hash
        </span>
      </div>
      <label>
        Bill title
        <input name="title" placeholder="Emergency medication invoice" required />
      </label>
      <div className="field-grid">
        <ChoicePicker label="Category" name="category" onChange={setCategory} options={allCategories} value={category} />
        <ChoicePicker label="Token" name="token" onChange={setToken} options={allTokens} value={token} />
      </div>
      <div className="field-grid">
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
        Provider wallet
        <input name="provider" placeholder="0xProviderWallet" required />
      </label>
      <label>
        Private note
        <textarea name="privateNote" placeholder="Evidence context for verifier. It stays offchain." rows={3} />
      </label>
      <button className="primary-link full" disabled={!contractReady || !wallet || isBusy} type="submit">
        <FilePlus2 size={17} aria-hidden="true" />
        {buttonText}
      </button>
    </form>
  );
}

function ChoicePicker<T extends string>({ label, name, onChange, options, value }: ChoicePickerProps<T>) {
  const [open, setOpen] = useState(false);

  return (
    <label className="choice-field">
      {label}
      <input name={name} type="hidden" value={value} />
      <button
        aria-expanded={open}
        className="choice-button"
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{value}</span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="choice-menu">
          {options.map((option) => (
            <button
              className={option === value ? "choice-option active" : "choice-option"}
              key={option}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </label>
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
  selected: AidRequest | null;
  setFundAmount: (value: string) => void;
  verifySelected: () => void | Promise<void>;
}) {
  if (!selected) {
    return (
      <div className="action-box">
        <strong>No request selected</strong>
        <p>Sync the contract or submit a request first.</p>
      </div>
    );
  }

  if (role === "verifier") {
    return (
      <div className="action-box">
        <p>{selected.privateNote}</p>
        <div className="button-pair">
          <button className="primary-link" disabled={isBusy || selected.status !== "Submitted"} onClick={verifySelected} type="button">
            <BadgeCheck size={17} aria-hidden="true" />
            Verify hash
          </button>
          <button className="danger-link" disabled={isBusy || selected.status !== "Submitted"} onClick={rejectSelected} type="button">
            <XCircle size={17} aria-hidden="true" />
            Reject
          </button>
        </div>
      </div>
    );
  }

  if (role === "donor") {
    return (
      <div className="action-box">
        <label>
          Fund amount
          <input min="0.000001" onChange={(event) => setFundAmount(event.target.value)} step="0.000001" type="number" value={fundAmount} />
        </label>
        <button
          className="primary-link full"
          disabled={isBusy || selected.funded >= selected.amount || !["Verified", "Funded"].includes(selected.status)}
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
      <div className="action-box">
        <p>Provider payout unlocks after the verified request reaches full escrow.</p>
        <button className="primary-link full" disabled={isBusy || selected.status !== "Funded"} onClick={paySelected} type="button">
          <Landmark size={17} aria-hidden="true" />
          Claim payout
        </button>
      </div>
    );
  }

  return (
    <div className="action-box">
      <p>The beneficiary never publishes invoice images. Arc stores memo IDs and hashes.</p>
      <CodeBlock copied={copied === "read"} label="Contract read" onCopy={() => copyText("read", readCall)} value={readCall} />
    </div>
  );
}

function ActivityPanel({
  contractReady,
  events,
  isLoading,
  requestsCount,
  selected,
  wallet,
}: {
  contractReady: boolean;
  events: EventLog[];
  isLoading: boolean;
  requestsCount: number;
  selected: AidRequest | null;
  wallet: string;
}) {
  const checks = [
    ["Contract", contractReady && SANAD_CONTRACT_ADDRESS ? shortAddress(SANAD_CONTRACT_ADDRESS) : "missing", contractReady],
    ["Wallet", wallet ? shortAddress(wallet) : "not connected", Boolean(wallet)],
    ["Arc sync", isLoading ? "reading" : `${requestsCount} loaded`, requestsCount > 0],
    ["Memo", selected?.memoId ?? "none selected", Boolean(selected)],
  ] as const;

  return (
    <section className="tool-panel activity-panel">
      <PanelHeader icon={<Activity size={18} />} eyebrow="Runtime trace" title="Operator log" />
      <div className="operator-checks">
        {checks.map(([label, value, ready]) => (
          <div className={ready ? "operator-check ready" : "operator-check"} key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="operator-next">
        <span>Next action</span>
        <strong>
          {!contractReady
            ? "Add contract address"
            : !wallet
              ? "Connect wallet"
              : selected
                ? `${selected.status} review`
                : "Create request"}
        </strong>
      </div>
      <div className="event-stack">
        {events.map((event) => (
          <div className="event-line" key={event.id}>
            <time>{event.time}</time>
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

function PrivacyPanel({
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
        ["Amount", amountLabel(selected.amount, selected.token)],
        ["Metadata", selected.metadataHash],
      ]
    : [
        ["Network", ARC_TESTNET.name],
        ["Contract", SANAD_CONTRACT_ADDRESS ? shortAddress(SANAD_CONTRACT_ADDRESS) : "missing"],
      ];
  const privateRows = selected
    ? [
        ["Beneficiary", selected.beneficiaryAddress],
        ["Evidence", `offchain-package-${selected.id}`],
        ["Context", selected.privateNote],
      ]
    : [
        ["Beneficiary", "none"],
        ["Evidence", "none"],
      ];

  return (
    <section className="tool-panel privacy-panel">
      <div className="panel-split">
        <PanelHeader icon={<LockKeyhole size={18} />} eyebrow="Privacy model" title="Public proof, private context" />
        <button className="secondary-link" onClick={() => setShowPrivate(!showPrivate)} type="button">
          {showPrivate ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          {showPrivate ? "Hide private" : "Reveal private"}
        </button>
      </div>
      <div className="privacy-grid">
        <VisibilityColumn icon={<Globe2 size={17} />} rows={publicRows} title="Visible on Arc" />
        <VisibilityColumn icon={<ShieldCheck size={17} />} locked={!showPrivate} rows={privateRows} title="Selective disclosure" />
      </div>
    </section>
  );
}

function ProofPanel({
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
    <section className="tool-panel proof-panel">
      <div className="panel-split">
        <PanelHeader icon={<BadgeCheck size={18} />} eyebrow="Proof packet" title={selected?.memoId ?? "No request selected"} />
        <button className="secondary-link" onClick={() => copyText("proof", proofPacket)} type="button">
          <Copy size={16} aria-hidden="true" />
          {copied === "proof" ? "Copied" : "Copy"}
        </button>
      </div>
      <CodeBlock copied={copied === "proof"} label="Arc proof packet" onCopy={() => copyText("proof", proofPacket)} value={proofPacket} />
    </section>
  );
}

function PanelHeader({ eyebrow, icon, title }: { eyebrow: string; icon: ReactNode; title: string }) {
  return (
    <div className="panel-head">
      <span className="panel-icon">{icon}</span>
      <div>
        <p className="kicker">{eyebrow}</p>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function VisibilityColumn({
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
    <div className={locked ? "visibility-column locked" : "visibility-column"}>
      <div className="visibility-head">
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

function CodeBlock({
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
    <div className="code-block">
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
