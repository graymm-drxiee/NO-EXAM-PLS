import { useState } from "react";
import { ArrowRight, Check, GraduationCap } from "lucide-react";
import { api } from "../api/api";
import { BLOCKS, PROGRAMS, YEARS } from "../utils/helpers";
import LegalModal from "./LegalModal";

const EMPTY = {
  name: "",
  address: "",
  contact: "",
  studentNo: "",
  program: "",
  year: "",
  block: "",
  password: "",
  confirmPassword: "",
};

const RULES = {
  name: (v) => (v.trim().length < 3 ? "Enter your full name." : ""),
  address: (v) => (v.trim().length < 5 ? "Enter your complete address." : ""),
  contact: (v) =>
    /^(09|\+639)\d{9}$/.test(v.replace(/[\s-]/g, ""))
      ? ""
      : "Use a valid mobile number, e.g. 0917 123 4567.",
  studentNo: (v) =>
    /^\d{4}-?\d{5}$/.test(v.trim()) ? "" : "Use the format 2023-01482.",
  program: (v) => (v ? "" : "Choose your program."),
  year: (v) => (v ? "" : "Choose your year level."),
  block: (v) => (v ? "" : "Choose your block."),
  password: (v) => (v.length < 12 ? "Use a password with at least 12 characters." : ""),
};

