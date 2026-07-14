import { AttemptHistory } from "@/components/attempt-history";
import { RouteGuard } from "@/components/route-guard";

export default function HistoryPage() {
  return (
    <RouteGuard>
      <AttemptHistory />
    </RouteGuard>
  );
}
