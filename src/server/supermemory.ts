import { getServerEnv } from "./env";

const SUPERMEMORY_BASE_URL = "https://api.supermemory.ai";

type PrivateDumpRow = {
  id: string;
  content: string;
  created_at: string;
  supermemory_id?: string | null;
  supermemory_status?: string | null;
};

type FieldNoteRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  published_at?: string | null;
  is_published?: boolean | null;
  supermemory_id?: string | null;
  supermemory_status?: string | null;
};

type AddMemoryResult = {
  id: string;
  status: string;
};

type GraphInsight = {
  label: string;
  value: string;
  detail: string;
  tone: "gold" | "mint" | "violet" | "clay" | "blue";
};

type GraphPattern = {
  id: string;
  title: string;
  read: string;
  why: string;
  nextStep: string;
  fieldNoteSeed: string;
  privacy: string;
  tone: GraphInsight["tone"];
  evidenceIds: string[];
};

type GraphNode = {
  id: string;
  kind: "theme" | "dump" | "field_note";
  label: string;
  detail?: string;
  createdAt?: string;
  weight?: number;
};

type ThemeNode = GraphNode & {
  kind: "theme";
  words: string[];
  tone: GraphInsight["tone"];
  semanticEvidenceIds?: string[];
  semanticMatchCount?: number;
};

type GraphEdge = {
  from: string;
  to: string;
  label: string;
};

export type DumpSearchProbe = {
  id: string;
  label: string;
  query: string;
  tone: GraphInsight["tone"];
};

type DumpSearchResult = {
  id?: string;
  memory?: string;
  chunk?: string;
  similarity?: number;
  metadata?: {
    dump_id?: string;
    field_note_id?: string;
    created_at?: string;
    type?: string;
  };
  probe?: Pick<DumpSearchProbe, "id" | "label" | "tone">;
};

type SemanticThemeGroup = {
  probe: NonNullable<DumpSearchResult["probe"]>;
  evidenceIds: Set<string>;
  snippets: string[];
  similarities: number[];
};

type GraphSourceItem = {
  id: string;
  content: string;
};

export function isSupermemoryConfigured() {
  return Boolean(getServerEnv().supermemoryApiKey);
}

export async function addFieldNoteMemory({
  fieldNote,
  sessionTokenHash,
}: {
  fieldNote: FieldNoteRow;
  sessionTokenHash: string;
}): Promise<AddMemoryResult | null> {
  const env = getServerEnv();
  if (!env.supermemoryApiKey) return null;
  const userId = dumpUserId(sessionTokenHash);

  const response = await fetch(`${SUPERMEMORY_BASE_URL}/v3/memories`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.supermemoryApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      customId: `mumbl-field-note-v1-${sessionTokenHash.slice(0, 32)}-${fieldNote.id}`,
      userId,
      content: `${fieldNote.title}\n\n${fieldNote.content}`,
      metadata: {
        product: "mumbl",
        type: "field_note",
        session_hash: sessionTokenHash,
        user_id: userId,
        field_note_id: fieldNote.id,
        title: fieldNote.title,
        is_published: Boolean(fieldNote.is_published),
        created_at: fieldNote.created_at,
        published_at: fieldNote.published_at || "",
      },
      containerTags: dumpContainerTags(sessionTokenHash),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || "Supermemory add memory failed");
  }

  return {
    id: data.id || data.memoryId || "",
    status: `field_note_scoped:${data.status || "queued"}`,
  };
}

export async function addPrivateDumpMemory({
  dump,
  sessionTokenHash,
}: {
  dump: PrivateDumpRow;
  sessionTokenHash: string;
}): Promise<AddMemoryResult | null> {
  const env = getServerEnv();
  if (!env.supermemoryApiKey) return null;
  const userId = dumpUserId(sessionTokenHash);

  const response = await fetch(`${SUPERMEMORY_BASE_URL}/v3/memories`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.supermemoryApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      customId: `mumbl-private-dump-opt-in-v1-${sessionTokenHash.slice(0, 32)}-${dump.id}`,
      userId,
      content: dump.content,
      metadata: {
        product: "mumbl",
        type: "private_dump_opt_in",
        session_hash: sessionTokenHash,
        user_id: userId,
        dump_id: dump.id,
        created_at: dump.created_at,
      },
      containerTags: dumpContainerTags(sessionTokenHash),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || "Supermemory private dump sync failed");
  }

  return {
    id: data.id || data.memoryId || "",
    status: `private_dump_opt_in:${data.status || "queued"}`,
  };
}

