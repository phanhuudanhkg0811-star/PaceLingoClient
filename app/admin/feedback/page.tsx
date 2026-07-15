import { FeedbackInbox } from "@/components/feedback-inbox";
import { RouteGuard } from "@/components/route-guard";

export default function FeedbackPage() {
  return <RouteGuard admin><FeedbackInbox /></RouteGuard>;
}
