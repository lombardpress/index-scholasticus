import { WorkOverview } from "../../components/views";
import { workShortIds } from "../../components/data";

interface PageProps {
  params: Promise<{ source: string }>;
}

export async function generateStaticParams() {
  return workShortIds("forward").map((source) => ({ source }));
}

export default async function SourceOverview({ params }: PageProps) {
  const { source } = await params;
  return <WorkOverview direction="forward" work={source} />;
}
