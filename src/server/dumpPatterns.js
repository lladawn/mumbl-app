import { checkInsightMilestone } from "./insights";
import { getServerEnv } from "./env";
import { processDump } from "./signals";
import { cleanString } from "./validation";

export async function processSavedPrivateDump({ supabase, dumpId, userId, content, source = "web" }) {
  const cleanedDumpId = cleanString(dumpId, 64);
  const cleanedUserId = cleanString(userId, 64);
  if (!cleanedDumpId || !cleanedUserId) return;
  if (!getServerEnv().patternGraphEnabled) return;

  try {
    await processDump(supabase, cleanedDumpId, cleanedUserId, content);
    await checkInsightMilestone(supabase, cleanedUserId);
  } catch (error) {
    console.error("async dump pattern processing error:", {
      source,
      dumpId: cleanedDumpId,
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
  }
}

export async function cleanupPatternGraphAfterDumpDelete({ supabase, userId, dumpIds, source = "web" }) {
  const cleanedUserId = cleanString(userId, 64);
  const cleanedDumpIds = Array.isArray(dumpIds) ? dumpIds.map((id) => cleanString(id, 64)).filter(Boolean) : [];
  if (!cleanedUserId || !cleanedDumpIds.length) return null;
  if (!getServerEnv().patternGraphEnabled) return null;

  try {
    const { data, error } = await supabase.rpc("cleanup_pattern_graph_after_dump_delete", {
      p_user_id: cleanedUserId,
      p_dump_ids: cleanedDumpIds,
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  } catch (error) {
    console.error("pattern graph cleanup after dump delete failed silently:", {
      source,
      userId: cleanedUserId,
      dumpCount: cleanedDumpIds.length,
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    return null;
  }
}
