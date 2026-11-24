import { useEffect, useState } from "react";
import {
  Home, Laptop, CalendarCheck, History, User, LogOut, ArrowLeft,
  Menu, Timer, Hourglass, Package, Cpu, HardDrive, Pencil, RefreshCw,
  Search, ArrowRight, Inbox, CalendarClock,
} from "lucide-react";
import { api } from "../api/api";
import { H, fmt, short, statusOf, left, greeting, PROGRAMS, YEARS, BLOCKS } from "../utils/helpers";
import Logo from "../components/Logo";
import Stat from "../components/Stat";
import LoanList from "../components/LoanList";
import ReserveModal from "../components/ReserveModal";
import Notifications from "../components/Notifications";
import Toast from "../components/Toast";

const NAV = [
  ["Main", [["home", "Home", Home], ["laptops", "Laptops", Laptop]]],
  ["Tracking", [["reservations", "Reservations", CalendarCheck], ["history", "History", History]]],
  ["Account", [["profile", "My Profile", User]]],
];
const TITLES = { home: "Student Home", laptops: "Laptops", reservations: "My Reservations", history: "History", profile: "My Profile" };
const SUBTITLES = {
  home: "Your loans at a glance",
  laptops: "Browse and reserve a machine",
  reservations: "Active and upcoming",
  history: "Returned and cancelled",
  profile: "Account details",
};

