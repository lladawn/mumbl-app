/**
 * The seam between "the availability schedule you configured" and "what your
 * real calendar says you are already doing".
 *
 * Calendly is those two layers: rules minus connected-calendar busy blocks.
 * Stage 1 ships the rules only, so this returns nothing and slot generation is
 * already written to subtract it. Stage 2 adds a Google implementation behind
 * this exact signature — nothing else in the codebase should learn that Google
 * exists.
 */

export type BusyBlock = { startMs: number; endMs: number };

export type CalendarHost = {
  id: string;
  timezone: string;
};

export async function getBusyBlocks(
  _host: CalendarHost,
  _fromMs: number,
  _toMs: number,
): Promise<BusyBlock[]> {
  return [];
}

/** Whether a host has a calendar connected, for copy like "checked against my calendar". */
export function hasConnectedCalendar(_host: CalendarHost): boolean {
  return false;
}
