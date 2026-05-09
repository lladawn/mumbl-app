import { getSupabaseAdmin } from "./supabase";

const THEME_KEYWORDS = [
  ["sprint planning", ["sprint", "planning", "estimate", "estimation", "points"]],
  ["deployment anxiety", ["deploy", "deployment", "release", "rollback", "prod"]],
  ["ci and flaky tests", ["ci", "test", "flaky", "pipeline", "build"]],
  ["unclear requirements", ["requirements", "spec", "scope", "ticket", "unclear"]],
  ["tooling friction", ["tool", "cli", "workflow", "local", "setup"]],
];

export async function getExploreSummary() {
  const supabase = getSupabaseAdmin();
  const weekStart = currentMondayDate();

  const { data: spaces, error: spacesError } = await supabase
    .from("spaces")
    .select("id,member_count,is_public")
    .eq("is_public", true);
  if (spacesError) throw spacesError;

  const spaceIds = spaces.map((space) => space.id);
  if (!spaceIds.length) {
    return emptySummary(weekStart);
  }

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("id,space_id,type,content,is_anonymous,created_at")
    .in("space_id", spaceIds)
    .gte("created_at", `${weekStart}T00:00:00.000Z`);
  if (postsError) throw postsError;

  const postIds = posts.map((post) => post.id);
  const { data: reactions, error: reactionsError } = postIds.length
    ? await supabase.from("reactions").select("post_id").in("post_id", postIds)
    : { data: [], error: null };
  if (reactionsError) throw reactionsError;

  const anonymousPosts = posts.filter((post) => post.is_anonymous).length;
  const anonPercentage = posts.length ? Number(((anonymousPosts / posts.length) * 100).toFixed(2)) : 0;
  const topRantTheme = topTheme(posts.filter((post) => post.type === "rant"));
  const topWinTheme = topTheme(posts.filter((post) => post.type === "win"));
  const mostActiveDay = mostActiveWeekday(posts);

  return {
    weekOf: weekStart,
    totalPublicSpaces: spaces.length,
    totalPosts: posts.length,
    totalReactions: reactions.length,
    anonPercentage,
    topRantTheme,
    topWinTheme,
    mostActiveDay,
    culturePulse: makeCulturePulse({ posts, reactions, topRantTheme, topWinTheme }),
  };
}

function emptySummary(weekOf) {
  return {
    weekOf,
    totalPublicSpaces: 0,
    totalPosts: 0,
    totalReactions: 0,
    anonPercentage: 0,
    topRantTheme: "nothing loud yet",
    topWinTheme: "waiting for the first brag",
    mostActiveDay: "too quiet to call",
    culturePulse: "the public pulse is warming up. somebody has to be first.",
  };
}

function topTheme(posts) {
  if (!posts.length) return "not enough signal yet";
  const scores = new Map(THEME_KEYWORDS.map(([theme]) => [theme, 0]));
  for (const post of posts) {
    const content = post.content.toLowerCase();
    for (const [theme, keywords] of THEME_KEYWORDS) {
      if (keywords.some((keyword) => content.includes(keyword))) {
        scores.set(theme, scores.get(theme) + 1);
      }
    }
  }
  const [theme, count] = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? theme : "general work chaos";
}

function mostActiveWeekday(posts) {
  if (!posts.length) return "too quiet to call";
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const counts = new Map(days.map((day) => [day, 0]));
  for (const post of posts) {
    const day = days[new Date(post.created_at).getUTCDay()];
    counts.set(day, counts.get(day) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function makeCulturePulse({ posts, reactions, topRantTheme, topWinTheme }) {
  if (!posts.length) return "quiet week in public. suspicious, but not fatal.";
  if (topRantTheme !== "not enough signal yet") {
    return `${topRantTheme} is making noise, but ${topWinTheme} is keeping the lights on.`;
  }
  if (reactions.length > posts.length * 2) {
    return "people are reacting more than posting. classic engineering team behavior, honestly.";
  }
  return "the public rooms are alive, a little messy, and very much at work.";
}

function currentMondayDate() {
  const now = new Date();
  const day = now.getUTCDay() || 7;
  now.setUTCDate(now.getUTCDate() - day + 1);
  now.setUTCHours(0, 0, 0, 0);
  return now.toISOString().slice(0, 10);
}