export default function StudentDashboard({ onExit, onBack }) {
  const theme = "dark";
  const [student, setStudent] = useState(null);
  const [laptops, setLaptops] = useState([]);
  const [loans, setLoans] = useState([]);
  const [view, setView] = useState("home");
  const [menu, setMenu] = useState(false);
  const [picked, setPicked] = useState(null);
  const [onlyFree, setOnlyFree] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToastState] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [scrolled, setScrolled] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(null);
  const [profileErrors, setProfileErrors] = useState({});
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [pwForm, setPwForm] = useState({ current: "", next: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  const setToast = (message, tone = "ok") => setToastState(message ? { message, tone } : null);

  const load = async () => {
    try {
      const [s, l, b] = await Promise.all([api.getStudent(), api.getLaptops(), api.getLoans()]);
      setStudent(s); setLaptops(l); setLoans(b);
      setLoadError("");
      return true;
    } catch (error) {
      setLoadError(error.message);
      return false;
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(Date.now()), 60000);
    // Keep the dashboard fresh so admin approvals appear without a reload.
    const poll = setInterval(load, 60000);
    return () => {
      clearInterval(t);
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  if (!student) {
    return (
      <div className="csd csd-loading" data-theme={theme}>
        {loadError ? (
          <>
            <p role="alert">{loadError}</p>
            <button className="csd-pill" onClick={load}>Try again</button>
            <button className="csd-ghost" onClick={onBack}>Back to site</button>
          </>
        ) : (
          <>
            <div className="csd-loading-spinner" />
            <p>Loading your dashboard…</p>
          </>
        )}
      </div>
    );
  }

  const go = (v) => { setView(v); setMenu(false); setSearch(""); };
  const cancel = async (id) => {
    try {
      await api.cancelLoan(id);
      const refreshed = await load();
      setToast(refreshed ? "Reservation cancelled" : "Reservation cancelled, but the dashboard could not refresh.");
    } catch (error) {
      setToast(error.message, "error");
    }
  };
  const mine = loans
    .filter((l) => l.studentId === student.id)
    .sort((a, b) => +new Date(b.start) - +new Date(a.start));
  const st = (l) => statusOf(l, now);
  // A loan past its return time is still in the student's hands, so it counts as current.
  const active = mine.find((l) => ["active", "overdue"].includes(st(l)));
  const isOverdue = Boolean(active) && st(active) === "overdue";
  const pending = mine.filter((l) => st(l) === "pending");
  const upcoming = mine.filter((l) => st(l) === "upcoming");
  const past = mine.filter((l) => ["returned", "cancelled"].includes(st(l)));
  const borrowedCount = mine.filter((l) => ["active", "overdue", "returned"].includes(st(l))).length;
  const nameOf = (id) => laptops.find((l) => l.id === id);
  const modelOf = (id) => nameOf(id)?.model || "Laptop";
  // Any loan still holding the laptop — mine or another student's, now or
  // later. The API rejects overlapping requests against all of these, so the
  // cards must not offer a Reserve button they will refuse.
  const heldFor = (lp) => loans.find((l) => l.laptopId === lp.id && !l.cancelled && !l.returned);
  const currentFor = (lp) => mine.find((l) => l.laptopId === lp.id && ["active", "overdue"].includes(st(l)));
  const pendingFor = (lp) => mine.find((l) => l.laptopId === lp.id && st(l) === "pending");
  const progress = active
    ? Math.min(100, Math.max(0, ((now - +new Date(active.start)) / (+new Date(active.end) - +new Date(active.start))) * 100))
    : 0;
  const lowTime = active && +new Date(active.end) - now < 2 * H;
  const first = student.name.split(" ")[0];

  const notifications = pending.map((l) => ({
    id: `pending-${l.id}`,
    tone: "warn",
    title: "Waiting for admin confirmation",
    body: `${modelOf(l.laptopId)} · ${fmt(l.start)}`,
  }));
  if (active) {
    notifications.push({
      id: `current-${active.id}`,
      tone: isOverdue ? "danger" : "ok",
      title: isOverdue ? "Loan overdue" : "Laptop checked out to you",
      body: isOverdue ? `Return immediately · was due ${fmt(active.end)}` : `Return by ${fmt(active.end)}`,
    });
  }

  const startEditProfile = () => {
    setProfileForm({
      name: student.name,
      address: student.address || "",
      contact: student.contact || "",
      program: student.program,
      year: student.year,
      block: student.block,
    });
    setProfileError("");
    setProfileErrors({});
    setEditingProfile(true);
  };
  const setProfile = (k) => (e) => {
    setProfileForm((p) => ({ ...p, [k]: e.target.value }));
    setProfileErrors((p) => ({ ...p, [k]: "" }));
  };
  const saveProfile = async (e) => {
    e.preventDefault();
    const found = {};
    if (String(profileForm.name).trim().length < 3) found.name = "Enter your full name.";
    if (!/^(09|\+639)\d{9}$/.test(String(profileForm.contact).replace(/[\s-]/g, ""))) {
      found.contact = "Use a valid mobile number, e.g. 0917 123 4567.";
    }
    if (String(profileForm.address).trim().length < 5) found.address = "Enter your complete address.";
    setProfileErrors(found);
    if (Object.keys(found).length) return;

    setProfileSaving(true);
    setProfileError("");
    try {
      const updated = await api.updateProfile(profileForm);
      setStudent(updated);
      setEditingProfile(false);
      setToast("Profile updated");
    } catch (error) {
      setProfileError(error.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwError("");
    if (pwForm.next.length < 12) {
      setPwError("Choose a password with at least 12 characters.");
      return;
    }
    setPwSaving(true);
    try {
      await api.changePassword(pwForm.current, pwForm.next);
      setPwForm({ current: "", next: "" });
      setToast("Password updated");
    } catch (error) {
      setPwError(error.message);
    } finally {
      setPwSaving(false);
    }
  };

  const markReturned = async () => {
    if (!active) return;
    try {
      await api.returnLoan(active.id);
      setToast("Return recorded");
      await load();
    } catch (error) {
      setToast(error.message, "error");
    }
  };

  const filteredLaptops = laptops.filter((lp) => {
    if (onlyFree && (lp.maintenance || heldFor(lp))) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        lp.model.toLowerCase().includes(q) ||
        lp.tag.toLowerCase().includes(q) ||
        lp.cpu.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="csd" data-theme={theme}>
      <div className={`csd-scrim ${menu ? "open" : ""}`} onClick={() => setMenu(false)} />

      <aside className={`csd-aside ${menu ? "open" : ""}`}>
        <div className="csd-brand">
          <Logo size={42} />
          <div>
            <p className="csd-brand-name">CSD LAPTOPS</p>
            <p className="csd-brand-sub">Student Portal</p>
          </div>
        </div>
        <nav className="csd-navwrap">
          {NAV.map(([group, items]) => (
            <div key={group}>
              <p className="csd-group">{group}</p>
              {items.map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={`csd-nav ${view === id ? "on" : ""}`}
                  onClick={() => go(id)}
                  aria-current={view === id ? "page" : undefined}
                >
                  <Icon size={18} /> {label}
                  {id === "home" && pending.length > 0 && (
                    <span className="csd-nav-badge">{pending.length}</span>
                  )}
                  {id === "reservations" && upcoming.length > 0 && (
                    <span className="csd-nav-badge">{upcoming.length}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="csd-foot">
          <button className="csd-nav" onClick={onBack}><ArrowLeft size={18} /> Back to Site</button>
          <button className="csd-nav" onClick={onExit}><LogOut size={18} /> Sign Out</button>
        </div>
      </aside>

      <div className="csd-body">
        <header className={`csd-top ${scrolled ? "is-scrolled" : ""}`}>
          <div className="csd-top-left">
            <button className="csd-burger" onClick={() => setMenu(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <div className="csd-top-titles">
              <h1 className="csd-display csd-page-title">{TITLES[view]}</h1>
              <p className="csd-top-sub">{SUBTITLES[view]}</p>
            </div>
          </div>
          <div className="csd-top-right">
            <button
              className="csd-iconbtn"
              aria-label="Refresh dashboard"
              onClick={() => { setNow(Date.now()); load(); }}
            >
              <RefreshCw size={16} />
            </button>
            <Notifications items={notifications} />
            <div className="csd-user">
              <p className="csd-user-name">{student.name}</p>
              <p className="csd-user-role">Student</p>
            </div>
            <div className="csd-avatar">{first[0]}</div>
          </div>
        </header>

        <main className="csd-main">
          {loadError && <p className="csd-toast" role="alert">{loadError}</p>}
          {view === "home" && (
            <>
              <section className="csd-hero">
                <div className="csd-hero-orb" aria-hidden="true" />
                <div className="csd-hero-copy">
                  <p className="csd-eyebrow">
                    {greeting()} · {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                  <h2 className="csd-hero-title">
                    Welcome back, <span>{first}</span>
                  </h2>
                  <p className="csd-hero-sub">Borrow smart, return on time.</p>
                </div>
                <div className={`csd-badge ${active ? "is-active" : ""}`}>
                  <span className="csd-badge-dot" />
                  <div>
                    <p className="csd-badge-label">
                      {active ? (isOverdue ? "Loan overdue" : "Active borrower") : "No active loan"}
                    </p>
                    <p className="csd-badge-value">
                      {active ? modelOf(active.laptopId) : "Ready to reserve"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="csd-current">
                <div className="csd-current-icon"><Laptop size={22} /></div>
                <div className="csd-current-body">
                  <p className="csd-eyebrow-sm">Current loan</p>
                  <p className="csd-current-name">
                    {active
                      ? `${modelOf(active.laptopId)} · ${isOverdue ? "overdue since" : "return by"} ${fmt(active.end)}`
                      : "You have no laptop right now."}
                  </p>
                  {active && (
                    <div className="csd-progress">
                      <div className="csd-progress-track">
                        <div
                          className={`csd-progress-fill ${lowTime ? "is-low" : ""}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="csd-progress-text">{isOverdue ? "Return overdue" : `${Math.round(progress)}% used`}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {active && (
                    <button className="csd-ghost" onClick={markReturned}>
                      Mark returned
                    </button>
                  )}
                  <button className="csd-pill" onClick={() => go("laptops")}>
                    Reserve laptop <ArrowRight size={14} />
                  </button>
                </div>
              </section>

              <section className="csd-stats">
                <Stat
                  label="Laptop in use"
                  value={active ? modelOf(active.laptopId) : "None"}
                  sub={active ? nameOf(active.laptopId)?.tag : "Nothing borrowed"}
                  icon={Laptop}
                />
                <Stat
                  label="Time left"
                  value={active ? (isOverdue ? "Overdue" : left(active.end, now)) : "—"}
                  sub={active ? `Until ${short(active.end)}` : "No active loan"}
                  icon={Timer}
                  tone="red"
                  danger={lowTime}
                />
                <Stat label="Upcoming" value={upcoming.length} sub={pending.length ? `${pending.length} awaiting approval` : "Confirmed"} icon={Hourglass} />
                <Stat label="Total borrowed" value={borrowedCount} sub="This semester" icon={Package} tone="green" />
              </section>

              <section>
                <header className="csd-section-head">
                  <h2 className="csd-section-title">Upcoming reservations</h2>
                  {upcoming.length > 0 && <span className="csd-count">{upcoming.length}</span>}
                </header>
                <LoanList
                  loans={upcoming.slice(0, 3)}
                  nameOf={nameOf}
                  st={st}
                  onCancel={cancel}
                  empty="No confirmed reservations yet. Reserve a laptop to get started."
                  emptyIcon={CalendarClock}
                  emptyAction={{ label: "Browse laptops", onClick: () => go("laptops") }}
                />
              </section>

              {pending.length > 0 && (
                <section>
                  <header className="csd-section-head">
                    <h2 className="csd-section-title">Awaiting admin confirmation</h2>
                    <span className="csd-count">{pending.length}</span>
                  </header>
                  <p className="csd-dim" style={{ fontSize: 12, marginBottom: 10 }}>
                    These requests appear in Reservations once the CSD office confirms them.
                  </p>
                  <LoanList
                    loans={pending}
                    nameOf={nameOf}
                    st={st}
                    onCancel={cancel}
                    empty=""
                  />
                </section>
              )}
            </>
          )}

          {view === "laptops" && (
            <section>
              <div className="csd-filterbar">
                <div className="csd-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by model, tag, or CPU…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <label className="csd-toggle">
                  <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />
                  <span className="csd-toggle-track"><span className="csd-toggle-thumb" /></span>
                  <span className="csd-toggle-label">Available now only</span>
                </label>
              </div>

              {filteredLaptops.length === 0 ? (
                <div className="csd-empty">
                  <div className="csd-empty-icon"><Inbox size={28} /></div>
                  <p className="csd-empty-title">No laptops match your filters</p>
                  <p className="csd-empty-sub">Try clearing the search or turning off “Available now only”.</p>
                  <button className="csd-ghost" onClick={() => { setSearch(""); setOnlyFree(false); }}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <ul className="csd-grid2">
                  {filteredLaptops.map((lp) => {
                    const current = currentFor(lp);
                    const requested = pendingFor(lp);
                    const held = heldFor(lp);
                    const chipClass = lp.maintenance
                      ? "returned"
                      : current
                        ? (st(current) === "overdue" ? "overdue" : "active")
                        : requested
                          ? "pending"
                          : held
                            ? "upcoming"
                            : "free";
                    const chipLabel = lp.maintenance
                      ? "In repair"
                      : current
                        ? "Your loan"
                        : requested
                          ? "Awaiting approval"
                          : held
                            ? (["active", "overdue"].includes(st(held)) ? "Borrowed" : "Reserved")
                            : "Available";
                    return (
                      <li key={lp.id} className="csd-laptop">
                        <div className="csd-laptop-head">
                          <div className="min-w-0">
                            <h3 className="csd-laptop-model">{lp.model}</h3>
                            <p className="csd-laptop-tag">{lp.tag}</p>
                          </div>
                          <span className={`csd-chip ${chipClass}`}>{chipLabel}</span>
                        </div>
                        <div className="csd-laptop-specs">
                          <span><Cpu size={14} /> {lp.cpu}</span>
                          <span><HardDrive size={14} /> {lp.ram} · {lp.storage}</span>
                        </div>
                        {current ? (
                          <p className="csd-laptop-note">
                            {st(current) === "overdue"
                              ? `Overdue · was due ${fmt(current.end)}`
                              : `Yours until ${fmt(current.end)}`}
                          </p>
                        ) : requested ? (
                          <p className="csd-laptop-note">Waiting for admin confirmation</p>
                        ) : held ? (
                          <p className="csd-laptop-note">Back on {fmt(held.end)}</p>
                        ) : null}
                        {current ? (
                          <button className="csd-pill" disabled>Borrowed by you</button>
                        ) : requested ? (
                          <button className="csd-ghost" onClick={() => cancel(requested.id)}>Withdraw request</button>
                        ) : (
                          <button className="csd-pill" disabled={lp.maintenance} onClick={() => setPicked(lp)}>
                            {held ? "Reserve for later" : "Reserve"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          {view === "reservations" && (
            <section>
              <header className="csd-section-head">
                <h2 className="csd-section-title">Active & upcoming</h2>
                <span className="csd-count">{active ? upcoming.length + 1 : upcoming.length}</span>
              </header>
              <LoanList
                loans={[...(active ? [active] : []), ...upcoming]}
                nameOf={nameOf}
                st={st}
                onCancel={cancel}
                empty="You have no active or upcoming reservations."
                emptyIcon={CalendarClock}
                emptyAction={{ label: "Browse laptops", onClick: () => go("laptops") }}
              />
            </section>
          )}

          {view === "history" && (
            <section>
              <header className="csd-section-head">
                <h2 className="csd-section-title">Past loans</h2>
                <span className="csd-count">{past.length}</span>
              </header>
              <LoanList
                loans={past}
                nameOf={nameOf}
                st={st}
                onCancel={cancel}
                empty="Your returned and cancelled loans will show up here."
                emptyIcon={History}
              />
            </section>
          )}

          {view === "profile" && (
            <section className="csd-profile">
              <div className="csd-profile-card">
                <div className="csd-profile-avatar">{first[0]}</div>
                <h2 className="csd-profile-name">{student.name}</h2>
                <p className="csd-profile-no">{student.studentNo}</p>
                <p className="csd-profile-role">{student.program}</p>
              </div>

              <div className="csd-profile-side">
                {editingProfile ? (
                  <form className="csd-profile-form" onSubmit={saveProfile}>
                    <header className="csd-profile-form-head">
                      <h2 className="csd-section-title">Edit profile</h2>
                      <p className="csd-dim" style={{ fontSize: 12 }}>
                        Your student ID can't be changed. Contact the CSD office if it's wrong.
                      </p>
                    </header>

                    <div className="csd-profile-fields">
                      <label className="csd-profile-field">
                        Full name
                        <input className="csd-field" value={profileForm.name} onChange={setProfile("name")} aria-invalid={Boolean(profileErrors.name)} required />
                        {profileErrors.name && <span className="csd-field-error">{profileErrors.name}</span>}
                      </label>
                      <label className="csd-profile-field">
                        Contact number
                        <input className="csd-field" type="tel" value={profileForm.contact} onChange={setProfile("contact")} aria-invalid={Boolean(profileErrors.contact)} placeholder="0917 123 4567" required />
                        {profileErrors.contact && <span className="csd-field-error">{profileErrors.contact}</span>}
                      </label>
                      <label className="csd-profile-field csd-profile-field-wide">
                        Address
                        <input className="csd-field" value={profileForm.address} onChange={setProfile("address")} aria-invalid={Boolean(profileErrors.address)} required />
                        {profileErrors.address && <span className="csd-field-error">{profileErrors.address}</span>}
                      </label>
                      <label className="csd-profile-field csd-profile-field-wide">
                        Program
                        <select className="csd-field" value={profileForm.program} onChange={setProfile("program")} required>
                          {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
                        </select>
                      </label>
                      <label className="csd-profile-field">
                        Year level
                        <select className="csd-field" value={profileForm.year} onChange={setProfile("year")} required>
                          {YEARS.map((y) => <option key={y}>{y}</option>)}
                        </select>
                      </label>
                      <label className="csd-profile-field">
                        Block
                        <select className="csd-field" value={profileForm.block} onChange={setProfile("block")} required>
                          {BLOCKS.map((b) => <option key={b}>{b}</option>)}
                        </select>
                      </label>
                    </div>

                    {profileError && <p className="csd-error" role="alert">{profileError}</p>}

                    <div className="csd-profile-actions">
                      <button type="button" className="csd-ghost" onClick={() => setEditingProfile(false)}>Cancel</button>
                      <button className="csd-pill" disabled={profileSaving}>
                        {profileSaving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <ul className="csd-profile-info">
                      {[
                        ["Year & block", `${student.year} · Block ${student.block}`],
                        ["Contact", student.contact],
                        ["Address", student.address],
                      ].map(([k, v]) => (
                        <li key={k}>
                          <span className="csd-profile-key">{k}</span>
                          <span className="csd-profile-val">{v}</span>
                        </li>
                      ))}
                    </ul>
                    <button type="button" className="csd-ghost csd-profile-edit" onClick={startEditProfile}>
                      <Pencil size={13} /> Edit profile
                    </button>
                  </>
                )}
              </div>

              <form className="csd-profile-side" onSubmit={changePassword}>
                <h2 className="csd-section-title">Change password</h2>
                <div className="csd-profile-fields">
                  <label className="csd-profile-field csd-profile-field-wide">
                    Current password
                    <input
                      className="csd-field"
                      type="password"
                      autoComplete="current-password"
                      value={pwForm.current}
                      onChange={(e) => setPwForm((p) => ({ ...p, current: e.target.value }))}
                      required
                    />
                  </label>
                  <label className="csd-profile-field csd-profile-field-wide">
                    New password (at least 12 characters)
                    <input
                      className="csd-field"
                      type="password"
                      autoComplete="new-password"
                      value={pwForm.next}
                      onChange={(e) => setPwForm((p) => ({ ...p, next: e.target.value }))}
                      required
                    />
                  </label>
                </div>
                {pwError && <p className="csd-error" role="alert">{pwError}</p>}
                <div className="csd-profile-actions">
                  <button className="csd-pill" disabled={pwSaving}>
                    {pwSaving ? "Saving…" : "Update password"}
                  </button>
                </div>
              </form>
            </section>
          )}
        </main>
      </div>

      {picked && (
        <ReserveModal
          laptop={picked}
          onClose={() => setPicked(null)}
          onDone={async () => {
            setPicked(null);
            await load();
            setToast("Reservation sent — waiting for admin approval");
          }}
        />
      )}
      <Toast toast={toast} onClose={() => setToastState(null)} />
    </div>
  );
}