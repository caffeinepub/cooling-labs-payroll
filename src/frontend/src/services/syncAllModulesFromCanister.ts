/**
 * syncAllModulesFromCanister.ts
 * On login, pulls all company-specific KV data from the canister and
 * seeds localStorage so every module reads the shared backend state.
 * On write, modules call setTenantKV() to push their latest JSON blob.
 */
import { getAllTenantKV, setTenantKV } from "./canisterKVService";
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";

// Keys that must be synced from canister → localStorage on every login
const SYNC_KEYS = [
  "clf_trades",
  "clf_departments",
  "clf_sites",
  "clf_company_settings",
  "clf_approval_requests",
  "clf_reg_requests",
  "clf_audit_logs",
  "clf_supervisors",
  "clf_supervisor_permissions_global",
  "clf_supervisor_permissions",
  "clf_workforce_counter",
  "clf_master_counter",
];

/**
 * Pull all module data from canister and seed localStorage.
 * If canister has data for a key → overwrite localStorage with it.
 * If canister is empty for a key but localStorage has data → push localStorage → canister.
 */
export async function syncAllModulesFromCanister(): Promise<void> {
  const cid = getActiveCompanyId();
  if (!cid) return;

  const canisterData = await getAllTenantKV();

  for (const baseKey of SYNC_KEYS) {
    const lsKey = getTenantKey(cid, baseKey);
    const canisterValue = canisterData.get(baseKey);

    if (canisterValue !== undefined) {
      // Canister has data — seed localStorage (overwrite stale local state)
      localStorage.setItem(lsKey, canisterValue);
    } else {
      // Canister empty for this key — migrate from localStorage if it has data
      const localValue = localStorage.getItem(lsKey);
      if (localValue) {
        void setTenantKV(baseKey, localValue);
      }
    }
  }

  console.log(
    `[syncModules] Synced ${canisterData.size} KV entries from canister for company ${cid}`,
  );
}

/**
 * Push a single module’s current localStorage value to canister.
 * Call this immediately after every write in storage modules.
 */
export function pushModuleToCanister(baseKey: string): void {
  const cid = getActiveCompanyId();
  if (!cid) return;
  const lsKey = getTenantKey(cid, baseKey);
  const value = localStorage.getItem(lsKey);
  if (value !== null) {
    void setTenantKV(baseKey, value);
  }
}