export async function searchDumpMemories({
  sessionTokenHash,
  query,
  limit = 12,
  threshold = 0.45,
  memoryType = "field_note",
}: {
  sessionTokenHash: string;
  query: string;
  limit?: number;
  threshold?: number;
  memoryType?: "field_note" | "private_dump_opt_in";
}) {
  const env = getServerEnv();
  if (!env.supermemoryApiKey) return [];
  const userId = dumpUserId(sessionTokenHash);

  const response = await fetch(`${SUPERMEMORY_BASE_URL}/v3/search`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.supermemoryApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      userId,
      containerTags: dumpContainerTags(sessionTokenHash),
      searchMode: "hybrid",
      limit,
      documentThreshold: threshold,
      chunkThreshold: threshold,
      onlyMatchingChunks: true,
      rerank: true,
      filters: {
        AND: [
          { key: "product", value: "mumbl" },
          { key: "session_hash", value: sessionTokenHash },
          { key: "type", value: memoryType },
        ],
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || "Supermemory search failed");
  }

  return Array.isArray(data.results) ? data.results : [];
}

export { searchDumpMemories as searchFieldNoteMemories };

export function searchPrivateDumpMemories(args: Omit<Parameters<typeof searchDumpMemories>[0], "memoryType">) {
  return searchDumpMemories({ ...args, memoryType: "private_dump_opt_in" });
}

export function makeDumpGraph({
  dumps,
  fieldNotes = [],
  includePrivateDumps = false,
  searchResults = [],
  source = "local",
}: {
  dumps: PrivateDumpRow[];
  fieldNotes?: FieldNoteRow[];
  includePrivateDumps?: boolean;
  searchResults?: unknown[];
  source?: "local" | "supermemory";
}) {
  const dumpNodes = dumps.slice(0, 24).map((dump) => ({
    id: dump.id,
    kind: "dump" as const,
    label: firstLine(dump.content),
    detail: dump.content,
    createdAt: dump.created_at,
  }));
  const fieldNoteNodes = fieldNotes.slice(0, 24).map((fieldNote) => ({
    id: fieldNote.id,
    kind: "field_note" as const,
    label: fieldNote.title,
    detail: fieldNote.content,
    createdAt: fieldNote.created_at,
  }));
  const evidenceNodes = includePrivateDumps ? dumpNodes : fieldNoteNodes;

  const sourceItems = makeGraphSourceItems({ dumps, fieldNotes, includePrivateDumps });
  const themeNodes = inferThemeNodes(sourceItems, fieldNotes, searchResults, includePrivateDumps);
  const rawEdges: GraphEdge[] = [];

  for (const theme of themeNodes) {
    for (const evidenceId of theme.semanticEvidenceIds || []) {
      if (evidenceNodes.some((node) => node.id === evidenceId)) {
        rawEdges.push({ from: theme.id, to: evidenceId, label: "semantic match" });
      }
    }

    for (const item of sourceItems) {
      const text = item.content.toLowerCase();
      if (theme.words.some((word) => text.includes(word))) {
        rawEdges.push({ from: theme.id, to: item.id, label: "shows up in" });
      }
    }
  }

  if (!rawEdges.length && sourceItems.length) {
    for (const item of sourceItems.slice(0, 8)) {
      rawEdges.push({ from: "theme-loose-thoughts", to: item.id, label: "contains" });
    }
    if (!themeNodes.some((theme) => theme.id === "theme-loose-thoughts")) {
      themeNodes.push({
        id: "theme-loose-thoughts",
        kind: "theme",
        label: "loose thoughts",
        detail: includePrivateDumps
          ? "Early graph shape from opted-in private dumps."
          : "Early graph shape from field notes you drafted.",
        weight: sourceItems.length,
        words: [],
        tone: "blue",
      });
    }
  }

  const topTheme = themeNodes.slice().sort((a, b) => (b.weight || 0) - (a.weight || 0))[0];
  const edges = dedupeEdges(rawEdges);

  return {
    source,
    syncedCount: includePrivateDumps
      ? fieldNotes.filter((fieldNote) => fieldNote.supermemory_id).length + dumps.filter((dump) => dump.supermemory_id).length
      : fieldNotes.filter((fieldNote) => fieldNote.supermemory_id).length,
    summary: makeGraphSummary({ dumps, fieldNotes, source, topTheme, includePrivateDumps }),
    insights: makeGraphInsights({ dumps, fieldNotes, source, topTheme, searchResults, includePrivateDumps }),
    patterns: makeGraphPatterns({ themes: themeNodes, evidenceNodes, dumps, fieldNotes, edges, source, includePrivateDumps }),
    nodes: [...themeNodes.map(stripThemeWords), ...evidenceNodes],
    edges,
  };
}

