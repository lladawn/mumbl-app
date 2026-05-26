import PublicProfilePage, { getPublicProfileMetadata } from "../../../src/components/PublicProfilePage";

export async function generateMetadata({ params }) {
  const { handle } = await params;
  return getPublicProfileMetadata(handle);
}

export default async function RewrittenPublicProfilePage({ params }) {
  const { handle } = await params;
  return <PublicProfilePage rawHandle={handle} />;
}
