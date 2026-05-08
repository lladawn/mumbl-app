import CreatePageClient from "../../src/components/CreatePageClient";

export const metadata = {
  title: "create a space",
  description: "create an anonymous-first mumbl room for your team in 30 seconds.",
  alternates: {
    canonical: "/create",
  },
  openGraph: {
    title: "create a mumbl space",
    description: "create an anonymous-first room for the honest engineering thoughts that never survive standup.",
    url: "/create",
  },
  twitter: {
    title: "create a mumbl space",
    description: "create an anonymous-first room for the honest engineering thoughts that never survive standup.",
  },
};

export default function CreatePage() {
  return <CreatePageClient />;
}
