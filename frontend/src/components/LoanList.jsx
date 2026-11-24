import { CalendarClock, Clock, Inbox, ArrowRight } from "lucide-react";
import { fmt } from "../utils/helpers";

export default function LoanList({ loans, nameOf, st, onCancel, empty, emptyIcon: EmptyIcon, emptyAction }) {
  if (!loans.length) {
    return (
      <div className="csd-empty">
        <div className="csd-empty-icon">
          {EmptyIcon ? <EmptyIcon size={28} /> : <Inbox size={28} />}
        </div>
        <p className="csd-empty-title">{empty}</p>
        {emptyAction && (
          <button className="csd-pill" onClick={emptyAction.onClick}>
            {emptyAction.label} <ArrowRight size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className="csd-card csd-list">
      {loans.map((l) => {
        const s = st(l);
        return (
          <li key={l.id} className="csd-loan-row">
            <div className="min-w-0">
              <p className="csd-loan-model">{nameOf(l.laptopId)?.model || "Laptop no longer in the fleet"}</p>
              <p className="csd-loan-meta"><CalendarClock size={13} /> Pick up {fmt(l.start)}</p>
              <p className="csd-loan-meta"><Clock size={13} /> Return {fmt(l.end)}</p>
              {l.purpose && <p className="csd-loan-purpose">{l.purpose}</p>}
              {l.cancelled && l.declineReason && (
                <p className="csd-loan-note">Declined: {l.declineReason}</p>
              )}
            </div>
            <div className="csd-loan-actions">
              <span className={`csd-chip ${s}`}>{s}</span>
              {(s === "upcoming" || s === "pending") && (
                <button className="csd-link" onClick={() => onCancel(l.id)}>Cancel</button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}