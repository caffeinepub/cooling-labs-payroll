import { pushModuleToCanister } from "./syncAllModulesFromCanister";
import { getActiveCompanyId, getTenantKey } from "./tenantStorage";

function getKey(): string {
  return getTenantKey(getActiveCompanyId(), "clf_company_settings");
}

export interface CompanySettings {
  companyName: string;
  logoDataUrl: string;
  address: string;
  // Extended fields (for backward compat with AdminSettings)
  pfApplicable?: boolean;
  pfEmployeeRate?: number;
  esiApplicable?: boolean;
  esiEmployeeRate?: number;
  ptApplicable?: boolean;
  ptAmount?: number;
  hraPercent?: number;
  workingDaysPerMonth?: number;
  otRateMultiplier?: number;
  attendanceImportSettings?: {
    supervisorCanUpload?: boolean;
    importMode?: string;
    siteMismatchIsWarning?: boolean;
  };
}

const DEFAULT: CompanySettings = {
  companyName: "COOLING LABS ENGINEERS LLP.",
  logoDataUrl: "",
  address: "",
  pfApplicable: true,
  pfEmployeeRate: 12,
  esiApplicable: true,
  esiEmployeeRate: 0.75,
  ptApplicable: true,
  ptAmount: 200,
  hraPercent: 40,
  workingDaysPerMonth: 26,
  otRateMultiplier: 2,
  attendanceImportSettings: {
    supervisorCanUpload: false,
    importMode: "smart_merge",
    siteMismatchIsWarning: true,
  },
};

export function getCompanySettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(getKey());
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveCompanySettings(s: Partial<CompanySettings>): void {
  const current = getCompanySettings();
  localStorage.setItem(getKey(), JSON.stringify({ ...current, ...s }));
  pushModuleToCanister("clf_company_settings");
}
