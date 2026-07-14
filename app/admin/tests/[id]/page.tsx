import { RouteGuard } from "@/components/route-guard";
import { TestEditor } from "@/components/test-editor";

export default async function AdminTestEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RouteGuard admin>
      <TestEditor testId={id} />
    </RouteGuard>
  );
}
