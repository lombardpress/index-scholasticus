import { BookView } from "../../../components/views";
import { bookParams } from "../../../components/data";

interface PageProps {
  params: Promise<{ work: string; book: string }>;
}

export async function generateStaticParams() {
  return bookParams("reverse");
}

export default async function CitingBookPage({ params }: PageProps) {
  const { work, book } = await params;
  return <BookView direction="reverse" work={work} book={book} />;
}
