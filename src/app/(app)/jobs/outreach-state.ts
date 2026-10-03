import "server-only";
import { requestState, type OutreachRequest, type RequestState } from "@/lib/outreach";

/** Where each latest "Find people" / "Use this person" request stands, read at the time of the request (as finder-state.ts does). */
export function requestStatesNow<T>(items: T[], latest: (item: T) => OutreachRequest | null): RequestState[] {
  const now = Date.now();
  return items.map((item) => requestState(latest(item), now));
}
