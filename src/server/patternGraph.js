import { cleanString } from "./validation";
import { decryptContentRows } from "./encryption";

const SEARCH_PROBES = [
  {
    id: "blockers",
    label: "blockers and stuck loops",
    tone: "clay",
    query: "private work notes about blockers, stuck loops, confusion, waiting, unresolved friction, things that keep coming back",
  },
  {
    id: "momentum",
    label: "momentum and wins",
    tone: "mint",
    query: "private work notes about wins, shipped work, progress, useful decisions, flow, energy, what is working",
  },
  {
    id: "team-process",
    label: "team process signals",
    tone: "gold",
    query: "private work notes about meetings, standup, planning, collaboration, handoffs, team process, communication gaps",
  },
  {
    id: "load",
    label: "load and attention",
    tone: "violet",
    query: "private work notes about tiredness, overload, attention, context switching, burnout, hard days, emotional load",
  },
];

export async function buildPatternGraph({ supabase, userId, dumps, patterns = [], signals = [], embedContent }) {
  const readableDumps = decryptContentRows("dumps", dumps, ["content", "ai_reflection", "source_meta"]);
  const readablePatterns = decryptContentRows("patterns", patterns, ["summary", "question"]);
  const signalByDumpId = new Map(signals.map((signal) => [signal.dump_id, signal]));
  const nodes = readableDumps.map((dump) => ({
    id: dump.id,
    kind: "dump",
    label: firstLine(dump.content),
    detail: signalByDumpId.get(dump.id)?.topics?.join(", ") || "",
    createdAt: dump.created_at,
    weight: signalByDumpId.get(dump.id)?.signal_strength === "strong" ? 2 : 1,
  }));

  const semanticGroups = embedContent ? await searchSemanticGroups({ supabase, userId, embedContent }) : [];
  const localGroups = groupSignals(signals);
  const groups = semanticGroups.length ? semanticGroups : localGroups;
  const themeNodes = groups.map((group) => ({
    id: `theme-${group.id}`,
    kind: "theme",
    label: group.label,
    detail: group.detail,
    tone: group.tone,
    weight: group.evidenceIds.length,
  }));

  return {
    nodes: [...themeNodes, ...nodes],
    edges: groups.flatMap((group) =>
      group.evidenceIds.slice(0, 6).map((dumpId) => ({ from: `theme-${group.id}`, to: dumpId, label: "shows up in" })),
    ),
    source: semanticGroups.length ? "pattern_graph" : "local",
    syncedCount: signals.filter((signal) => signal.extraction_status === "done").length,
    summary: makeSummary({ groups, dumps: readableDumps, signals }),
    insights: makeInsights({ signals, dumps: readableDumps }),
    patterns: makePatternCards({ patterns: readablePatterns, groups }),
  };
}

export function patternSearchProbes() {
  return SEARCH_PROBES;
}

async function searchSemanticGroups({ supabase, userId, embedContent }) {
  const groups = [];
  for (const probe of SEARCH_PROBES) {
    try {
      const embedding = await embedContent(probe.query);
      const { data, error } = await supabase.rpc("search_dumps_by_embedding", {
        query_embedding: embedding,
        match_user_id: userId,
        match_threshold: 0.72,
        match_count: 8,
      });
      if (error) throw error;
      const results = data || [];
      if (!results.length) continue;
      groups.push({
        ...probe,
        detail: `${results.length} private dump${results.length === 1 ? "" : "s"} cluster around ${probe.label}.`,
        evidenceIds: results.map((result) => result.dump_id),
      });
    } catch (error) {
      console.warn("pattern graph semantic probe failed", error);
    }
  }
  return dedupeGroups(groups);
}

function groupSignals(signals) {
  const buckets = new Map();
  for (const signal of signals) {
    for (const topic of signal.topics || []) {
      const id = slugTopic(topic);
      if (!id) continue;
      const current = buckets.get(id) || {
        id,
        label: topic,
        tone: toneForSignal(signal),
        evidenceIds: [],
        blockers: 0,
      };
      current.evidenceIds.push(signal.dump_id);
      if (signal.is_blocker) current.blockers += 1;
      buckets.set(id, current);
    }
  }

  return [...buckets.values()]
    .sort((a, b) => b.evidenceIds.length - a.evidenceIds.length)
    .slice(0, 4)
    .map((group) => ({
      ...group,
      detail: `${group.evidenceIds.length} private dump${group.evidenceIds.length === 1 ? "" : "s"} mention ${group.label}.`,
    }));
}

