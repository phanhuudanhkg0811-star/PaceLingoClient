import { CandidateExam } from "@/components/candidate-exam";
import { RouteGuard } from "@/components/route-guard";

export default async function ExamPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  return (
    <RouteGuard>
      <CandidateExam testId={testId} />
    </RouteGuard>
  );
}
