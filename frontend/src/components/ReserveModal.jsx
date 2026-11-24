import { useState } from "react";
import { X } from "lucide-react";
import { api } from "../api/api";
import { CLASS_END_HOUR, CLASS_START_HOUR, loanWindowError, toInput } from "../utils/helpers";
import useDialog from "../utils/useDialog";

// Default to the next free hour today, or tomorrow morning after class hours.
function defaultStart(now) {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  if (d.getDay() === 0 || d.getDay() === 6 || d.getHours() >= CLASS_END_HOUR - 1) {
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    d.setHours(CLASS_START_HOUR, 0, 0, 0);
  } else {
    d.setHours(Math.max(CLASS_START_HOUR, d.getHours() + 1), 0, 0, 0);
  }
  return d;
}

export default function ReserveModal({ laptop, onClose, onDone }) {
  const [start, setStart] = useState(() => toInput(defaultStart(new Date())));
  const [end, setEnd] = useState(() => {
    const d = defaultStart(new Date());
    d.setHours(CLASS_END_HOUR, 0, 0, 0);
    return toInput(d);
  });
  const [purpose, setPurpose] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { panelRef } = useDialog(onClose);

  const submit = async (e) => {
    e.preventDefault();
    const s = new Date(start), t = new Date(end);
    const problem = loanWindowError(s, t);
    if (problem) return setError(problem);
    setSaving(true); setError("");
    try {
      await api.createLoan({ laptopId: laptop.id, start: s.toISOString(), end: t.toISOString(), purpose: purpose.trim() });
      onDone();
    } catch (err) {
      setError(err.message); setSaving(false);
    }
  };

  const lab = { display: "block", fontSize: 14, fontWeight: 600 };
  return (
    <div className="csd-overlay" onClick={onClose}>
      <form ref={panelRef} className="csd-modal" role="dialog" aria-modal="true" aria-label={`Reserve ${laptop.model}`} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="csd-display" style={{ fontSize: 26 }}>Reserve {laptop.model}</h2>
            <p className="csd-dim" style={{ fontSize: 12 }}>{laptop.tag} · one day, class hours only (9 AM – 4 PM, Mon–Fri)</p>
          </div>
          <button type="button" className="csd-burger" style={{ display: "inline-flex" }} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={lab}>Pick up<input className="csd-field" type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label style={lab}>Return by<input className="csd-field" type="datetime-local" required value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <label style={lab}>What will you use it for? <span className="csd-dim" style={{ fontWeight: 400 }}>(optional)</span>
            <input className="csd-field" type="text" maxLength={80} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Thesis coding" />
          </label>
        </div>
        {error && <p role="alert" className="csd-error">{error}</p>}
        <div className="flex justify-end gap-2" style={{ marginTop: 20 }}>
          <button type="button" className="csd-ghost" onClick={onClose}>Cancel</button>
          <button className="csd-pill" disabled={saving}>{saving ? "Sending request…" : "Request reservation"}</button>
        </div>
      </form>
    </div>
  );
}
