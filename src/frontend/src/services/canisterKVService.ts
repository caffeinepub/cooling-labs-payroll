/**
 * canisterKVService.ts
 * Generic per-company key-value store backed by the ICP canister.
 * Used to persist all localStorage-only modules across browsers/devices.
 */
import { backendService } from "./backendService";
import { getActiveCompanyId } from "./tenantStorage";

export async function setTenantKV(key: string, value: string): Promise<void> {
  const companyCode = getActiveCompanyId();
  if (!companyCode) return;
  try {
    await backendService.setTenantKV(companyCode, key, value);
  } catch (e) {
    console.warn("[canisterKVService] setTenantKV failed:", e);
  }
}

/**
 * Load all KV pairs for the active company from canister.
 * Handles both JS tuple arrays [k,v] and Candid record objects {'0': k, '1': v}.
 */
export async function getAllTenantKV(): Promise<Map<string, string>> {
  const companyCode = getActiveCompanyId();
  if (!companyCode) return new Map();
  try {
    const pairs = await backendService.getAllTenantKV(companyCode);
    const map = new Map<string, string>();
    for (const pair of pairs as unknown[]) {
      let k: string;
      let v: string;
      if (Array.isArray(pair)) {
        k = pair[0] as string;
        v = pair[1] as string;
      } else if (pair && typeof pair === "object") {
        const rec = pair as Record<string, string>;
        k = rec["0"];
        v = rec["1"];
      } else {
        continue;
      }
      if (k && v !== undefined) map.set(k, v);
    }
    return map;
  } catch (e) {
    console.warn("[canisterKVService] getAllTenantKV failed:", e);
    return new Map();
  }
}
