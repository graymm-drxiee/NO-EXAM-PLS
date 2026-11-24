import { AlertTriangle, Check } from "lucide-react";

/* One toast for success and failure. `toast` is { message, tone } or null. */
export default function Toast({ toast, onClose }) {
  if (!toast?.message) return null;
  const error = toast.tone === "error";
  return (
    <div role={error ? "alert" : "status"} className={`csd-toast ${error ? "is-error" : ""}`} onClick={onClose}>
      {error ? <AlertTriangle size={16} /> : <Check size={16} />}
      {toast.message}
    </div>
  );
}
