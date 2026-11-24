import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Eye,
  EyeOff,
  GraduationCap,
  Radio,
  ShieldCheck,
} from "lucide-react";
import Logo from "../components/Logo";
import LaptopStage from "../components/LaptopStage";
import LegalModal from "../components/LegalModal";
import SignupForm from "../components/SignupForm";
import { api } from "../api/api";

export default function Login({ onSuccess, onCancel, initialMode = "login" }) {
  const [mode, setMode] = useState(initialMode === "signup" ? "signup" : "login");
  const theme = "dark";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loginRole, setLoginRole] = useState("student");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null);
  const [laptops, setLaptops] = useState([]);
  const [loans, setLoans] = useState([]);
  const [dataError, setDataError] = useState("");
  const [now] = useState(Date.now());
  const [panelHeight, setPanelHeight] = useState(null);
  const panelInnerRef = useRef(null);

  // Animate the panel between Sign in and Create account without letting the
  // card jump: the wrapper follows the active view's measured height.
  useLayoutEffect(() => {
    const el = panelInnerRef.current;
    if (!el) return;
    const measure = () => setPanelHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // The account type is explicit so custom admin usernames work.
  const isAdmin = loginRole === "admin";

  useEffect(() => {
    setMode(initialMode === "signup" ? "signup" : "login");
  }, [initialMode]);

  useEffect(() => {
    let alive = true;
    Promise.all([api.getLaptops(), api.getLoans()])
      .then(([l, b]) => {
        if (!alive) return;
        setLaptops(l);
        setLoans(b);
      })
      .catch((err) => {
        if (alive) setDataError(err.message);
      });
    return () => {
      alive = false;
    };
  }, []);

  const switchMode = (next) => {
    setMode(next);
    setError("");
    const hash = next === "signup" ? "#signup" : "#login";
    if (window.location.hash !== hash) window.location.hash = hash;
  };

  const onTabKey = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = mode === "login" ? "signup" : "login";
    switchMode(next);
    document.getElementById(`auth-tab-${next}`)?.focus();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Please enter both your ID and password.");
      return;
    }
    setBusy(true);
    setError("");

    try {
      const session = await api.login({
        role: loginRole,
        identifier: identifier.trim(),
        password,
      });
      onSuccess(session);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="lp auth" data-theme={theme}>
      <div className="auth-glow" aria-hidden="true" />

      <header className="auth-top">
        <a
          className="lp-brand"
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            onCancel();
          }}
        >
          <Logo size={34} />
          <span>
            <span className="lp-brand-name">CSD</span>
            <span className="lp-brand-sub">Laptop Borrowing</span>
          </span>
        </a>

      </header>

      <div className="auth-body">
        <aside className="auth-side">
          <div className="auth-copy">
            <span className="lp-badge">
              <GraduationCap size={14} />
              CSD Portal Access
            </span>
            <h1 className="auth-title">
              Borrow smart,
              <span>code anywhere.</span>
            </h1>
            <p className="auth-lead">
              Reserve a machine, choose your pick-up and return dates, and track
              every loan from one student dashboard.
            </p>
          </div>

          <div className="auth-stage">
            <LaptopStage tab={0} laptops={laptops} loans={loans} now={now} theme={theme} />
          </div>
          {dataError && <p className="lpf-form-error" role="alert">{dataError}</p>}

          <ul className="auth-points">
            <li>
              <ShieldCheck size={15} /> Student ID verified
            </li>
            <li>
              <CalendarClock size={15} /> Same-day loans
            </li>
            <li>
              <Radio size={15} /> Live fleet sync
            </li>
          </ul>
        </aside>

        <main className="auth-main">
          <div className="auth-panel">
            <div className="auth-panel-top">
              <button type="button" className="auth-back-link" onClick={onCancel}>
                <ArrowLeft size={14} /> Back to home
              </button>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Account access">
              <button
                type="button"
                role="tab"
                id="auth-tab-login"
                aria-selected={mode === "login"}
                aria-controls="auth-tabpanel"
                tabIndex={mode === "login" ? 0 : -1}
                className={mode === "login" ? "is-active" : ""}
                onClick={() => switchMode("login")}
                onKeyDown={onTabKey}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                id="auth-tab-signup"
                aria-selected={mode === "signup"}
                aria-controls="auth-tabpanel"
                tabIndex={mode === "signup" ? 0 : -1}
                className={mode === "signup" ? "is-active" : ""}
                onClick={() => switchMode("signup")}
                onKeyDown={onTabKey}
              >
                Create account
              </button>
            </div>

            <div
              className="auth-tabpanel"
              id="auth-tabpanel"
              role="tabpanel"
              aria-labelledby={`auth-tab-${mode}`}
              style={panelHeight != null ? { height: panelHeight } : undefined}
            >
              <div className="auth-tabpanel-inner" key={mode} ref={panelInnerRef}>
                {mode === "login" ? (
                  <>
                    <div className="auth-head">
                      <h2 className="auth-form-title">Welcome back.</h2>
                      <p className="auth-form-sub">
                        Sign in to reserve a laptop and track your loans.
                      </p>
                    </div>

                    <form className="auth-form" onSubmit={submit} noValidate>
                      <label className="lpf-field">
                        <span className="lpf-label">Account type</span>
                        <select
                          className="lpf-input"
                          value={loginRole}
                          onChange={(e) => setLoginRole(e.target.value)}
                        >
                          <option value="student">Student</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </label>
                      <label className="lpf-field">
                        <span className="lpf-label">
                          {isAdmin ? "Admin username" : "Student ID / username"}
                        </span>
                        <input
                          className="lpf-input"
                          type="text"
                          name="student_id_number"
                          autoComplete="username"
                          value={identifier}
                          onChange={(e) => {
                            setIdentifier(e.target.value);
                            if (error) setError("");
                          }}
                          placeholder="2023-01482"
                          aria-invalid={error ? "true" : undefined}
                          aria-describedby={error ? "auth-error" : undefined}
                          autoFocus
                        />
                      </label>

                      <label className="lpf-field">
                        <span className="lpf-label">Password</span>
                        <div className="auth-pw">
                          <input
                            className="lpf-input"
                            type={showPw ? "text" : "password"}
                            name="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              if (error) setError("");
                            }}
                            placeholder="••••••••"
                            aria-invalid={error ? "true" : undefined}
                            aria-describedby={error ? "auth-error" : undefined}
                          />
                          <button
                            type="button"
                            className="auth-eye"
                            onClick={() => setShowPw((v) => !v)}
                            aria-label={showPw ? "Hide password" : "Show password"}
                          >
                            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </label>

                      {error && (
                        <p className="lpf-form-error auth-error" id="auth-error" role="alert">
                          <AlertCircle size={14} />
                          {error}
                        </p>
                      )}

                      <button
                        className="lp-btn lp-btn-primary auth-submit"
                        disabled={busy}
                        type="submit"
                      >
                        {busy ? "Signing in…" : "Sign in"}
                        {!busy && <ArrowRight size={16} />}
                      </button>
                      <p className="auth-form-sub" style={{ fontSize: 12 }}>
                        Forgot your password? Ask the CSD office to reset it.
                      </p>
                    </form>
                  </>
                ) : (
                  <SignupForm
                    onSuccess={onSuccess}
                    onLogin={() => switchMode("login")}
                  />
                )}
              </div>
            </div>
          </div>

          <p className="auth-legal">
            Review our{" "}
            <button type="button" onClick={() => setLegalDoc("terms")}>
              Terms &amp; Conditions
            </button>{" "}
            and{" "}
            <button type="button" onClick={() => setLegalDoc("privacy")}>
              Privacy Policy
            </button>.
          </p>
        </main>
      </div>

      <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </div>
  );
}
