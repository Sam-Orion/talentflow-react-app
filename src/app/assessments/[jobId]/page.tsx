import { AssessmentBuilderClient } from './builder-client';

export default function AssessmentBuilderPage({ params }: { params: { jobId: string } }) {
  return <AssessmentBuilderClient jobId={Number(params.jobId)} />;
}