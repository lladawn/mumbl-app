// Stands in for src/server/auth.js so the test can choose who is signed in.
export let CURRENT_USER = "";
export function setUser(id) { CURRENT_USER = id; }
export async function resolveRequestOwner() {
  return { userId: CURRENT_USER, sessionToken: "", sessionTokenHash: "", isAuthenticated: Boolean(CURRENT_USER) };
}
export function applyOwnerFilter(q) { return q; }
export function ownerInsertFields() { return {}; }
export function assertExpectedAuthenticatedOwner() {}
export function ownerMatches() { return false; }
