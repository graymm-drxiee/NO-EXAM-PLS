import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";

const READ_KEY = "csd_notifications_read";

function readIds() {
  try {
    const value = JSON.parse(localStorage.getItem(READ_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/* Bell + dropdown. Always opens, even with nothing to show. */
export default function Notifications({ items = [] }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState(readIds);
  const wrapRef = useRef(null);

  // Opening the panel marks everything currently listed as read.
  useEffect(() => {
    if (!open || !items.length) return;
    if (items.every((n) => read.includes(n.id))) return;
    const ids = [...new Set([...read, ...items.map((n) => n.id)])].slice(-200);
    setRead(ids);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(ids));
    } catch {
      // Storage may be unavailable; the panel still works for this visit.
    }
  }, [open, items, read]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = items.filter((n) => !read.includes(n.id)).length;

  return (
    <div className="csd-notif" ref={wrapRef}>
      <button
        type="button"
        className="csd-iconbtn csd-notif-btn"
        aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={17} />
        {unread > 0 && <span className="csd-notif-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="csd-notif-panel" role="dialog" aria-label="Notifications">
          <header className="csd-notif-head">
            <h2>Notifications</h2>
            <span>{unread ? `${unread} new` : items.length ? "All read" : "All caught up"}</span>
          </header>

          {items.length === 0 ? (
            <div className="csd-notif-empty">
              <BellOff size={22} />
              <p>Nothing needs your attention right now. We'll let you know here.</p>
            </div>
          ) : (
            <ul className="csd-notif-list">
              {items.map((n) => (
                <li key={n.id} className={`tone-${n.tone || "info"} ${read.includes(n.id) ? "is-read" : ""}`}>
                  {n.onClick ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        n.onClick();
                      }}
                    >
                      <strong>{n.title}</strong>
                      <span>{n.body}</span>
                    </button>
                  ) : (
                    <div>
                      <strong>{n.title}</strong>
                      <span>{n.body}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
