import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  HardDrive,
  Laptop,
  Menu,
  Radio,
  Sparkles,
  UserPlus,
  Wrench,
  X,
} from "lucide-react";
import Logo from "../components/Logo";
import LaptopStage from "../components/LaptopStage";
import LegalModal from "../components/LegalModal";
import { api } from "../api/api";
import { LOOKAHEAD_DAYS } from "../utils/helpers";

const DAY_MS = 864e5;

/* ------------------------------------------------------------------ */
/*  Time + availability helpers                                        */
/* ------------------------------------------------------------------ */
function startOfDay(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

const isLive = (loan) => !loan.cancelled && !loan.returned;

function busyNow(loan, at) {
  return isLive(loan) && +new Date(loan.start) <= at && at <= +new Date(loan.end);
}

function busyOnDay(loan, dayStart) {
  if (!isLive(loan)) return false;
  return +new Date(loan.start) < +dayStart + DAY_MS && +new Date(loan.end) > +dayStart;
}

function loanState(loan, at) {
  if (loan.cancelled) return "cancelled";
  if (loan.returned) return "returned";
  if (at < +new Date(loan.start)) return "upcoming";
  if (at <= +new Date(loan.end)) return "active";
  return "overdue";
}

function loanWindow(loan, dayStart) {
  const start = Math.max(+new Date(loan.start), +dayStart);
  const end = Math.min(+new Date(loan.end), +dayStart + DAY_MS);
  if (start <= +dayStart && end >= +dayStart + DAY_MS) return "All day";
  const time = (t) =>
    new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${time(start)} – ${time(end)}`;
}

const dayName = (offset, date) =>
  offset === 0
    ? "Today"
    : offset === 1
      ? "Tomorrow"
      : date.toLocaleDateString([], { weekday: "short" });

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */
const STEPS = [
  {
    id: "profile",
    number: "01",
    title: "Create your borrower profile",
    short: "One signup, tied to your student record.",
    meta: "One-time signup",
    icon: UserPlus,
    body: "Register with your name, student ID, program, year, and block. Your account is tied to your CSD record, so you never fill out the same form twice.",
    points: [
      "Student ID checked against the CSD roster",
      "One account for every reservation",
      "Open to CS, IT, and IS students",
    ],
  },
  {
    id: "reserve",
    number: "02",
    title: "Reserve the right machine",
    short: "Pick a laptop and a pick-up window.",
    meta: "Same day · class hours",
    icon: CalendarCheck,
    body: "Browse the live fleet, choose the machine that fits the work, and set your pick-up and return schedule. The system checks for conflicts before it confirms.",
    points: [
      "Live availability for every laptop",
      "Pick-up and return scheduling built in",
      "Instant conflict checks, no waiting",
    ],
  },
  {
    id: "return",
    number: "03",
    title: "Pick up, then return on time",
    short: "Track the loan from your dashboard.",
    meta: "At the CSD office",
    icon: Laptop,
    body: "Collect the laptop from the CSD office and keep an eye on your remaining time from the student dashboard. Return it on schedule so the next student can borrow it.",
    points: [
      "Loan countdown in your dashboard",
      "Manage or cancel upcoming reservations",
      "Late returns affect borrower standing",
    ],
  },
];

const DEMO_TABS = ["Live fleet", "Reserve", "Pick up"];

const MARQUEE = [
  "Live availability",
  "Same-day loans",
  "One-time signup",
  "Conflict-free reservations",
  "Pick up at the CSD office",
  "Admin oversight",
];

const FAQS = [
  {
    q: "Who can borrow a laptop?",
    a: "Any currently enrolled CSD student with an active account. Sign up once with your student details and you are in the system.",
  },
  {
    q: "How long can I keep it?",
    a: "One day per loan, inside class hours (9:00 AM – 4:00 PM, Mon–Fri). Pick up in the morning and return before the office closes."
  },
  {
    q: "Can I reserve for later?",
    a: "Yes. Pick an available laptop, choose your pick-up and return schedule, and the system holds it for you after checking for conflicts.",
  },
  {
    q: "What if I return it late?",
    a: "Late returns affect your borrower standing. The admin team can see overdue loans and follow up, so please return on time.",
  },
  {
    q: "Is there a fee?",
    a: "No. The program is free for enrolled CSD students. You only need an active student account.",
  },
];

/* ------------------------------------------------------------------ */
/*  Scroll reveal                                                      */
/* ------------------------------------------------------------------ */
function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("lp-in");
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add("lp-in");
          io.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={`lp-reveal ${className}`.trim()}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3D laptop stage                                                    */
/* ------------------------------------------------------------------ */
function LaptopHero({ laptops, loans, now, availableNow, theme }) {
  const [tab, setTab] = useState(0);

  return (
    <div className="lp-device-wrap">
      <div className="lp-stage-wrap">
        <LaptopStage tab={tab} laptops={laptops} loans={loans} now={now} theme={theme} />
        <div className="lp-float lp-float-a">
          <span className="lp-live-dot" />
          {availableNow} available now
        </div>
        <div className="lp-float lp-float-b">
          <CalendarClock size={14} /> Same-day loans
        </div>
      </div>

      <div className="lp-demo-tabs" role="group" aria-label="Preview the borrower dashboard">
        {DEMO_TABS.map((label, i) => (
          <button
            type="button"
            key={label}
            className={i === tab ? "is-active" : ""}
            aria-pressed={i === tab}
            onClick={() => setTab(i)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="lp-attribution">
        Laptop model by{" "}
        <a href="https://sketchfab.com/RaflyNaHa" target="_blank" rel="noreferrer">
          RaflyNaHa
        </a>{" "}
        · CC BY 4.0
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Fleet card                                                         */
/* ------------------------------------------------------------------ */
function FleetCard({ laptop, loan, dayStart, ctaHref }) {
  const status = laptop.maintenance ? "repair" : loan ? "busy" : "free";
  const label =
    status === "repair" ? "In repair" : status === "busy" ? "Booked" : "Available";

  return (
    <article className={`lp-fleet-card is-${status}`}>
      <div className="lp-fleet-top">
        <div className="lp-fleet-name">
          <p className="lp-fleet-tag">{laptop.tag}</p>
          <h3>{laptop.model}</h3>
        </div>
        <span className={`lp-chip ${status}`}>{label}</span>
      </div>

      <div className="lp-fleet-specs">
        <span>
          <Cpu size={14} /> {laptop.cpu}
        </span>
        <span>
          <HardDrive size={14} /> {laptop.ram} · {laptop.storage}
        </span>
      </div>

      <p className="lp-fleet-note">
        {status === "repair" ? (
          <>
            <Wrench size={13} /> Back in the fleet after servicing
          </>
        ) : status === "busy" ? (
          <>
            <Clock size={13} /> {loanWindow(loan, dayStart)}
          </>
        ) : (
          <>
            <CheckCircle2 size={13} /> Free for pick-up
          </>
        )}
      </p>

      {status !== "repair" && (
        <a className="lp-btn lp-btn-ghost lp-btn-sm lp-fleet-cta" href={ctaHref}>
          Reserve <ArrowRight size={14} />
        </a>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing                                                            */
/* ------------------------------------------------------------------ */
export default function Landing({ onEnter }) {
  const [laptops, setLaptops] = useState([]);
  const [loans, setLoans] = useState([]);
  const theme = "dark";
  const [now, setNow] = useState(Date.now());
  const [dayOffset, setDayOffset] = useState(() => {
    let offset = 0;
    while ([0, 6].includes(startOfDay(offset).getDay())) offset++;
    return offset;
  });
  const [step, setStep] = useState(0);
  const [faqOpen, setFaqOpen] = useState(0);
  const [legalDoc, setLegalDoc] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dataError, setDataError] = useState("");
  const menuBtnRef = useRef(null);

  const [session] = useState(() => {
    try {
      const raw = localStorage.getItem("csd_session");
      const session = raw ? JSON.parse(raw) : null;
      return session?.token ? session : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let alive = true;
    Promise.all([api.getLaptops(), api.getLoans()])
      .then(([l, b]) => {
        if (!alive) return;
        setLaptops(l);
        setLoans(b);
      })
      .catch((error) => {
        if (alive) setDataError(error.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const dayStart = useMemo(() => startOfDay(dayOffset), [dayOffset]);
  // Weekends are closed, so the picker lists the next class days only.
  const classDays = useMemo(() => {
    const days = [];
    let offset = 0;
    while (days.length < LOOKAHEAD_DAYS) {
      const date = startOfDay(offset);
      if (date.getDay() !== 0 && date.getDay() !== 6) days.push({ offset, date });
      offset++;
    }
    return days;
  }, []);
  const ctaHref = session ? "#dashboard" : "#signup";

  const busyNowIds = useMemo(
    () => new Set(loans.filter((l) => busyNow(l, now)).map((l) => l.laptopId)),
    [loans, now]
  );
  const busyDayIds = useMemo(
    () => new Set(loans.filter((l) => busyOnDay(l, dayStart)).map((l) => l.laptopId)),
    [loans, dayStart]
  );

  const availableNow = laptops.filter(
    (lp) => !lp.maintenance && !busyNowIds.has(lp.id)
  ).length;
  const availableForDay = laptops.filter(
    (lp) => !lp.maintenance && !busyDayIds.has(lp.id)
  ).length;

  const dayLoanFor = (laptopId) =>
    loans.find((l) => l.laptopId === laptopId && busyOnDay(l, dayStart));

  const goLogin = () => {
    setMenuOpen(false);
    if (session) onEnter(session);
    else onEnter();
  };

  const onStepKey = (e, i) => {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    let next = i;
    if (e.key === "ArrowDown" || e.key === "ArrowRight")
      next = (i + 1) % STEPS.length;
    if (e.key === "ArrowUp" || e.key === "ArrowLeft")
      next = (i - 1 + STEPS.length) % STEPS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = STEPS.length - 1;
    setStep(next);
    document.getElementById(`step-tab-${STEPS[next].id}`)?.focus();
  };

  const toTop = () =>
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });

  const activeStep = STEPS[step];
  const StepIcon = activeStep.icon;

  return (
    <div className="lp" id="home" data-theme={theme}>
      <a className="lp-skip" href="#main">
        Skip to content
      </a>

      {/* ============================== NAV ============================== */}
      <nav className={`lp-nav ${scrolled ? "is-scrolled" : ""}`} aria-label="Main">
        <div className="lp-nav-inner">
          <a className="lp-brand" href="#home" aria-label="CSD Laptop Borrowing home">
            <Logo size={30} />
            <span>
              <span className="lp-brand-name">CSD</span>
              <span className="lp-brand-sub">Laptop Borrowing</span>
            </span>
          </a>

          <div className="lp-links">
            <a href="#how">How it works</a>
            <a href="#fleet">The fleet</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="lp-nav-actions">
            <button type="button" className="lp-login" onClick={goLogin}>
              {session ? "My dashboard" : "Log in"}
            </button>

            <a className="lp-btn lp-btn-primary lp-btn-sm" href={ctaHref}>
              {session ? "My dashboard" : "Get started"}
            </a>

            <button
              ref={menuBtnRef}
              type="button"
              className="lp-icon-btn lp-menu-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-controls="lp-mobile-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lp-mobile" id="lp-mobile-menu">
            <div className="lp-mobile-links">
              {[
                ["How it works", "#how"],
                ["The fleet", "#fleet"],
                ["FAQ", "#faq"],
              ].map(([label, href]) => (
                <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                  {label}
                  <ArrowRight size={15} />
                </a>
              ))}
            </div>
            <div className="lp-mobile-actions">
              <button type="button" className="lp-btn lp-btn-ghost" onClick={goLogin}>
                {session ? "My dashboard" : "Log in"}
              </button>
              <a
                className="lp-btn lp-btn-primary"
                href={ctaHref}
                onClick={() => setMenuOpen(false)}
              >
                {session ? "My dashboard" : "Get started"}
              </a>
            </div>
          </div>
        )}
      </nav>

      {dataError && <p className="lpf-form-error" role="alert">{dataError}</p>}

      <main id="main" tabIndex={-1}>
        {/* ============================== HERO ============================== */}
        <header className="lp-hero">
          <div className="lp-hero-grid" aria-hidden="true" />
          <Logo size={620} className="lp-watermark" />
          <div className="lp-hero-inner">
            <div className="lp-hero-copy">
              <Reveal>
                <span className="lp-status">
                  <span className="lp-status-dot" />
                  {laptops.length
                    ? `Live fleet · ${availableNow} of ${laptops.length} available`
                    : "Connecting to the live fleet"}
                </span>
              </Reveal>

              <Reveal delay={70}>
                <h1 className="lp-h1">
                  Borrow smart,
                  <span className="lp-h1-line">
                    code <em>anywhere.</em>
                  </span>
                </h1>
              </Reveal>

              <Reveal delay={140}>
                <p className="lp-lead">
                  The official CSD laptop borrowing system. Register once, reserve
                  a machine, choose your pick-up and return dates, and track every
                  loan from one dashboard.
                </p>
              </Reveal>

              <Reveal delay={210}>
                <div className="lp-hero-cta">
                  <a className="lp-btn lp-btn-primary" href={ctaHref}>
                    Reserve a laptop <ArrowRight size={16} />
                  </a>
                  <a className="lp-btn lp-btn-ghost" href="#fleet">
                    Explore the fleet
                  </a>
                </div>
              </Reveal>

              <Reveal delay={280}>
                <div className="lp-hero-stats">
                  <div>
                    <strong>{laptops.length || "—"}</strong>
                    <span>Machines in the fleet</span>
                  </div>
                  <div>
                    <strong>{availableNow}</strong>
                    <span>Available right now</span>
                  </div>
                  <div>
                    <strong>Same day</strong>
                    <span>Longest loan period</span>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={340}>
                <div className="lp-trust">
                  <span className="lp-trust-label">Built for</span>
                  <span>BS Computer Science</span>
                  <span>BS Information Technology</span>
                  <span>BS Information Systems</span>
                  <span>BS IT Animation</span>
                </div>
              </Reveal>
            </div>

            <Reveal delay={160} className="lp-hero-visual">
              <LaptopHero
                laptops={laptops}
                loans={loans}
                now={now}
                availableNow={availableNow}
                theme={theme}
              />
            </Reveal>
          </div>
        </header>

        {/* ============================ MARQUEE ============================ */}
        <div className="lp-marquee" aria-hidden="true">
          <div className="lp-marquee-track">
            {[0, 1].map((group) => (
              <div className="lp-marquee-group" key={group}>
                {MARQUEE.map((item) => (
                  <span key={`${group}-${item}`}>
                    <Sparkles size={13} /> {item}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* =========================== HOW IT WORKS ========================= */}
        <section className="lp-section" id="how">
          <Reveal>
            <div className="lp-head">
              <div>
                <p className="lp-eyebrow">
                  <span>01</span> How it works
                </p>
                <h2 className="lp-h2">
                  From signup to <em>pick-up.</em>
                </h2>
              </div>
              <p className="lp-head-lead">
                Three steps, one account, zero paper forms. Most students finish a
                reservation in under five minutes.
              </p>
            </div>
          </Reveal>

          <div className="lp-steps">
            <div
              className="lp-steps-rail"
              role="tablist"
              aria-label="How laptop borrowing works"
              aria-orientation="vertical"
            >
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  id={`step-tab-${s.id}`}
                  aria-selected={step === i}
                  aria-controls={`step-panel-${s.id}`}
                  tabIndex={step === i ? 0 : -1}
                  className={`lp-step-btn ${step === i ? "is-active" : ""}`}
                  onClick={() => setStep(i)}
                  onKeyDown={(e) => onStepKey(e, i)}
                >
                  <span className="lp-step-num">{s.number}</span>
                  <span className="lp-step-copy">
                    <strong>{s.title}</strong>
                    <span>{s.short}</span>
                  </span>
                  <ArrowRight size={16} className="lp-step-arrow" />
                </button>
              ))}
            </div>

            <div
              className="lp-step-panel"
              role="tabpanel"
              id={`step-panel-${activeStep.id}`}
              aria-labelledby={`step-tab-${activeStep.id}`}
              key={activeStep.id}
            >
              <span className="lp-step-ghost" aria-hidden="true">
                {activeStep.number}
              </span>
              <div className="lp-step-icon">
                <StepIcon size={22} />
              </div>
              <p className="lp-step-kicker">
                Step {activeStep.number} · {activeStep.meta}
              </p>
              <h3>{activeStep.title}</h3>
              <p className="lp-step-body">{activeStep.body}</p>
              <ul className="lp-check-list">
                {activeStep.points.map((point) => (
                  <li key={point}>
                    <Check size={14} /> {point}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ============================== FLEET ============================== */}
        <section className="lp-fleet-band" id="fleet">
          <div className="lp-section">
            <Reveal>
              <div className="lp-head">
                <div>
                  <p className="lp-eyebrow">
                    <span>02</span> The fleet
                  </p>
                  <h2 className="lp-h2">
                    Meet the <em>machines.</em>
                  </h2>
                </div>
                <p className="lp-head-lead">
                  Every unit is checked before it goes out. Pick a day to see what
                  is free, then reserve the one that fits the work.
                </p>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <div className="lp-daybar">
                <div className="lp-daybar-head">
                  <p className="lp-daybar-label">Plan ahead</p>
                  <p className="lp-daybar-summary" aria-live="polite">
                    <strong>{availableForDay}</strong> of {laptops.length || "—"}{" "}
                    free on{" "}
                    {dayStart.toLocaleDateString([], {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <div
                  className="lp-daypicker"
                  role="group"
                  aria-label="Choose a day to check availability"
                >
                  {classDays.map(({ offset, date: d }) => {
                    const active = offset === dayOffset;
                    return (
                      <button
                        type="button"
                        key={offset}
                        className={active ? "is-active" : ""}
                        aria-pressed={active}
                        aria-label={d.toLocaleDateString([], {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                        onClick={() => setDayOffset(offset)}
                      >
                        <span>{dayName(offset, d)}</span>
                        <strong>{d.getDate()}</strong>
                        <span>{d.toLocaleDateString([], { month: "short" })}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Reveal>

            {laptops.length === 0 ? (
              <p className="lp-empty" role="status">
                Loading the live fleet…
              </p>
            ) : (
              <div className="lp-fleet-grid">
                {laptops.map((lp, i) => (
                  <Reveal key={lp.id} delay={Math.min(i * 50, 250)}>
                    <FleetCard
                      laptop={lp}
                      loan={dayLoanFor(lp.id)}
                      dayStart={dayStart}
                      ctaHref={ctaHref}
                    />
                  </Reveal>
                ))}
              </div>
            )}

            <Reveal delay={100}>
              <p className="lp-fleet-foot">
                <Radio size={14} /> Availability comes from the same records the
                CSD office uses. Maintenance units are excluded.
              </p>
            </Reveal>
          </div>
        </section>

        {/* =============================== FAQ =============================== */}
        <section className="lp-section lp-faq-section" id="faq">
          <Reveal>
            <div className="lp-head">
              <div>
                <p className="lp-eyebrow">
                  <span>03</span> FAQ
                </p>
                <h2 className="lp-h2">
                  Questions, <em>answered.</em>
                </h2>
              </div>
              <p className="lp-head-lead">
                Everything you need to know before your first reservation.
              </p>
            </div>
          </Reveal>

          <div className="lp-faq-list-wrap">
            <ul className="lp-faq-list">
              {FAQS.map((item, i) => {
                const open = faqOpen === i;
                return (
                  <li key={item.q} className={`lp-faq-item ${open ? "is-open" : ""}`}>
                    <h3>
                      <button
                        type="button"
                        id={`faq-btn-${i}`}
                        className="lp-faq-btn"
                        aria-expanded={open}
                        aria-controls={`faq-panel-${i}`}
                        onClick={() => setFaqOpen(open ? -1 : i)}
                      >
                        <span className="lp-faq-num">{String(i + 1).padStart(2, "0")}</span>
                        <span className="lp-faq-q">{item.q}</span>
                        <ChevronDown size={18} className="lp-faq-chevron" />
                      </button>
                    </h3>
                    <div
                      id={`faq-panel-${i}`}
                      className="lp-faq-a"
                      role="region"
                      aria-labelledby={`faq-btn-${i}`}
                    >
                      <p>{item.a}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>

      {/* ============================== FOOTER ============================== */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-top">
            <div className="lp-footer-copy">
              <h2 className="lp-footer-title">
                From our desk{" "}
                <br />
                to <em>yours.</em>
              </h2>
              <p className="lp-footer-lead">
                Borrow a laptop for a day (class hours), free for CSD
                students. Pick it up at the office and return it before closing.
              </p>
              <div className="lp-footer-actions">
                <a className="lp-btn lp-btn-pink" href={ctaHref}>
                  {session ? "My dashboard" : "Get started"}
                </a>
                <button
                  type="button"
                  className="lp-footer-login"
                  onClick={goLogin}
                >
                  {session ? "Open your dashboard" : "Log in to your account"}
                </button>
              </div>
            </div>

            <div className="lp-footer-live-panel">
              <p className="lp-footer-live-label">
                <span className="lp-live-dot" aria-hidden="true" />
                Free right now
              </p>
              <p className="lp-footer-live-count" role="status">
                {laptops.length ? availableNow : "—"}{" "}
                {laptops.length > 0 && <span>of {laptops.length}</span>}
              </p>
              <p className="lp-footer-live-note">
                {laptops.length
                  ? "laptops ready to borrow"
                  : "Checking the live fleet…"}
              </p>

              <dl className="lp-footer-facts">
                <div>
                  <dt>Loan period</dt>
                  <dd>Same day, 9 AM – 4 PM</dd>
                </div>
                <div>
                  <dt>Pick up &amp; return</dt>
                  <dd>CSD office</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="lp-footer-info">
            <div className="lp-footer-brand-col">
              <a className="lp-footer-brand" href="#home" aria-label="CSD Laptop Borrowing home">
                <Logo size={34} />
                <span>
                  <strong>CSD Laptop Borrowing</strong>
                  <span>Laptop access for CSD students.</span>
                </span>
              </a>
            </div>

            <div className="lp-footer-col">
              <h3>Visit</h3>
              <p className="lp-footer-muted">Computer Studies Department</p>
              <p className="lp-footer-muted">CSD Office</p>
              <p className="lp-footer-muted">Mon–Fri, 9:00 AM – 4:00 PM</p>
            </div>

            <div className="lp-footer-col">
              <h3>Explore</h3>
              <a href="#how">How it works</a>
              <a href="#fleet">The fleet</a>
              <a href="#faq">FAQ</a>
              <a href="#signup">Get started</a>
            </div>

            <div className="lp-footer-col">
              <h3>Programs</h3>
              <p className="lp-footer-muted">BS Computer Science</p>
              <p className="lp-footer-muted">BS Information Technology</p>
              <p className="lp-footer-muted">BS Information Systems</p>
              <p className="lp-footer-muted">BS IT Animation</p>
            </div>
          </div>

          <div className="lp-footer-bottom">
            <p className="lp-footer-copyright">© {new Date().getFullYear()} CSD Laptop Borrowing</p>
            <div className="lp-footer-legal">
              <button type="button" onClick={() => setLegalDoc("terms")}>
                Terms &amp; Conditions
              </button>
              <button type="button" onClick={() => setLegalDoc("privacy")}>
                Privacy Policy
              </button>
              <button type="button" onClick={toTop}>
                Back to top
              </button>
            </div>
            <p className="lp-footer-tagline">Built for CS, IT &amp; IS students.</p>
          </div>
        </div>
      </footer>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}
