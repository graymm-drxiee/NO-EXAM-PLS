import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Laptop, ClipboardList, Users,
  Settings as SettingsIcon,
  Menu, X, Search, Plus, Trash2, Pencil, Wrench, Clock,
  AlertTriangle, LogOut, ArrowLeft, RefreshCw, Download,
  Calendar, CheckCircle2, CircleDot, Inbox, KeyRound,
} from "lucide-react";
import { api } from "../api/api";
import { fmt, short, toInput, CLASS_START_HOUR, CLASS_END_HOUR, PROGRAMS, YEARS, BLOCKS } from "../utils/helpers";
import Logo from "../components/Logo";
import Notifications from "../components/Notifications";
import Toast from "../components/Toast";
import useDialog from "../utils/useDialog";
import "../styles/admin.css";

const H = 36e5;

function exportCsv(filename, rows) {
  if (!rows.length) return;
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map((row) => row.map(escape).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const NAV = [
  ["Main", [
    ["overview", "Overview", LayoutDashboard],
    ["inventory", "Inventory", Laptop],
    ["loans", "Loans", ClipboardList],
    ["students", "Students", Users],
  ]],
  ["System", [["settings", "Settings", SettingsIcon]]],
];

const TITLES = {
  overview: "Overview",
  inventory: "Inventory",
  loans: "Loans",
  students: "Students",
  settings: "Settings",
};

const SUBTITLES = {
  overview: "What needs your attention right now",
  inventory: "Manage the laptop fleet",
  loans: "Approve, extend, and close out loans",
  students: "Manage student accounts",
  settings: "System configuration",
};

/* ================================================================== */
/*  Main component                                                     */
/* ================================================================== */
export default function AdminDashboard({ onExit, onBack }) {
  const theme = "dark";
  const [view, setView] = useState("overview");
  const [menu, setMenu] = useState(false);
  const [laptops, setLaptops] = useState([]);
  const [loans, setLoans] = useState([]);
  const [students, setStudents] = useState([]);
  const [settings, setSettings] = useState(null);
  const [toast, setToastState] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  const [laptopModal, setLaptopModal] = useState(null);
  const [studentModal, setStudentModal] = useState(null);
  const [loanModal, setLoanModal] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const setToast = (message, tone = "ok") => setToastState(message ? { message, tone } : null);

  const [laptopFilter, setLaptopFilter] = useState("all");
  const [laptopSearch, setLaptopSearch] = useState("");
  const [loanFilter, setLoanFilter] = useState("pending");
  const [loanSearch, setLoanSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  const loadAll = async () => {
    try {
      const [l, b, st, cfg] = await Promise.all([
        api.getLaptops(),
        api.getAdminLoans(),
        api.getAdminStudents(),
        api.getSettings(),
      ]);
      setLaptops(l);
      setLoans(b);
      setStudents(st);
      setSettings(cfg);
      setLoading(false);
    } catch (error) {
      setToast(error.message, "error");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
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

  /* ---------------- derived helpers ---------------- */
  const adminStatusOf = (l) => {
    if (l.cancelled) return "cancelled";
    if (l.returned) return "returned";
    if (l.approved === false) return "pending";
    if (now < +new Date(l.start)) return "upcoming";
    if (now <= +new Date(l.end)) return "active";
    return "overdue";
  };

  const laptopStatusOf = (lp) => {
    if (lp.maintenance) return "maintenance";
    if (loans.some((l) => l.laptopId === lp.id && adminStatusOf(l) === "active")) return "on-loan";
    if (loans.some((l) => l.laptopId === lp.id && ["upcoming", "pending"].includes(adminStatusOf(l)))) return "reserved";
    return "available";
  };

  const stats = useMemo(() => {
    let available = 0, onLoan = 0, reserved = 0, maintenance = 0;
    laptops.forEach((lp) => {
      const s = laptopStatusOf(lp);
      if (s === "available") available++;
      else if (s === "on-loan") onLoan++;
      else if (s === "reserved") reserved++;
      else if (s === "maintenance") maintenance++;
    });
    const overdue = loans.filter((l) => adminStatusOf(l) === "overdue").length;
    return {
      totalLaptops: laptops.length,
      available, onLoan, reserved, maintenance, overdue,
      totalStudents: students.length,
      activeStudents: students.filter((s) => s.active).length,
    };
  }, [laptops, loans, students, now]);

  const overdueLoans = useMemo(
    () => loans.filter((l) => adminStatusOf(l) === "overdue"),
    [loans, now]
  );
  const dueSoonLoans = useMemo(
    () => loans.filter(
      (l) => adminStatusOf(l) === "active"
        && +new Date(l.end) >= now
        && +new Date(l.end) < now + 24 * H
    ),
    [loans, now]
  );
  const maintenanceLaptops = useMemo(
    () => laptops.filter((lp) => lp.maintenance),
    [laptops]
  );
  const pendingLoans = useMemo(
    () => loans.filter((l) => adminStatusOf(l) === "pending"),
    [loans, now]
  );

  const notifications = [
    ...(pendingLoans.length
      ? [{
          id: "pending",
          tone: "warn",
          title: `${pendingLoans.length} reservation ${pendingLoans.length === 1 ? "request" : "requests"} to confirm`,
          body: "Review the request in Loans.",
          onClick: () => { setView("loans"); setLoanFilter("pending"); },
        }]
      : []),
    ...(overdueLoans.length
      ? [{
          id: "overdue",
          tone: "danger",
          title: `${overdueLoans.length} overdue ${overdueLoans.length === 1 ? "loan" : "loans"}`,
          body: "Follow up with the borrower.",
          onClick: () => { setView("loans"); setLoanFilter("overdue"); },
        }]
      : []),
    ...(dueSoonLoans.length
      ? [{
          id: "due-soon",
          tone: "info",
          title: `${dueSoonLoans.length} ${dueSoonLoans.length === 1 ? "loan is" : "loans are"} due within 24 hours`,
          body: "Check the return schedule.",
          onClick: () => { setView("loans"); setLoanFilter("active"); },
        }]
      : []),
    ...(maintenanceLaptops.length
      ? [{
          id: "maintenance",
          tone: "info",
          title: `${maintenanceLaptops.length} laptop${maintenanceLaptops.length === 1 ? "" : "s"} in maintenance`,
          body: "Mark back in service when ready.",
          onClick: () => { setView("inventory"); setLaptopFilter("maintenance"); },
        }]
      : []),
  ];

  /* ---------------- filters ---------------- */
  const filteredLaptops = useMemo(() => {
    let list = laptops;
    if (laptopFilter !== "all") list = list.filter((lp) => laptopStatusOf(lp) === laptopFilter);
    if (laptopSearch) {
      const q = laptopSearch.toLowerCase();
      list = list.filter((lp) =>
        lp.model.toLowerCase().includes(q) || lp.tag.toLowerCase().includes(q)
      );
    }
    return list;
  }, [laptops, loans, laptopFilter, laptopSearch, now]);

  const filteredLoans = useMemo(() => {
    let list = loans;
    if (loanFilter !== "all") list = list.filter((l) => adminStatusOf(l) === loanFilter);
    if (loanSearch) {
      const q = loanSearch.toLowerCase();
      list = list.filter((l) =>
        l.student?.name.toLowerCase().includes(q) ||
        l.student?.studentNo.toLowerCase().includes(q) ||
        l.laptop?.model.toLowerCase().includes(q)
      );
    }
    return list;
  }, [loans, loanFilter, loanSearch, now]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch) return students;
    const q = studentSearch.toLowerCase();
    return students.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.studentNo.toLowerCase().includes(q) ||
      s.program.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  /* ---------------- actions ---------------- */
  const handleSaveLaptop = async (form) => {
    if (laptopModal.mode === "add") await api.addLaptop(form);
    else await api.updateLaptop(laptopModal.laptop.id, form);
    await loadAll();
    setLaptopModal(null);
    setToast(laptopModal.mode === "add" ? "Laptop added" : "Laptop updated");
  };

  const askDeleteLaptop = (lp) => {
    setConfirmDialog({
      title: `Delete ${lp.model}?`,
      message: "This removes the laptop from inventory. Past loans tied to it remain in history.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteLaptop(lp.id);
          await loadAll();
          setConfirmDialog(null);
          setToast("Laptop deleted");
        } catch (err) {
          setConfirmDialog(null);
          setToast(err.message, "error");
        }
      },
    });
  };

  const toggleMaintenance = async (lp, note = "") => {
    try {
      await api.toggleMaintenance(lp.id, note);
      await loadAll();
      setToast(lp.maintenance ? "Laptop back in service" : "Laptop sent to maintenance");
    } catch (err) {
      setToast(err.message, "error");
    }
  };

  const askMaintenance = (lp) => {
    if (lp.maintenance) return toggleMaintenance(lp);
    setConfirmDialog({
      title: `Send ${lp.model} to maintenance?`,
      message: "It will be hidden from students until it is back in service.",
      confirmLabel: "Send to maintenance",
      input: { label: "What needs fixing? (optional)", placeholder: "e.g. Broken hinge" },
      onConfirm: async (note) => {
        await toggleMaintenance(lp, note);
        setConfirmDialog(null);
      },
    });
  };

  const askForceReturn = (loan) => {
    setConfirmDialog({
      title: "Mark as returned?",
      message: `This will mark the loan for ${loan.student?.name} as returned immediately. Use only when the laptop is physically back at the CSD office.`,
      confirmLabel: "Mark returned",
      onConfirm: async () => {
        try {
          await api.forceReturn(loan.id);
          await loadAll();
          setConfirmDialog(null);
          setToast("Loan marked returned");
        } catch (err) {
          setConfirmDialog(null);
          setToast(err.message, "error");
        }
      },
    });
  };

  const toggleStudent = async (s) => {
    try {
      await api.toggleStudent(s.id);
      await loadAll();
      setToast(s.active ? "Student deactivated" : "Student reactivated");
    } catch (err) {
      setToast(err.message, "error");
    }
  };

  const askToggleStudent = (s) => {
    if (!s.active) return toggleStudent(s);
    setConfirmDialog({
      title: `Disable ${s.name}?`,
      message: "They will not be able to log in or reserve a laptop until the account is enabled again.",
      confirmLabel: "Disable account",
      danger: true,
      onConfirm: async () => {
        await toggleStudent(s);
        setConfirmDialog(null);
      },
    });
  };

  const handleSaveStudent = async (form) => {
    if (studentModal.mode === "add") await api.addStudent(form);
    else await api.updateStudent(studentModal.student.id, form);
    await loadAll();
    setStudentModal(null);
    setToast(studentModal.mode === "add" ? "Student added" : "Student updated");
  };

  const handleResetPassword = async (password) => {
    await api.resetStudentPassword(studentModal.student.id, password);
    setStudentModal(null);
    setToast("Password reset");
  };

  const handleSaveDates = async (dates) => {
    await api.updateLoanDates(loanModal.loan.id, dates);
    await loadAll();
    setLoanModal(null);
    setToast("Loan dates updated");
  };

  const askApprove = (loan) => {
    setConfirmDialog({
      title: "Confirm reservation?",
      message: `Confirm ${loan.student?.name}'s request for ${loan.laptop?.model} on ${fmt(loan.start)}. It will then appear in the student's reservations.`,
      confirmLabel: "Confirm",
      onConfirm: async () => {
        try {
          await api.approveLoan(loan.id);
          await loadAll();
          setConfirmDialog(null);
          setToast("Reservation confirmed");
        } catch (err) {
          setConfirmDialog(null);
          setToast(err.message, "error");
        }
      },
    });
  };

  const askDecline = (loan) => {
    setConfirmDialog({
      title: "Decline reservation?",
      message: `Decline ${loan.student?.name}'s request for ${loan.laptop?.model}. The slot opens up for other students.`,
      confirmLabel: "Decline",
      danger: true,
      input: { label: "Reason shown to the student (optional)", placeholder: "e.g. Laptop needed for a class demo" },
      onConfirm: async (reason) => {
        try {
          await api.declineLoan(loan.id, reason);
          await loadAll();
          setConfirmDialog(null);
          setToast("Reservation declined");
        } catch (err) {
          setConfirmDialog(null);
          setToast(err.message, "error");
        }
      },
    });
  };

  /* ---------------- render ---------------- */
  if (loading) {
    return (
      <div className="csd csd-loading" data-theme={theme}>
        <div className="csd-loading-spinner" />
        <p>Loading admin console…</p>
      </div>
    );
  }

  return (
    <div className="csd adm" data-theme={theme}>
      <div className={`csd-scrim ${menu ? "open" : ""}`} onClick={() => setMenu(false)} />

      <aside className={`csd-aside ${menu ? "open" : ""}`}>
        <div className="csd-brand">
          <Logo size={42} />
          <div>
            <p className="csd-brand-name">CSD LAPTOPS</p>
            <p className="csd-brand-sub adm-brand-sub">Admin Console</p>
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
                  onClick={() => { setView(id); setMenu(false); }}
                  aria-current={view === id ? "page" : undefined}
                >
                  <Icon size={18} /> {label}
                  {id === "loans" && overdueLoans.length + pendingLoans.length > 0 && (
                    <span className="csd-nav-badge">{overdueLoans.length + pendingLoans.length}</span>
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
            <button className="csd-iconbtn" aria-label="Refresh" onClick={() => loadAll()}>
              <RefreshCw size={16} />
            </button>
            <Notifications items={notifications} />
            <div className="csd-user">
              <p className="csd-user-name">CSD Admin</p>
              <p className="csd-user-role">Administrator</p>
            </div>
            <div className="csd-avatar">A</div>
          </div>
        </header>

        <main className="csd-main">
          {view === "overview" && (
            <Overview
              stats={stats}
              overdueLoans={overdueLoans}
              dueSoonLoans={dueSoonLoans}
              pendingLoans={pendingLoans}
              maintenanceLaptops={maintenanceLaptops}
              loans={loans}
              adminStatusOf={adminStatusOf}
              onForceReturn={askForceReturn}
              onToggleMaintenance={toggleMaintenance}
              onApprove={askApprove}
              onDecline={askDecline}
              onViewLoans={() => setView("loans")}
              onViewInventory={() => setView("inventory")}
            />
          )}

          {view === "inventory" && (
            <Inventory
              laptops={laptops}
              loans={loans}
              filtered={filteredLaptops}
              laptopStatusOf={laptopStatusOf}
              filter={laptopFilter}
              setFilter={setLaptopFilter}
              search={laptopSearch}
              setSearch={setLaptopSearch}
              onAdd={() => setLaptopModal({ mode: "add" })}
              onEdit={(lp) => setLaptopModal({ mode: "edit", laptop: lp })}
              onDelete={askDeleteLaptop}
              onToggleMaintenance={askMaintenance}
            />
          )}

          {view === "loans" && (
            <Loans
              loans={loans}
              filtered={filteredLoans}
              filter={loanFilter}
              setFilter={setLoanFilter}
              search={loanSearch}
              setSearch={setLoanSearch}
              adminStatusOf={adminStatusOf}
              onForceReturn={askForceReturn}
              onApprove={askApprove}
              onDecline={askDecline}
              onEditDates={(loan) => setLoanModal({ loan })}
            />
          )}

          {view === "students" && (
            <Students
              students={students}
              filtered={filteredStudents}
              search={studentSearch}
              setSearch={setStudentSearch}
              onToggle={askToggleStudent}
              onAdd={() => setStudentModal({ mode: "add" })}
              onEdit={(student) => setStudentModal({ mode: "edit", student })}
              onResetPassword={(student) => setStudentModal({ mode: "password", student })}
            />
          )}

          {view === "settings" && (
            <Settings
              settings={settings}
              onSave={async (value) => {
                try {
                  setSettings(await api.updateSettings(value));
                  setToast("Settings saved");
                } catch (error) {
                  setToast(error.message, "error");
                }
              }}
            />
          )}
        </main>
      </div>

      {laptopModal && (
        <LaptopModal
          mode={laptopModal.mode}
          laptop={laptopModal.laptop}
          onClose={() => setLaptopModal(null)}
          onSave={handleSaveLaptop}
        />
      )}

      {studentModal && (
        <StudentModal
          mode={studentModal.mode}
          student={studentModal.student}
          onClose={() => setStudentModal(null)}
          onSave={handleSaveStudent}
          onResetPassword={handleResetPassword}
        />
      )}

      {loanModal && (
        <LoanDatesModal
          loan={loanModal.loan}
          onClose={() => setLoanModal(null)}
          onSave={handleSaveDates}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          {...confirmDialog}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      <Toast toast={toast} onClose={() => setToastState(null)} />
    </div>
  );
}

/* ================================================================== */
/*  Overview                                                           */
/* ================================================================== */
function Overview({
  stats, overdueLoans, dueSoonLoans, pendingLoans, maintenanceLaptops, loans,
  adminStatusOf, onForceReturn, onToggleMaintenance, onApprove, onDecline,
  onViewLoans, onViewInventory,
}) {
  const totalAttention = pendingLoans.length + overdueLoans.length + dueSoonLoans.length + maintenanceLaptops.length;
  const recent = [...loans]
    .sort((a, b) => +new Date(b.start) - +new Date(a.start))
    .slice(0, 5);

  return (
    <>
      <section className="adm-hero">
        <div className="adm-hero-orb" aria-hidden="true" />
        <div>
          <p className="csd-eyebrow">System overview</p>
          <h2 className="adm-hero-title">
            {totalAttention === 0
              ? "All clear"
              : `${totalAttention} item${totalAttention === 1 ? "" : "s"} need attention`}
          </h2>
          <p className="adm-hero-sub">
            {new Date().toLocaleDateString([], {
              weekday: "long", month: "long", day: "numeric", year: "numeric",
            })}
          </p>
        </div>
      </section>

      <section className="adm-stats">
        <BigStat label="Available" value={stats.available} sub={`of ${stats.totalLaptops} total`} icon={Laptop} tone="green" onClick={onViewInventory} />
        <BigStat label="On loan" value={stats.onLoan} sub="Active loans" icon={Clock} tone="pink" onClick={onViewLoans} />
        <BigStat label="Overdue" value={stats.overdue} sub="Past return date" icon={AlertTriangle} tone="red" onClick={onViewLoans} />
        <BigStat label="In repair" value={stats.maintenance} sub="Out of service" icon={Wrench} tone="amber" onClick={onViewInventory} />
      </section>

      <section>
        <header className="csd-section-head">
          <h2 className="csd-section-title">Needs attention</h2>
          {totalAttention > 0 && <span className="csd-count">{totalAttention}</span>}
        </header>

        {totalAttention === 0 ? (
          <div className="csd-empty">
            <div className="csd-empty-icon"><CheckCircle2 size={28} /></div>
            <p className="csd-empty-title">Nothing needs your attention right now</p>
            <p className="csd-empty-sub">No pending requests, overdue loans, nothing due today, no laptops in maintenance.</p>
          </div>
        ) : (
          <ul className="adm-attention">
            {pendingLoans.map((l) => (
              <li key={l.id} className="adm-attention-row warn">
                <div className="adm-attention-icon"><ClipboardList size={16} /></div>
                <div className="adm-attention-body">
                  <p className="adm-attention-title">{l.student?.name} requested a reservation</p>
                  <p className="adm-attention-sub">{l.laptop?.model} · {fmt(l.start)}</p>
                </div>
                <button className="csd-pill" onClick={() => onApprove(l)}>Confirm</button>
                <button className="csd-ghost" onClick={() => onDecline(l)}>Decline</button>
              </li>
            ))}
            {overdueLoans.map((l) => (
              <li key={l.id} className="adm-attention-row danger">
                <div className="adm-attention-icon"><AlertTriangle size={16} /></div>
                <div className="adm-attention-body">
                  <p className="adm-attention-title">{l.student?.name} is overdue</p>
                  <p className="adm-attention-sub">{l.laptop?.model} · was due {fmt(l.end)}</p>
                </div>
                <button className="csd-pill" onClick={() => onForceReturn(l)}>Mark returned</button>
              </li>
            ))}
            {dueSoonLoans.map((l) => (
              <li key={l.id} className="adm-attention-row warn">
                <div className="adm-attention-icon"><Clock size={16} /></div>
                <div className="adm-attention-body">
                  <p className="adm-attention-title">{l.student?.name} is due soon</p>
                  <p className="adm-attention-sub">{l.laptop?.model} · due {fmt(l.end)}</p>
                </div>
                <button className="csd-ghost" onClick={onViewLoans}>View loans</button>
              </li>
            ))}
            {maintenanceLaptops.map((lp) => (
              <li key={lp.id} className="adm-attention-row info">
                <div className="adm-attention-icon"><Wrench size={16} /></div>
                <div className="adm-attention-body">
                  <p className="adm-attention-title">{lp.model} is in maintenance</p>
                  <p className="adm-attention-sub">{lp.tag} · out of service</p>
                </div>
                <button className="csd-ghost" onClick={() => onToggleMaintenance(lp)}>Back in service</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <header className="csd-section-head">
          <h2 className="csd-section-title">Recent activity</h2>
          <button className="csd-link" onClick={onViewLoans}>View all →</button>
        </header>
        {recent.length === 0 ? (
          <div className="csd-empty">
            <div className="csd-empty-icon"><CircleDot size={28} /></div>
            <p className="csd-empty-title">No activity yet</p>
          </div>
        ) : (
          <ul className="csd-card csd-list">
            {recent.map((l) => {
              const s = adminStatusOf(l);
              return (
                <li key={l.id} className="adm-activity">
                  <div className="min-w-0">
                    <p className="adm-activity-title">
                      {l.student?.name} <span className="csd-dim">borrowed</span> {l.laptop?.model}
                    </p>
                    <p className="adm-activity-sub">
                      Pick up {short(l.start)} · Return {short(l.end)}
                    </p>
                  </div>
                  <span className={`csd-chip ${s}`}>{s}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

/* ================================================================== */
/*  Inventory                                                          */
/* ================================================================== */
function Inventory({
  laptops, loans, filtered, laptopStatusOf,
  filter, setFilter, search, setSearch,
  onAdd, onEdit, onDelete, onToggleMaintenance,
}) {
  const count = (status) => laptops.filter((lp) => laptopStatusOf(lp) === status).length;

  return (
    <>
      <div className="adm-toolbar">
        <div className="csd-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by model or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="csd-pill" onClick={onAdd}>
          <Plus size={14} /> Add laptop
        </button>
      </div>

      <div className="adm-chips">
        <Chip active={filter === "all"} onClick={() => setFilter("all")} count={laptops.length}>All</Chip>
        <Chip active={filter === "available"} onClick={() => setFilter("available")} count={count("available")}>Available</Chip>
        <Chip active={filter === "on-loan"} onClick={() => setFilter("on-loan")} count={count("on-loan")}>On loan</Chip>
        <Chip active={filter === "reserved"} onClick={() => setFilter("reserved")} count={count("reserved")}>Reserved</Chip>
        <Chip active={filter === "maintenance"} onClick={() => setFilter("maintenance")} count={count("maintenance")}>Maintenance</Chip>
      </div>

      {filtered.length === 0 ? (
        <div className="csd-empty">
          <div className="csd-empty-icon"><Inbox size={28} /></div>
          <p className="csd-empty-title">No laptops match your filters</p>
          <p className="csd-empty-sub">Try clearing the search or changing the filter.</p>
        </div>
      ) : (
        <ul className="adm-laptop-grid">
          {filtered.map((lp) => {
            const status = laptopStatusOf(lp);
            const active = loans.find((l) => l.laptopId === lp.id && statusOfLoan(l) === "active");
            const upcoming = loans.find((l) => l.laptopId === lp.id && statusOfLoan(l) === "upcoming");
            return (
              <li key={lp.id} className="adm-laptop">
                <div className="adm-laptop-head">
                  <div className="min-w-0">
                    <p className="adm-laptop-tag">{lp.tag}</p>
                    <h3 className="adm-laptop-model">{lp.model}</h3>
                  </div>
                  <LaptopChip status={status} />
                </div>
                <p className="adm-laptop-specs">{lp.cpu} · {lp.ram} · {lp.storage}</p>
                {(active || upcoming) && (
                  <p className="adm-laptop-holder">
                    {active ? `On loan to ${active.student?.name}` : `Reserved by ${upcoming.student?.name}`}
                  </p>
                )}
                <div className="adm-laptop-actions">
                  <button className="csd-ghost" onClick={() => onEdit(lp)}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button className="csd-ghost" onClick={() => onToggleMaintenance(lp)}>
                    <Wrench size={13} /> {lp.maintenance ? "In service" : "Maintenance"}
                  </button>
                  <button className="adm-btn-danger" onClick={() => onDelete(lp)} aria-label="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function statusOfLoan(l) {
  const t = Date.now();
  if (l.cancelled) return "cancelled";
  if (l.returned) return "returned";
  if (t < +new Date(l.start)) return "upcoming";
  if (t <= +new Date(l.end)) return "active";
  return "overdue";
}

function LaptopChip({ status }) {
  const map = {
    available: ["free", "Available"],
    "on-loan": ["active", "On loan"],
    reserved: ["upcoming", "Reserved"],
    maintenance: ["returned", "Maintenance"],
  };
  const [cls, label] = map[status] || map.available;
  return <span className={`csd-chip ${cls}`}>{label}</span>;
}

/* ================================================================== */
/*  Loans                                                              */
/* ================================================================== */
function Loans({ loans, filtered, filter, setFilter, search, setSearch, adminStatusOf, onForceReturn, onApprove, onDecline, onEditDates }) {
  const count = (status) => loans.filter((l) => adminStatusOf(l) === status).length;

  const exportRows = () => exportCsv("loans.csv", [
    ["Student", "Student ID", "Laptop", "Asset tag", "Start", "End", "Purpose", "Status"],
    ...loans.map((l) => [
      l.student?.name, l.student?.studentNo, l.laptop?.model, l.laptop?.tag,
      fmt(l.start), fmt(l.end), l.purpose, adminStatusOf(l),
    ]),
  ]);

  return (
    <>
      <div className="adm-toolbar">
        <div className="csd-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by student, laptop, or number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="csd-ghost" onClick={exportRows}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div className="adm-chips">
        <Chip active={filter === "pending"} onClick={() => setFilter("pending")} count={count("pending")}>Pending</Chip>
        <Chip active={filter === "active"} onClick={() => setFilter("active")} count={count("active")}>Active</Chip>
        <Chip active={filter === "overdue"} onClick={() => setFilter("overdue")} count={count("overdue")}>Overdue</Chip>
        <Chip active={filter === "upcoming"} onClick={() => setFilter("upcoming")} count={count("upcoming")}>Upcoming</Chip>
        <Chip active={filter === "returned"} onClick={() => setFilter("returned")} count={count("returned")}>Returned</Chip>
        <Chip active={filter === "all"} onClick={() => setFilter("all")} count={loans.length}>All</Chip>
      </div>

      {filtered.length === 0 ? (
        <div className="csd-empty">
          <div className="csd-empty-icon"><ClipboardList size={28} /></div>
          <p className="csd-empty-title">No loans match your filters</p>
        </div>
      ) : (
        <ul className="csd-card csd-list">
          {filtered.map((l) => {
            const s = adminStatusOf(l);
            return (
              <li key={l.id} className="adm-loan">
                <div className="adm-loan-student">
                  <p className="adm-loan-name">{l.student?.name}</p>
                  <p className="adm-loan-no">{l.student?.studentNo}</p>
                </div>
                <div className="adm-loan-laptop">
                  <p className="adm-loan-model">{l.laptop?.model}</p>
                  <p className="adm-loan-tag">{l.laptop?.tag}</p>
                </div>
                <div className="adm-loan-dates">
                  <p><Calendar size={12} /> {short(l.start)} → {short(l.end)}</p>
                  {l.purpose && <p className="csd-dim adm-loan-purpose">{l.purpose}</p>}
                </div>
                <div className="adm-loan-status">
                  <span className={`csd-chip ${s === "overdue" ? "cancelled" : s}`}>{s}</span>
                  {s === "pending" && (
                    <>
                      <button className="csd-link" onClick={() => onApprove(l)}>Confirm</button>
                      <button className="csd-link" onClick={() => onDecline(l)}>Decline</button>
                    </>
                  )}
                  {!l.cancelled && !l.returned && (
                    <button className="csd-link" onClick={() => onEditDates(l)}>Edit dates</button>
                  )}
                  <button className="csd-link" onClick={() => onForceReturn(l)}>Force return</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

/* ================================================================== */
/*  Students                                                           */
/* ================================================================== */
function Students({ students, filtered, search, setSearch, onToggle, onAdd, onEdit, onResetPassword }) {
  const exportRows = () => exportCsv("students.csv", [
    ["Name", "Student ID", "Program", "Year", "Block", "Contact", "Address", "Status", "Total loans"],
    ...students.map((s) => [
      s.name, s.studentNo, s.program, s.year, s.block, s.contact, s.address,
      s.active ? "active" : "disabled", s.totalLoans,
    ]),
  ]);

  return (
    <>
      <div className="adm-toolbar">
        <div className="csd-search">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by name, number, or program…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="csd-ghost" onClick={exportRows}>
            <Download size={14} /> Export CSV
          </button>
          <button className="csd-pill" onClick={onAdd}>
            <Plus size={14} /> Add student
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="csd-empty">
          <div className="csd-empty-icon"><Users size={28} /></div>
          <p className="csd-empty-title">No students match your search</p>
        </div>
      ) : (
        <ul className="csd-card csd-list">
          {filtered.map((s) => (
            <li key={s.id} className="adm-student">
              <div className="adm-student-avatar">{s.name[0]}</div>
              <div className="adm-student-info">
                <p className="adm-student-name">{s.name}</p>
                <p className="adm-student-no">{s.studentNo} · {s.program}</p>
                <p className="csd-dim adm-student-year">{s.year} · Block {s.block}</p>
              </div>
              <div className="adm-student-stats">
                <div>
                  <p className="adm-student-value">{s.activeLoans}</p>
                  <p className="adm-student-label">Active</p>
                </div>
                <div>
                  <p className="adm-student-value">{s.totalLoans}</p>
                  <p className="adm-student-label">Total</p>
                </div>
              </div>
              <div className="adm-student-actions">
                <span className={`csd-chip ${s.active ? "free" : "cancelled"}`}>
                  {s.active ? "active" : "disabled"}
                </span>
                <button className="csd-link" onClick={() => onEdit(s)}>Edit</button>
                <button className="csd-link" onClick={() => onResetPassword(s)}>
                  <KeyRound size={12} /> Reset password
                </button>
                <button className="csd-link" onClick={() => onToggle(s)}>
                  {s.active ? "Disable" : "Enable"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ================================================================== */
/*  Settings                                                           */
/* ================================================================== */
function Settings({ settings, onSave }) {
  const [maxActiveLoans, setMaxActiveLoans] = useState(settings?.maxActiveLoans ?? 2);
  const [saving, setSaving] = useState(false);

  if (!settings) return <p className="csd-dim">Loading settings…</p>;

  const save = async () => {
    setSaving(true);
    await onSave({ maxActiveLoans });
    setSaving(false);
  };

  return (
    <div className="adm-settings">
      <div className="csd-card adm-settings-card">
        <h2 className="csd-section-title">Loan rules</h2>
        <p className="csd-dim" style={{ fontSize: 12, marginBottom: 16 }}>
          Loans always last one day, Monday–Friday, 9:00 AM–4:00 PM. These hours are fixed.
        </p>
        <div className="adm-settings-grid">
          <label className="adm-label">
            Max open loans per student
            <input
              type="number"
              className="csd-field"
              min="1"
              max="10"
              value={maxActiveLoans}
              onChange={(e) => setMaxActiveLoans(Number(e.target.value) || 1)}
            />
          </label>
        </div>
      </div>

      <button className="csd-pill" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}

/* ================================================================== */
/*  Shared sub-components                                              */
/* ================================================================== */
function BigStat({ label, value, sub, icon: Icon, tone, onClick }) {
  return (
    <button className={`adm-stat tone-${tone}`} onClick={onClick}>
      <div className="adm-stat-head">
        <span className="csd-label">{label}</span>
        <span className="adm-stat-icon"><Icon size={16} /></span>
      </div>
      <p className="adm-stat-value">{value}</p>
      <p className="adm-stat-sub">{sub}</p>
    </button>
  );
}

function Chip({ active, onClick, count, children }) {
  return (
    <button className={`adm-chip ${active ? "on" : ""}`} onClick={onClick}>
      {children}
      {count != null && <span className="adm-chip-count">{count}</span>}
    </button>
  );
}

function StudentModal({ mode, student, onClose, onSave, onResetPassword }) {
  const [form, setForm] = useState({
    name: student?.name || "",
    studentNo: student?.studentNo || "",
    contact: student?.contact || "",
    address: student?.address || "",
    program: student?.program || PROGRAMS[0],
    year: student?.year || YEARS[0],
    block: student?.block || BLOCKS[0],
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.password && form.password.length < 12) {
      setError("Passwords need at least 12 characters.");
      return;
    }
    if (mode === "add" && !form.password) {
      setError("Set a starting password for the student.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (mode === "password") await onResetPassword(form.password);
      else await onSave(form);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="csd-overlay" onClick={onClose}>
      <form className="csd-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="flex items-start justify-between">
          <h2 className="csd-display" style={{ fontSize: 24 }}>
            {mode === "add" ? "Add student" : mode === "password" ? "Reset password" : "Edit student"}
          </h2>
          <button type="button" className="csd-burger" style={{ display: "inline-flex" }} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {mode === "password" ? (
          <div className="adm-modal-fields">
            <p className="csd-dim" style={{ fontSize: 12 }}>
              Set a new password for {student?.name}. The old password stops working immediately.
            </p>
            <label className="adm-label">
              New password
              <input className="csd-field" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
            </label>
          </div>
        ) : (
          <div className="adm-modal-fields">
            <label className="adm-label">
              Full name
              <input className="csd-field" value={form.name} onChange={set("name")} />
            </label>
            <div className="adm-row-2">
              <label className="adm-label">
                Student ID
                <input className="csd-field" value={form.studentNo} onChange={set("studentNo")} placeholder="2023-01482" />
              </label>
              <label className="adm-label">
                Contact number
                <input className="csd-field" value={form.contact} onChange={set("contact")} placeholder="0917 123 4567" />
              </label>
            </div>
            <label className="adm-label">
              Address
              <input className="csd-field" value={form.address} onChange={set("address")} />
            </label>
            <label className="adm-label">
              Program
              <select className="csd-field" value={form.program} onChange={set("program")}>
                {PROGRAMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <div className="adm-row-2">
              <label className="adm-label">
                Year level
                <select className="csd-field" value={form.year} onChange={set("year")}>
                  {YEARS.map((y) => <option key={y}>{y}</option>)}
                </select>
              </label>
              <label className="adm-label">
                Block
                <select className="csd-field" value={form.block} onChange={set("block")}>
                  {BLOCKS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </label>
            </div>
            <label className="adm-label">
              {mode === "add" ? "Starting password" : "New password (leave blank to keep)"}
              <input className="csd-field" type="password" autoComplete="new-password" value={form.password} onChange={set("password")} />
            </label>
          </div>
        )}

        {error && <p className="csd-error">{error}</p>}
        <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
          <button type="button" className="csd-ghost" onClick={onClose}>Cancel</button>
          <button className="csd-pill" disabled={saving}>
            {saving ? "Saving…" : mode === "add" ? "Add student" : mode === "password" ? "Reset password" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function LoanDatesModal({ loan, onClose, onSave }) {
  const [start, setStart] = useState(() => toInput(new Date(loan.start)));
  const [end, setEnd] = useState(() => toInput(new Date(loan.end)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="csd-overlay" onClick={onClose}>
      <form className="csd-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="flex items-start justify-between">
          <h2 className="csd-display" style={{ fontSize: 24 }}>Edit loan dates</h2>
          <button type="button" className="csd-burger" style={{ display: "inline-flex" }} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className="csd-dim" style={{ fontSize: 12, marginTop: 6 }}>
          {loan.student?.name} · {loan.laptop?.model}. Loans stay within one weekday, 9:00 AM–4:00 PM.
        </p>
        <div className="adm-modal-fields">
          <label className="adm-label">
            Pick-up
            <input className="csd-field" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="adm-label">
            Return by
            <input className="csd-field" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {error && <p className="csd-error">{error}</p>}
        <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
          <button type="button" className="csd-ghost" onClick={onClose}>Cancel</button>
          <button className="csd-pill" disabled={saving}>{saving ? "Saving…" : "Save dates"}</button>
        </div>
      </form>
    </div>
  );
}

function LaptopModal({ mode, laptop, onClose, onSave }) {
  const [form, setForm] = useState({
    model: laptop?.model || "",
    tag: laptop?.tag || "",
    cpu: laptop?.cpu || "",
    ram: laptop?.ram || "",
    storage: laptop?.storage || "",
    maintenance: laptop?.maintenance || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) =>
    setForm((p) => ({ ...p, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.model.trim() || !form.cpu.trim() || !form.ram.trim() || !form.storage.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="csd-overlay" onClick={onClose}>
      <form className="csd-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="flex items-start justify-between">
          <h2 className="csd-display" style={{ fontSize: 24 }}>
            {mode === "add" ? "Add laptop" : "Edit laptop"}
          </h2>
          <button type="button" className="csd-burger" style={{ display: "inline-flex" }} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="adm-modal-fields">
          <label className="adm-label">
            Model
            <input className="csd-field" value={form.model} onChange={set("model")} placeholder="Lenovo ThinkPad E14" />
          </label>
          <label className="adm-label">
            Asset tag
            <input className="csd-field" value={form.tag} onChange={set("tag")} placeholder="Auto-generated if blank" />
          </label>
          <div className="adm-row-2">
            <label className="adm-label">
              CPU
              <input className="csd-field" value={form.cpu} onChange={set("cpu")} placeholder="Core i5" />
            </label>
            <label className="adm-label">
              RAM
              <input className="csd-field" value={form.ram} onChange={set("ram")} placeholder="16 GB" />
            </label>
          </div>
          <label className="adm-label">
            Storage
            <input className="csd-field" value={form.storage} onChange={set("storage")} placeholder="512 GB SSD" />
          </label>
          {mode === "add" && (
            <label className="adm-check">
              <input type="checkbox" checked={form.maintenance} onChange={set("maintenance")} />
              <span>Mark as in maintenance</span>
            </label>
          )}
        </div>
        {error && <p className="csd-error">{error}</p>}
        <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
          <button type="button" className="csd-ghost" onClick={onClose}>Cancel</button>
          <button className="csd-pill" disabled={saving}>
            {saving ? "Saving…" : mode === "add" ? "Add laptop" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, danger, input, onCancel, onConfirm }) {
  const [value, setValue] = useState("");
  return (
    <div className="csd-overlay" onClick={onCancel}>
      <div className="csd-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="csd-display" style={{ fontSize: 22 }}>{title}</h2>
        <p className="csd-mut" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.65 }}>{message}</p>
        {input && (
          <label className="adm-label" style={{ marginTop: 12 }}>
            {input.label}
            <input
              className="csd-field"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={input.placeholder}
              maxLength={200}
            />
          </label>
        )}
        <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
          <button className="csd-ghost" onClick={onCancel}>Cancel</button>
          <button className={danger ? "adm-btn-danger-solid" : "csd-pill"} onClick={() => onConfirm(value)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}