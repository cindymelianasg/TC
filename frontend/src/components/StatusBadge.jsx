import { STATUS_STYLES } from "@/constants/lines";

export default function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || STATUS_STYLES.REQUEST;
  return (
    <span className={`status-pill ${cls}`} data-testid={`status-${status?.toLowerCase().replace(/\s+/g, "-")}`}>
      {status}
    </span>
  );
}
