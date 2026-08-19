import { notFound } from "next/navigation";
import { blogPosts, getBlogPost } from "../../../src/content/blog-posts";
import BlogPost from "../../../src/components/BlogPost";

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.dek,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: `${post.title} · mumbl`,
      description: post.dek,
      url: `/blog/${post.slug}`,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      title: `${post.title} · mumbl`,
      description: post.dek,
    },
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return <BlogPost post={post} />;
}
