const KEY = "clf_company_settings";

export interface CompanySettings {
  companyName: string;
  logoDataUrl: string; // base64 data URL
  address: string;
}

const DEFAULT: CompanySettings = {
  companyName: "COOLING LABS ENGINEERS LLP.",
  logoDataUrl: "",
  address: "",
};

export function getCompanySettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveCompanySettings(s: Partial<CompanySettings>): void {
  const current = getCompanySettings();
  localStorage.setItem(KEY, JSON.stringify({ ...current, ...s }));
}