function makeGraphSourceItems({
  dumps,
  fieldNotes,
  includePrivateDumps,
}: {
  dumps: PrivateDumpRow[];
  fieldNotes: FieldNoteRow[];
  includePrivateDumps: boolean;
}): GraphSourceItem[] {
  if (includePrivateDumps) {
    return dumps.map((dump) => ({
      id: dump.id,
      content: dump.content,
    }));
  }

  return fieldNotes.map((fieldNote) => ({
    id: fieldNote.id,
    content: `${fieldNote.title}\n\n${fieldNote.content}`,
  }));
}

function inferThemeNodes(
  sourceItems: GraphSourceItem[],
  fieldNotes: FieldNoteRow[],
  searchResults: unknown[],
  includePrivateDumps: boolean,
): ThemeNode[] {
  const semanticThemes = inferSemanticThemes(fieldNotes, searchResults, includePrivateDumps);
  const buckets = [
    {
      id: "theme-stuck",
      label: "blocked decisions",
      words: ["stuck", "blocked", "waiting", "confused", "decision", "owner", "unclear"],
      tone: "clay" as const,
      advice: "The useful move is to name the missing decision, owner, or context.",
    },
    {
      id: "theme-process",
      label: "handoff friction",
      words: ["meeting", "standup", "process", "planning", "handoff", "review", "comment", "scope"],
      tone: "gold" as const,
      advice: "This can become a team read if it is framed as a system pattern.",
    },
    {
      id: "theme-ship",
      label: "momentum clues",
      words: ["shipped", "fixed", "win", "done", "demo", "merged", "worked"],
      tone: "mint" as const,
      advice: "Capture what made the work move so the team can repeat it.",
    },
    {
      id: "theme-heavy",
      label: "attention load",
      words: ["tired", "burn", "hard", "rough", "context", "switching", "load", "overload"],
      tone: "violet" as const,
      advice: "Keep this private until the ask is small and safe to say.",
    },
  ];

  const fromDumps: ThemeNode[] = buckets
    .map((bucket) => {
      const weight = sourceItems.filter((item) => bucket.words.some((word) => item.content.toLowerCase().includes(word))).length;
      return {
        ...bucket,
        kind: "theme" as const,
        detail: `${weight} source${weight === 1 ? "" : "s"}. ${bucket.advice}`,
        weight,
      };
    })
    .filter((bucket) => bucket.weight > 0);

  return [...semanticThemes, ...fromDumps].slice(0, 7);
}

function stripThemeWords(theme: ThemeNode): GraphNode {
  const { words, semanticEvidenceIds, semanticMatchCount, ...publicTheme } = theme;
  return publicTheme;
}

