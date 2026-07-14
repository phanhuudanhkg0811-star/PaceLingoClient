import { JsonImportWorkbench } from "@/components/json-import-workbench";
import { RouteGuard } from "@/components/route-guard";

export default function AdminImportsPage() {
  return (
    <RouteGuard admin>
      <JsonImportWorkbench />
    </RouteGuard>
  );
}
