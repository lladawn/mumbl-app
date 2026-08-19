import Link from "next/link";

// lightweight inline-code support: `foo` -> <code>foo</code>. No other markdown.
function renderInline(text) {
  const parts = text.split(/`([^`]+)`/g);
  return parts.map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part));
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function BlogPost({ post }) {
  return (
    <article className="blog-post pixel-screen">
      <header className="blog-hero">
        <p className="eyebrow">blog</p>
        <h1>{post.title}</h1>
        <p className="blog-dek">{post.dek}</p>
        <p className="blog-byline">
          {post.author} · <time dateTime={post.date}>{formatDate(post.date)}</time>
        </p>
      </header>

      <div className="blog-body">
        {post.body.map((block, i) =>
          block.type === "quote" ? (
            <blockquote className="blog-quote" key={i}>
              <p>{renderInline(block.text)}</p>
              {block.cite ? <cite>{block.cite}</cite> : null}
            </blockquote>
          ) : (
            <p key={i}>{renderInline(block.text)}</p>
          )
        )}
      </div>

      {post.furtherReading?.length ? (
        <aside className="blog-further-reading" aria-label="further reading">
          <span className="eyebrow">further reading</span>
          <ul>
            {post.furtherReading.map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      {post.closing ? (
        <footer className="blog-closing">
          <p>{post.closing}</p>
          <Link className="text-link" href="/blog">
            back to mumbl blog
          </Link>
        </footer>
      ) : null}
    </article>
  );
}
