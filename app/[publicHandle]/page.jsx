import { notFound } from "next/navigation";
import PublicProfilePage, { getPublicProfileMetadata } from "../../src/components/PublicProfilePage";

export async function generateMetadata({ params }) {
  const { publicHandle } = await params;
  if (!publicHandle?.startsWith("@")) return {};
  return getPublicProfileMetadata(publicHandle);
}

export default async function RootPublicProfilePage({ params }) {
  const { publicHandle } = await params;
  if (!publicHandle?.startsWith("@")) notFound();
  return <PublicProfilePage rawHandle={publicHandle} />;
}
