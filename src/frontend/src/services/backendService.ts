import { createActorWithConfig } from "../config";

// biome-ignore lint/suspicious/noExplicitAny: dynamic dispatch
type Actor = Record<string, (...args: any[]) => Promise<any>>;

let actorInstance: Actor | null = null;
let actorPromise: Promise<Actor> | null = null;

export async function getActor(): Promise<Actor> {
  if (actorInstance) return actorInstance;
  if (actorPromise) return actorPromise;
  actorPromise = createActorWithConfig().then((wrapper) => {
    // The Backend class wraps the raw ICP actor at `wrapper.actor`.
    // The raw actor has all the IDL-defined methods.
    // biome-ignore lint/suspicious/noExplicitAny: dynamic dispatch
    const raw = (wrapper as any).actor;
    actorInstance = (raw ?? wrapper) as unknown as Actor;
    return actorInstance;
  });
  return actorPromise;
}

export function resetActor() {
  actorInstance = null;
  actorPromise = null;
}

function isStoppedError(raw: string): boolean {
  return (
    raw.includes("IC0508") ||
    raw.includes("non_replicated_rejection") ||
    // ICP rejection codes for stopped/frozen canister
    raw.includes("CanisterStopped") ||
    raw.includes("CanisterFrozen") ||
    // The plain rejection message from the replica
    raw.includes("is stopped")
  );
}

/**
 * Parse a raw IC / backend error into a human-readable message.
 */
export function parseBackendError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);

  if (isStoppedError(raw)) {
    return "Service temporarily unavailable, please retry";
  }

  // Missing method
  if (raw.includes("is not available")) {
    return "Backend method not found. Please reload.";
  }

  // Strip verbose IC call-fail prefixes
  const stripped = raw
    .replace(/^Call failed[:\s\S]*?\n\s*/i, "")
    .replace(/^IC\d+:\s*/i, "")
    .replace(/^Error:\s*/i, "")
    .trim();

  return stripped || raw;
}

const RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Lazy proxy — dispatches all calls through the real actor.
// On IC0508 / canister-stopped errors, resets the actor cache and retries once
// after a short delay so transient stops don't surface as hard errors.
// biome-ignore lint/suspicious/noExplicitAny: dynamic proxy
export const backendService = new Proxy(
  {} as Record<string, (...args: any[]) => Promise<any>>,
  {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic proxy
    get(_target, prop: string | symbol): (...args: any[]) => Promise<any> {
      // biome-ignore lint/suspicious/noExplicitAny: dynamic proxy
      return async (...args: any[]) => {
        const callOnce = async (): Promise<unknown> => {
          const actor = await getActor();
          const fn = actor[prop as string];
          if (typeof fn !== "function") {
            throw new Error(
              `Backend method '${String(prop)}' is not available. Check that the backend IDL is up to date.`,
            );
          }
          return fn.call(actor, ...args);
        };

        try {
          return await callOnce();
        } catch (e) {
          const raw = e instanceof Error ? e.message : String(e);
          // If canister is stopped, reset actor cache and retry once
          if (isStoppedError(raw)) {
            resetActor();
            await sleep(RETRY_DELAY_MS);
            try {
              return await callOnce();
            } catch (e2) {
              throw new Error(parseBackendError(e2));
            }
          }
          throw new Error(parseBackendError(e));
        }
      };
    },
  },
);
