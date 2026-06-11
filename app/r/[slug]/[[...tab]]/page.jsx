import SpacePageClient from "../../../../src/components/SpacePageClient";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const readableName = slug.replaceAll("-", " ");
  const title = `${readableName} on mumbl`;
  const description = "read the team notes, patterns, and heartbeat from this mumbl room.";

  return {
    title,
    description,
    alternates: {
      canonical: `/r/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/r/${slug}`,
    },
    twitter: {
      title,
      description,
    },
  };
}

export default async function SpacePage({ params }) {
  const { slug, tab } = await params;
  return <SpacePageClient slug={slug} tab={tab?.[0] || "reads"} />;
}
