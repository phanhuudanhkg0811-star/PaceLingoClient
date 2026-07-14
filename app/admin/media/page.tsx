import { MediaLibrary } from "@/components/media-library";
import { RouteGuard } from "@/components/route-guard";

export default function AdminMediaPage() {
  return (
    <RouteGuard admin>
      <MediaLibrary />
    </RouteGuard>
  );
}
