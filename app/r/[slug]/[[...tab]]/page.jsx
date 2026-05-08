import SpacePageClient from "../../../../src/components/SpacePageClient";

export default async function SpacePage({ params }) {
  const { slug, tab } = await params;
  return <SpacePageClient slug={slug} tab={tab?.[0] || "feed"} />;
}
