import { notFound } from "next/navigation";
import ExpandableText from "./ExpandableText";
import { getSupabaseAdmin } from "../server/supabase";
import { normalizeHandle, serializePublicProfile } from "../server/publicProfiles";

export async function getPublicProfileMetadata(rawHandle) {
  const handle = normalizeHandle(rawHandle);
  if (!handle) return {};

  return {
    title: `@${handle}`,
    description: `how ${handle} actually thinks at work.`,
  };
}

export default async function PublicProfilePage({ rawHandle }) {
  const handle = normalizeHandle(rawHandle);
  if (!handle) notFound();

  const supabase = getSupabaseAdmin();
  const { data: profile, error } = await supabase.from("public_profiles").select("*").eq("handle", handle).single();
  if (error?.code === "PGRST116") {
    return <PublicProfileShell publicProfile={{ handle, displayName: handle, bio: "", posts: [] }} />;
  }
  if (isMissingTableError(error)) notFound();
  if (error) throw error;

  const { data: fieldNotes, error: notesError } = await supabase
    .from("field_notes")
    .select("id, title, content, created_at, public_published_at")
    .eq("public_profile_id", profile.id)
    .eq("is_public", true)
    .eq("is_published", true)
    .order("public_published_at", { ascending: false })
    .limit(40);
  if (isMissingTableError(notesError) || isMissingColumnError(notesError)) notFound();
  if (notesError) throw notesError;

  return <PublicProfileShell publicProfile={serializePublicProfile(profile, fieldNotes || [])} />;
}

function PublicProfileShell({ publicProfile }) {
  return (
    <section className="public-profile-view">
      <header className="public-profile-hero">
        <div>
          <p className="eyebrow">public mumbl</p>
          <h1>@{publicProfile.handle}</h1>
          <p>how {publicProfile.displayName || publicProfile.handle} actually thinks at work.</p>
          {publicProfile.bio ? <p className="public-profile-bio">{publicProfile.bio}</p> : null}
        </div>
        <button className="ghost-button" type="button" disabled>
          follow soon
        </button>
      </header>

      <div className="public-profile-list">
        {!publicProfile.posts.length && (
          <div className="empty-state">nothing public here yet. the good stuff appears only when @{publicProfile.handle} chooses it.</div>
        )}
        {publicProfile.posts.map((post) => (
          <article className="public-note-card" key={post.id}>
            <div className="public-note-meta">
              <span>field note</span>
              <time dateTime={new Date(post.publishedAt || post.createdAt).toISOString()}>
                {formatPublicDate(post.publishedAt || post.createdAt)}
              </time>
            </div>
            <h2>{post.title}</h2>
            <ExpandableText className="public-note-text" text={post.content} limit={760} />
          </article>
        ))}
      </div>
    </section>
  );
}

function formatPublicDate(timestamp) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}

function isMissingTableError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || message.includes("could not find the table");
}

function isMissingColumnError(error) {
  const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
  return error?.code === "42703" || error?.code === "PGRST204" || (message.includes("could not find") && message.includes("column"));
}
