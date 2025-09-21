import { AssessmentBuilderClient } from './builder-client';

export default async function AssessmentBuilderPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <AssessmentBuilderClient jobId={Number(jobId)} />;
}