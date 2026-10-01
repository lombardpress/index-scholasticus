import { BookView } from "../../../components/views";
import { bookParams } from "../../../components/data";

interface PageProps {
  params: Promise<{ source: string; book: string }>;
}

export async function generateStaticParams() {
  return bookParams("forward").map(({ work, book }) => ({ source: work, book }));
}

export default async function BookPage({ params }: PageProps) {
  const { source, book } = await params;
  return <BookView direction="forward" work={source} book={book} />;
}
