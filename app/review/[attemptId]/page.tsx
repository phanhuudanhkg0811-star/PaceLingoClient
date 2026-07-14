import { AttemptReviewView } from "@/components/attempt-review";
import { RouteGuard } from "@/components/route-guard";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return (
    <RouteGuard>
      <AttemptReviewView attemptId={attemptId} />
    </RouteGuard>
  );
}
