export default function Stat({ label, value, sub, icon: Icon, tone = "", danger }) {
  return (
    <div className="csd-card flex items-start justify-between gap-3 p-5">
      <div className="min-w-0">
        <p className="csd-label">{label}</p>
        <p className={`csd-display truncate ${danger ? "csd-red" : ""}`} style={{ fontSize: 30, marginTop: 8 }}>{value}</p>
        <p className="csd-mut" style={{ fontSize: 12, marginTop: 4 }}>{sub}</p>
      </div>
      <div className={`csd-tile ${tone}`}><Icon size={19} /></div>
    </div>
  );
}