function inferSemanticThemes(fieldNotes: FieldNoteRow[], searchResults: unknown[], includePrivateDumps: boolean): ThemeNode[] {
  const grouped = new Map<string, SemanticThemeGroup>();
  const fieldNoteIds = new Set(fieldNotes.map((fieldNote) => fieldNote.id));

  for (const result of searchResults as DumpSearchResult[]) {
    if (!result?.probe?.id) continue;
    const evidenceId = includePrivateDumps && result.metadata?.dump_id ? result.metadata.dump_id : result.metadata?.field_note_id || "";
    if (!evidenceId || (!includePrivateDumps && !fieldNoteIds.has(evidenceId))) continue;

    const group: SemanticThemeGroup =
      grouped.get(result.probe.id) || {
        probe: result.probe,
        evidenceIds: new Set<string>(),
        snippets: [],
        similarities: [],
      };

    group.evidenceIds.add(evidenceId);
    const snippet = firstLine(result.memory || result.chunk || "");
    if (snippet && group.snippets.length < 2) group.snippets.push(snippet);
    if (typeof result.similarity === "number") group.similarities.push(result.similarity);
    grouped.set(result.probe.id, group);
  }

  return [...grouped.values()]
    .map((group) => {
      const averageSimilarity = group.similarities.length
        ? Math.round((group.similarities.reduce((total, value) => total + value, 0) / group.similarities.length) * 100)
        : null;
      const evidenceCount = group.evidenceIds.size;
      return {
        id: `theme-semantic-${group.probe.id}`,
        kind: "theme" as const,
        label: group.probe.label,
        detail: `${evidenceCount} related source${evidenceCount === 1 ? "" : "s"}${averageSimilarity ? ` · ${averageSimilarity}% match` : ""}. ${
          group.snippets[0] ? `Closest note: ${group.snippets[0]}` : "Connected by meaning, not just exact words."
        }`,
        weight: evidenceCount,
        words: [],
        tone: group.probe.tone,
        semanticEvidenceIds: [...group.evidenceIds],
        semanticMatchCount: group.similarities.length,
      };
    })
    .filter((theme) => theme.weight > 0)
    .sort((a, b) => (b.weight || 0) - (a.weight || 0));
}

