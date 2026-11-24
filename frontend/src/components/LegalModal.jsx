import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export const LEGAL_DOCS = {
  terms: {
    title: "Terms & Conditions",
    updated: "13 November 2026",
    intro:
      "These terms cover your use of the CSD Laptop Borrowing System and the department-owned machines reserved through it.",
    sections: [
      {
        h: "Eligibility",
        p: "Borrowing is limited to currently enrolled CSD students with an active borrower account. Accounts are tied to your student ID and may not be shared or transferred.",
      },
      {
        h: "Reservations and pick-up",
        p: "Reservations are subject to laptop availability and CSD office approval. Pick up and return within the scheduled window. Unclaimed reservations may be released to other students.",
      },
      {
        h: "Loan period",
        p: "Each loan lasts one day and runs inside class hours, 9:00 AM to 4:00 PM, Monday to Friday. Pick up and return on the same day; extensions are not available.",
      },
      {
        h: "Care and liability",
        p: "You are responsible for the laptop from pick-up to return. Report damage, loss, or theft immediately. Repair or replacement costs may apply for damage caused by misuse or neglect.",
      },
      {
        h: "Acceptable use",
        p: "Use the laptop for legitimate academic work. Do not install unlicensed software, alter system settings, or use the machine for unlawful activity.",
      },
      {
        h: "Account suspension",
        p: "The CSD office may suspend an account for overdue returns, policy violations, or unpaid obligations. Suspended accounts cannot reserve or borrow laptops.",
      },
      {
        h: "Changes",
        p: "The department may update these terms as the program evolves. Continued use of the system after an update means you accept the revised terms.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "13 November 2026",
    intro:
      "This policy explains what the CSD Laptop Borrowing System collects, why it collects it, and who can see it.",
    sections: [
      {
        h: "What we collect",
        p: "We collect your name, address, contact number, student ID, program, year level, and block when you create an account. We also record reservations, pick-up and return times, and account status.",
      },
      {
        h: "Why we collect it",
        p: "Your details identify you as the borrower, let the CSD office contact you about a loan, and keep the fleet and reservation records accurate.",
      },
      {
        h: "Who can see it",
        p: "CSD staff can view borrower and loan records for program administration. Other students cannot see your profile or contact details.",
      },
      {
        h: "Where it is stored",
        p: "Account and loan data are stored in the borrowing system used by the CSD office. Access is limited to authorised staff and the systems that operate the service.",
      },
      {
        h: "How long we keep it",
        p: "Borrower records are kept while your account is active and for as long as the department needs them for loan history, audit, and accountability.",
      },
      {
        h: "Your choices",
        p: "You may ask the CSD office to review, correct, or close your account. Some loan records may be retained where the department has a legitimate record-keeping need.",
      },
      {
        h: "Contact",
        p: "Questions about your data can be raised with the CSD office during office hours, 9:00 AM to 4:00 PM.",
      },
    ],
  },
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function LegalModal({ doc, onClose }) {
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;

  useEffect(() => {
    if (!doc) return;
    const previous = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeHandler.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [doc]);

  if (!doc) return null;
  const content = LEGAL_DOCS[doc];
  if (!content) return null;

  return (
    <div className="legal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="legal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-title"
        ref={panelRef}
      >
        <div className="legal-top">
          <div>
            <p className="legal-kicker">CSD Laptop Borrowing</p>
            <h2 className="legal-title" id="legal-title">
              {content.title}
            </h2>
            <p className="legal-updated">Last updated {content.updated}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="legal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="legal-body" tabIndex={0}>
          <p className="legal-intro">{content.intro}</p>
          {content.sections.map((section) => (
            <section key={section.h}>
              <h3>{section.h}</h3>
              <p>{section.p}</p>
            </section>
          ))}
        </div>

        <div className="legal-foot">
          <button type="button" className="lp-btn lp-btn-primary lp-btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
