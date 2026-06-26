import PatternPageClient from "../../src/components/PatternPageClient";

export const metadata = {
  title: "private patterns",
  description: "private work patterns noticed from your logged-in mumbl dump.",
};

export default function PatternsPage() {
  return <PatternPageClient />;
}
