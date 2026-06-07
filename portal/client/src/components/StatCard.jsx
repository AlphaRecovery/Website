export default function StatCard({ label, value }) {
  return (
    <article className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-name">{label}</div>
    </article>
  );
}
