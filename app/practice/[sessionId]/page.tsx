import { RetryPractice } from "@/components/retry-practice";
import { RouteGuard } from "@/components/route-guard";

export default async function PracticePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return (
    <RouteGuard>
      <RetryPractice sessionId={sessionId} />
    </RouteGuard>
  );
}
