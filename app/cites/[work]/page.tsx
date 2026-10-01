import { WorkOverview } from "../../components/views";
import { workShortIds } from "../../components/data";

interface PageProps {
  params: Promise<{ work: string }>;
}

export async function generateStaticParams() {
  return workShortIds("reverse").map((work) => ({ work }));
}

export default async function CitingWorkOverview({ params }: PageProps) {
  const { work } = await params;
  return <WorkOverview direction="reverse" work={work} />;
}
