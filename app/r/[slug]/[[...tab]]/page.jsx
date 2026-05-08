import SpacePageClient from "../../../../src/components/SpacePageClient";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const readableName = slug.replaceAll("-", " ");
  const title = `${readableName} on mumbl`;
  const description = "join this anonymous-first team room and say the thing before it becomes a meeting.";

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
  return <SpacePageClient slug={slug} tab={tab?.[0] || "feed"} />;
}
