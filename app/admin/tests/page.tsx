import { RouteGuard } from "@/components/route-guard";
import { TestDraftList } from "@/components/test-draft-list";

export default function AdminTestsPage() {
  return (
    <RouteGuard admin>
      <TestDraftList />
    </RouteGuard>
  );
}