function makePatternCards({ patterns, groups }) {
  if (patterns.length) {
    return patterns.map((pattern, index) => ({
      id: pattern.id,
      title: `pattern from ${formatDate(pattern.created_at)}`,
      read: pattern.summary,
      why: pattern.triggered_at_count ? `noticed after ${pattern.triggered_at_count} private dumps` : "noticed from recent private dumps",
      nextStep: pattern.question,
      fieldNoteSeed: "keep this private, or turn the useful part into a field note when it feels ready.",
      privacy: pattern.user_confirmed ? "confirmed" : "private insight",
      tone: ["blue", "mint", "gold", "violet"][index % 4],
      evidenceIds: pattern.dump_ids || [],
    }));
  }

  return groups.length
    ? groups.slice(0, 4).map((group) => ({
        id: `pattern-${group.id}`,
        title: `${group.label} keeps showing up`,
        read: group.detail,
        why: `${group.evidenceIds.length} connected private dump${group.evidenceIds.length === 1 ? "" : "s"}.`,
        nextStep: "sit with the pattern before deciding whether any part belongs in a team read.",
        fieldNoteSeed: `what I am noticing about ${group.label}`,
        privacy: "private read",
        tone: group.tone,
        evidenceIds: group.evidenceIds,
      }))
    : [
        {
          id: "pattern-waiting",
          title: "No repeat pattern yet",
          read: "There is not enough processed material yet to say something useful without overreaching.",
          why: "private patterns need a few logged-in dumps first.",
          nextStep: "keep dumping normally. the shape appears after there is enough signal.",
          fieldNoteSeed: "nothing to draft yet.",
          privacy: "private read",
          tone: "blue",
          evidenceIds: [],
        },
      ];
}

function makeSummary({ groups, dumps, signals }) {
  const top = groups[0];
  if (!top) {
    return {
      headline: "No strong pattern yet",
      detail: dumps.length
        ? "Your private dumps are saved. The pattern layer needs a little more processed signal before it should speak."
        : "Write a logged-in private dump to start your working map.",
      nextStep: "keep dumping normally.",
    };
  }

  return {
    headline: `${top.label} keeps coming back`,
    detail: top.detail,
    nextStep: signals.some((signal) => signal.is_blocker)
      ? "there may be something stuck here worth naming privately first."
      : "notice the thread before turning any piece of it into a team read.",
  };
}

function makeInsights({ signals, dumps }) {
  const done = signals.filter((signal) => signal.extraction_status === "done");
  const blockers = done.filter((signal) => signal.is_blocker).length;
  const strong = done.filter((signal) => signal.signal_strength === "strong").length;
  return [
    {
      label: "processed",
      value: `${done.length}/${dumps.length}`,
      detail: "logged-in private dumps with signal extraction complete.",
      tone: "mint",
    },
    {
      label: "blockers",
      value: String(blockers),
      detail: "private dumps that look stuck or unresolved.",
      tone: blockers ? "clay" : "blue",
    },
    {
      label: "signal",
      value: strong ? "clear" : "forming",
      detail: strong ? `${strong} strong signal${strong === 1 ? "" : "s"} in recent dumps.` : "not enough strong signal yet.",
      tone: strong ? "gold" : "violet",
    },
  ];
}

function dedupeGroups(groups) {
  const seen = new Set();
  return groups.map((group) => {
    const evidenceIds = group.evidenceIds.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return { ...group, evidenceIds };
  }).filter((group) => group.evidenceIds.length);
}

function toneForSignal(signal) {
  if (signal.is_blocker || signal.energy === "low") return "clay";
  if (signal.energy === "high") return "mint";
  if ((signal.topics || []).some((topic) => /team|process|meeting|people/.test(topic))) return "gold";
  return "violet";
}

function firstLine(content) {
  return cleanString(content, 120).split(/\r?\n/).find(Boolean) || "private dump";
}

function slugTopic(topic) {
  return cleanString(topic, 40).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(timestamp));
}