function Field({ id, label, error, children }) {
  return (
    <div className="lpf-field">
      <label className="lpf-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {error && (
        <p className="lpf-err" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function SignupForm({ onSuccess, onLogin }) {
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [legalDoc, setLegalDoc] = useState(null);

  const set = (k) => (e) => {
    setV((p) => ({ ...p, [k]: e.target.value }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: "" }));
  };

  const bind = (k) => ({
    id: `signup-${k}`,
    name: k,
    value: v[k],
    onChange: set(k),
    required: true,
    "aria-invalid": errors[k] ? "true" : undefined,
    "aria-describedby": errors[k] ? `signup-${k}-error` : undefined,
    className: "lpf-input",
  });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    for (const k in RULES) {
      const m = RULES[k](v[k]);
      if (m) errs[k] = m;
    }
    if (v.confirmPassword !== v.password) {
      errs.confirmPassword = "Passwords do not match.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`signup-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    if (!accepted) {
      setConsentError("Please accept the Terms & Conditions and Privacy Policy.");
      document.getElementById("signup-consent")?.focus();
      return;
    }

    const digits = v.studentNo.trim().replace("-", "");
    setBusy(true);
    setFormError("");
    try {
      const profile = { ...v };
      delete profile.confirmPassword;
      const session = await api.registerStudent({
        ...profile,
        name: v.name.trim(),
        address: v.address.trim(),
        contact: v.contact.replace(/[\s-]/g, ""),
        studentNo: `${digits.slice(0, 4)}-${digits.slice(4)}`,
        termsAccepted: accepted,
      });
      setDone(session);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // Passes a session so App.jsx logs the new student in and opens #dashboard.
  const continueToDashboard = () => {
    onSuccess(done);
  };

  if (done) {
    const student = done.user;
    const first = student.name.split(" ")[0];
    return (
      <div className="lpf-card lpf-success" role="status">
        <div className="lpf-success-icon">
          <Check size={24} />
        </div>
        <p className="lpf-eyebrow">Account created</p>
        <h3 className="lpf-title">You’re in, {first}.</h3>
        <p className="lpf-sub">
          Your borrower account is ready. You can now reserve a laptop from the
          CSD fleet.
        </p>

        <dl className="lpf-summary">
          <div>
            <dt>Student ID</dt>
            <dd>            {student.studentNo}</dd>
          </div>
          <div>
            <dt>Program</dt>
            <dd>{student.program}</dd>
          </div>
          <div>
            <dt>Year &amp; block</dt>
            <dd>
              {student.year} · Block {student.block}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          className="lp-btn lp-btn-primary lpf-submit"
          onClick={continueToDashboard}
          autoFocus
        >
          Go to my dashboard <ArrowRight size={16} />
        </button>
        <p className="lpf-alt">
          You can log back in anytime with your student ID.
        </p>
        <p className="lpf-legal-note">
          You accepted the{" "}
          <button type="button" className="lpf-link" onClick={() => setLegalDoc("terms")}>
            Terms &amp; Conditions
          </button>{" "}
          and{" "}
          <button type="button" className="lpf-link" onClick={() => setLegalDoc("privacy")}>
            Privacy Policy
          </button>{" "}
          on{" "}
          {new Date(student.termsAcceptedAt || Date.now()).toLocaleDateString([], {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
          .
        </p>

        <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
      </div>
    );
  }

  return (
    <>
    <form
      className="lpf-card"
      onSubmit={submit}
      noValidate
      aria-label="Student sign up"
      aria-busy={busy}
    >
      <div className="lpf-head">
        <div className="lpf-head-icon">
          <GraduationCap size={20} />
        </div>
        <div>
          <h3 className="lpf-title">Student sign up</h3>
          <p className="lpf-sub">Create your borrower account in under a minute.</p>
        </div>
      </div>

      {formError && (
        <p className="lpf-form-error" role="alert">
          {formError}
        </p>
      )}

      <div className="lpf-fields">
        <Field id="signup-name" label="Full name" error={errors.name}>
          <input
            {...bind("name")}
            type="text"
            autoComplete="name"
            placeholder="Juan Dela Cruz"
          />
        </Field>

        <Field id="signup-address" label="Address" error={errors.address}>
          <input
            {...bind("address")}
            type="text"
            autoComplete="street-address"
            placeholder="Brgy., Municipality/City, Province"
          />
        </Field>

        <div className="lpf-row">
          <Field
            id="signup-contact"
            label="Contact number"
            error={errors.contact}
          >
            <input
              {...bind("contact")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0917 123 4567"
            />
          </Field>
          <Field
            id="signup-studentNo"
            label="Student ID number"
            error={errors.studentNo}
          >
            <input
              {...bind("studentNo")}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="2023-01482"
            />
          </Field>
        </div>

        <div className="lpf-row">
          <Field id="signup-password" label="Password (12+ characters)" error={errors.password}>
            <input
              {...bind("password")}
              type="password"
              autoComplete="new-password"
              maxLength={72}
            />
          </Field>
          <Field id="signup-confirmPassword" label="Confirm password" error={errors.confirmPassword}>
            <input
              {...bind("confirmPassword")}
              type="password"
              autoComplete="new-password"
              maxLength={72}
            />
          </Field>
        </div>

        <Field id="signup-program" label="Program" error={errors.program}>
          <select {...bind("program")}>
            <option value="">Select your program</option>
            {PROGRAMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>

        <div className="lpf-row">
          <Field id="signup-year" label="Year level" error={errors.year}>
            <select {...bind("year")}>
              <option value="">Select</option>
              {YEARS.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </Field>
          <Field id="signup-block" label="Block" error={errors.block}>
            <select {...bind("block")}>
              <option value="">Select</option>
              {BLOCKS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="lpf-consent">
        <input
          id="signup-consent"
          type="checkbox"
          checked={accepted}
          onChange={(e) => {
            setAccepted(e.target.checked);
            if (consentError) setConsentError("");
          }}
          aria-invalid={consentError ? "true" : undefined}
          aria-describedby={consentError ? "signup-consent-error" : undefined}
          required
        />
        <label htmlFor="signup-consent">
          I agree to the{" "}
          <button type="button" className="lpf-link" onClick={() => setLegalDoc("terms")}>
            Terms &amp; Conditions
          </button>{" "}
          and{" "}
          <button type="button" className="lpf-link" onClick={() => setLegalDoc("privacy")}>
            Privacy Policy
          </button>.
        </label>
      </div>
      {consentError && (
        <p className="lpf-err" id="signup-consent-error" role="alert">
          {consentError}
        </p>
      )}

      <button
        className="lp-btn lp-btn-primary lpf-submit"
        disabled={busy}
        type="submit"
      >
        {busy ? (
          "Creating account…"
        ) : (
          <>
            Create account <ArrowRight size={16} />
          </>
        )}
      </button>

      <p className="lpf-alt">
        Already registered?{" "}
        <button type="button" className="lpf-link" onClick={onLogin}>
          Log in
        </button>
      </p>
    </form>
    <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />
    </>
  );
}