function dedupeEdges(edges: GraphEdge[]) {
  const seen = new Set<string>();
  return edges.filter((edge) => {
    const key = `${edge.from}:${edge.to}:${edge.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function makeGraphPatterns({
  themes,
  evidenceNodes,
  dumps,
  fieldNotes,
  edges,
  source,
  includePrivateDumps,
}: {
  themes: ThemeNode[];
  evidenceNodes: GraphNode[];
  dumps: PrivateDumpRow[];
  fieldNotes: FieldNoteRow[];
  edges: GraphEdge[];
  source: "local" | "supermemory";
  includePrivateDumps: boolean;
}): GraphPattern[] {
  const patterns = themes
    .slice()
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, evidenceNodes.length < 2 ? 1 : 4)
    .map((theme) => {
      const evidenceIds = edges
        .filter((edge) => edge.from === theme.id)
        .map((edge) => edge.to)
        .filter((id) => evidenceNodes.some((node) => node.id === id))
        .slice(0, 4);
      const evidenceCount = evidenceIds.length || theme.weight || 0;

      return {
        id: `pattern-${theme.id}`,
        title: patternTitle(theme),
        read: patternRead(theme, source),
        why: patternWhy(theme, evidenceCount, source),
        nextStep: patternNextStep(theme),
        fieldNoteSeed: patternFieldNoteSeed(theme),
        privacy: patternPrivacy(theme),
        tone: theme.tone,
        evidenceIds,
      };
    });

  if (patterns.length) return patterns;

  if (!includePrivateDumps && !fieldNotes.length) {
    return [
      {
        id: "pattern-field-note-needed",
        title: "No memory graph yet",
        read: "Mumbl only builds the memory graph from field notes by default. Private dumps stay out unless you opt in.",
        why: dumps.length
          ? `${dumps.length} private dump${dumps.length === 1 ? "" : "s"} saved, but none have been turned into field notes yet.`
          : "No private dumps or field notes yet.",
        nextStep: "Select a few related dumps and draft a field note when something feels worth keeping.",
        fieldNoteSeed: "Pick a recurring thread first.",
        privacy: "field notes only",
        tone: "blue",
        evidenceIds: [],
      },
    ];
  }

  return [
    {
      id: "pattern-forming",
      title: "The shape is still forming",
      read: "There is not enough repeated material yet to say something useful without overreaching.",
      why: includePrivateDumps
        ? `${dumps.length} opted-in private dump${dumps.length === 1 ? "" : "s"} available. A few more will make the pattern read stronger.`
        : `${fieldNotes.length} field note${fieldNotes.length === 1 ? "" : "s"} available. A few more will make the memory read stronger.`,
      nextStep: includePrivateDumps
        ? "Keep dumping in plain language, or turn the useful thread into a field note."
        : "Draft another field note when a thread feels useful.",
      fieldNoteSeed: "Nothing to publish yet.",
      privacy: "Keep this private for now.",
      tone: "blue",
      evidenceIds: includePrivateDumps ? dumps.slice(0, 3).map((dump) => dump.id) : fieldNotes.slice(0, 3).map((fieldNote) => fieldNote.id),
    },
  ];
}

function patternTitle(theme: ThemeNode) {
  if (theme.id.includes("blockers") || theme.id.includes("stuck")) return "Decisions are getting stuck before the work is";
  if (theme.id.includes("momentum") || theme.id.includes("ship")) return "Small visible progress is changing the room";
  if (theme.id.includes("process") || theme.id.includes("team")) return "The handoff is carrying hidden work";
  if (theme.id.includes("load") || theme.id.includes("heavy")) return "Context switching is becoming the work";
  return `${theme.label} keeps coming back`;
}

function patternRead(theme: ThemeNode, source: "local" | "supermemory") {
  const prefix =
    source === "supermemory"
      ? "Connected by meaning, not just matching words: "
      : "Based on repeated language in your notes: ";

  if (theme.id.includes("blockers") || theme.id.includes("stuck")) {
    return `${prefix}the same kind of blocked energy is showing up more than once. The problem may not be effort; it may be an unnamed decision, owner, or missing bit of context.`;
  }
  if (theme.id.includes("momentum") || theme.id.includes("ship")) {
    return `${prefix}the useful moments are clustering around visible progress. This is worth keeping because it says what helps the team move faster without making it a process lecture.`;
  }
  if (theme.id.includes("process") || theme.id.includes("team")) {
    return `${prefix}handoffs, planning, or review comments are carrying more work than expected. This is publishable if it names the system, not a person.`;
  }
  if (theme.id.includes("load") || theme.id.includes("heavy")) {
    return `${prefix}attention load is showing up as a real work constraint. Keep the raw version private; the useful version is probably a smaller ask.`;
  }
  return `${prefix}${theme.label} appears across nearby notes. Treat it as a useful lead, not a verdict.`;
}

function patternWhy(theme: ThemeNode, evidenceCount: number, source: "local" | "supermemory") {
  const basis = source === "supermemory" ? "semantic memory search" : "repeated language";
  const count = evidenceCount || theme.weight || 1;
  return `${count} source${count === 1 ? " points" : "s point"} at the same work pattern via ${basis}.`;
}

function patternNextStep(theme: ThemeNode) {
  if (theme.id.includes("load") || theme.id.includes("heavy")) return "Keep it private for now. Rewrite it as one small ask before sharing.";
  if (theme.id.includes("momentum") || theme.id.includes("ship")) return "Draft the pattern while it is fresh. The team should know what worked.";
  if (theme.id.includes("process") || theme.id.includes("team")) return "Draft it as a field note about the system, not the people in it.";
  if (theme.id.includes("blockers") || theme.id.includes("stuck")) return "Turn it into one concrete question the team can answer.";
  return "Open the connected notes and decide whether there is a team-readable thread.";
}

function patternFieldNoteSeed(theme: ThemeNode) {
  if (theme.id.includes("load") || theme.id.includes("heavy")) return "The hidden cost of context switching this week";
  if (theme.id.includes("momentum") || theme.id.includes("ship")) return "The small thing that helped work move";
  if (theme.id.includes("process") || theme.id.includes("team")) return "Where our handoff is doing too much work";
  if (theme.id.includes("blockers") || theme.id.includes("stuck")) return "The decision that would unblock the thread";
  return `What I am noticing about ${theme.label}`;
}

function patternPrivacy(theme: ThemeNode) {
  if (theme.id.includes("load") || theme.id.includes("heavy")) return "private-first";
  if (theme.id.includes("momentum") || theme.id.includes("ship")) return "safe to draft";
  if (theme.id.includes("process") || theme.id.includes("team")) return "draft carefully";
  return "review before sharing";
}

function makeGraphSummary({
  dumps,
  fieldNotes,
  source,
  topTheme,
  includePrivateDumps,
}: {
  dumps: PrivateDumpRow[];
  fieldNotes: FieldNoteRow[];
  source: "local" | "supermemory";
  topTheme?: ThemeNode;
  includePrivateDumps: boolean;
}) {
  if (!fieldNotes.length && !includePrivateDumps) {
    return {
      headline: "field notes unlock the working map",
      detail: "Private dumps stay out by default. The map starts with field notes because those are the thoughts you intentionally cleaned up.",
      nextStep: dumps.length ? "Select related dumps and draft one field note." : "Write a few dumps first, then draft one field note.",
    };
  }

  if (includePrivateDumps && !dumps.length) {
    return {
      headline: "nothing mapped yet",
      detail: "The map needs a few notes before it can say anything useful.",
      nextStep: "Write a couple of honest dumps first.",
    };
  }

  if (!topTheme) {
    return {
      headline: "no strong repeat yet",
      detail: includePrivateDumps
        ? "Opted-in private dumps are available, but the map is not seeing the same concern twice yet."
        : "Field notes are available, but the map is not seeing the same concern twice yet.",
      nextStep: "Keep writing. Trust the map once a concern repeats.",
    };
  }

  return {
    headline: `${topTheme.label} keeps coming back`,
    detail:
      source === "supermemory"
        ? "This read is using memory search to connect notes that mean similar things."
        : "This read is local and lower-confidence until memory search is available.",
    nextStep: topTheme.weight && topTheme.weight > 1 ? "This is probably worth a field note draft." : "Watch whether this repeats.",
  };
}

function makeGraphInsights({
  dumps,
  fieldNotes,
  source,
  topTheme,
  searchResults,
  includePrivateDumps,
}: {
  dumps: PrivateDumpRow[];
  fieldNotes: FieldNoteRow[];
  source: "local" | "supermemory";
  topTheme?: ThemeNode;
  searchResults: unknown[];
  includePrivateDumps: boolean;
}): GraphInsight[] {
  const sourceRows = includePrivateDumps ? dumps : fieldNotes;
  const newest = sourceRows[0];
  const oldest = sourceRows[sourceRows.length - 1];
  const daySpan =
    newest && oldest
      ? Math.max(1, Math.ceil((new Date(newest.created_at).getTime() - new Date(oldest.created_at).getTime()) / 86400000) + 1)
      : 0;

  return [
    {
      label: "strongest thread",
      value: topTheme?.label || "still forming",
      detail: topTheme ? topTheme.detail || "A recurring work pattern in your notes." : "No theme has repeated enough yet.",
      tone: topTheme?.tone || "blue",
    },
    {
      label: "source material",
      value: includePrivateDumps
        ? `${dumps.length} dump${dumps.length === 1 ? "" : "s"}`
        : `${fieldNotes.length} field note${fieldNotes.length === 1 ? "" : "s"}`,
      detail: daySpan ? `Across roughly ${daySpan} day${daySpan === 1 ? "" : "s"} of notes.` : "Start with one field note.",
      tone: "gold",
    },
    {
      label: "memory source",
      value: source === "supermemory" ? "meaning-aware" : "local",
      detail:
        source === "supermemory"
          ? searchResults.length
            ? `${searchResults.length} nearby memories helped shape this read.`
            : "Memory sync is on; this read is currently shaped by the saved field notes."
          : "Lower confidence: based on local keyword signals for now.",
      tone: source === "supermemory" ? "mint" : "violet",
    },
  ];
}

function firstLine(content: string) {
  return content.split(/\n/).find(Boolean)?.slice(0, 72) || "untitled dump";
}

function dumpContainerTags(sessionTokenHash: string) {
  return ["mumbl_dump", dumpContainerTag(sessionTokenHash), dumpUserId(sessionTokenHash)];
}

function dumpContainerTag(sessionTokenHash: string) {
  return `mumbl_session_${sessionTokenHash.slice(0, 32)}`;
}

function dumpUserId(sessionTokenHash: string) {
  return `mumbl_dump_${sessionTokenHash.slice(0, 32)}`;
}
