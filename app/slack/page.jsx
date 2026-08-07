import HomeView from "../../src/components/HomeView";

// The root metadata is the agent-workspace pitch, so this page must state its
// own — it is a different product story to a different reader.
const description =
  "Hit /mumbl in Slack to capture a thought the moment it happens, then publish the ones worth sharing as a team read.";

export const metadata = {
  title: "mumbl for slack",
  description,
  alternates: { canonical: "/slack" },
  openGraph: {
    title: "mumbl for slack — save the why behind your team's work",
    description,
    url: "/slack",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "mumbl for slack — save the why behind your team's work",
    description,
  },
};

export default function SlackPage() {
  return <HomeView />;
}
