import { DirectionTemplateManager } from "@/components/direction-template-manager";
import { RouteGuard } from "@/components/route-guard";

export default function AdminDirectionsPage() {
  return (
    <RouteGuard admin>
      <DirectionTemplateManager />
    </RouteGuard>
  );
}
