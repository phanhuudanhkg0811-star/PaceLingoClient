import { PublishedTestList } from "@/components/published-test-list";
import { RouteGuard } from "@/components/route-guard";

export default function TestsPage() {
  return (
    <RouteGuard>
      <PublishedTestList />
    </RouteGuard>
  );
}
