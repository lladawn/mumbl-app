import Link from "next/link";
import { blogPosts } from "../../src/content/blog-posts";

export const metadata = {
  title: "blog",
  description: "Field notes from building mumbl — the thinking behind the product, not just the changelog.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "mumbl blog",
    description: "Field notes from building mumbl — the thinking behind the product, not just the changelog.",
    url: "/blog",
  },
  twitter: {
    title: "mumbl blog",
    description: "Field notes from building mumbl — the thinking behind the product, not just the changelog.",
  },
};

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogIndexPage() {
  return (
    <section className="blog-index pixel-screen">
      <header className="blog-hero">
        <p className="eyebrow">blog</p>
        <h1>field notes.</h1>
        <p className="blog-dek">the thinking behind mumbl, as it happens.</p>
      </header>

      <ul className="blog-index-list">
        {blogPosts.map((post) => (
          <li key={post.slug}>
            <Link className="blog-index-item" href={`/blog/${post.slug}`}>
              <span className="blog-index-date">{formatDate(post.date)}</span>
              <span className="blog-index-title">{post.title}</span>
              <span className="blog-index-dek">{post.dek}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
