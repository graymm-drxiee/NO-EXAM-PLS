export const H = 36e5; // one hour in ms
export const CLASS_START_HOUR = 9;
export const CLASS_END_HOUR = 16;
export const LOOKAHEAD_DAYS = 7; // how far ahead the fleet calendar looks

/* Keep these lists in sync with backend/controllers/authController.js */
export const PROGRAMS = [
  "BS Computer Science",
  "BS Information Technology",
  "BS Information Technology major in Animation",
  "BS Information Systems",
  "Associate in Computer Technology",
];
export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
export const BLOCKS = ["A", "B", "C", "D"];

/* ------------------------------ helpers ------------------------------ */
export const fmt = (d) => new Date(d).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const short = (d) => new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
export const toInput = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
export const statusOf = (l, now) => {
  if (l.cancelled) return "cancelled";
  if (l.returned) return "returned";
  if (l.approved === false) return "pending";
  if (now < +new Date(l.start)) return "upcoming";
  if (now <= +new Date(l.end)) return "active";
  return "overdue";
};
export const left = (end, now) => {
  const m = Math.max(0, Math.round((+new Date(end) - now) / 6e4));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`;
};
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

// Same rules as the backend: one day, Mon–Fri, 9:00 AM – 4:00 PM school time (UTC+8).
const schoolTime = (d) => {
  const local = new Date(+d + 8 * 36e5);
  return {
    date: local.toISOString().slice(0, 10),
    weekday: local.getUTCDay(),
    msOfDay: (local.getUTCHours() * 60 + local.getUTCMinutes()) * 6e4 + local.getUTCSeconds() * 1000 + local.getUTCMilliseconds(),
  };
};

export const loanWindowError = (start, end, now = Date.now()) => {
  const s = new Date(start), t = new Date(end);
  if (Number.isNaN(+s) || Number.isNaN(+t)) return "Enter a valid pick-up and return time.";
  if (s < now) return "Pick-up time can't be in the past.";
  if (t <= s) return "Return time must be after pick-up time.";
  const a = schoolTime(s), b = schoolTime(t);
  if (a.date !== b.date) return "Loans last one day only — pick-up and return must be on the same day.";
  if (a.weekday === 0 || a.weekday === 6) return "Loans are available on class days (Mon–Fri) only.";
  if (a.msOfDay < CLASS_START_HOUR * 36e5 || b.msOfDay > CLASS_END_HOUR * 36e5) return "Pick-up and return must be within class hours (9:00 AM – 4:00 PM).";
  return "";
};
