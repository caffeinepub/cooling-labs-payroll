import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  Eye,
  EyeOff,
  HardHat,
  Lock,
  User,
} from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAdminAuth } from "../context/AdminAuthContext";
import { getCompanyByCode } from "../services/tenantStorage";
import type { Company } from "../services/tenantStorage";

export function AdminLogin() {
  const { login, loggingIn } = useAdminAuth();
  const navigate = useNavigate();
  const [companyCode, setCompanyCode] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [companyPreview, setCompanyPreview] = useState<Company | null>(null);
  const [previewLooked, setPreviewLooked] = useState(false);
  const [sessionSource, setSessionSource] = useState<
    "canister" | "local" | null
  >(null);

  const lookupCompany = useCallback((code: string) => {
    if (code.length >= 3) {
      const found = getCompanyByCode(code);
      setCompanyPreview(found);
      setPreviewLooked(true);
    } else {
      setCompanyPreview(null);
      setPreviewLooked(false);
    }
  }, []);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setCompanyCode(val);
    lookupCompany(val);
  };

  const handleLogin = useCallback(async () => {
    setError("");
    setSessionSource(null);
    if (!companyCode.trim()) {
      setError("Enter company code");
      return;
    }
    if (!username.trim()) {
      setError("Enter username");
      return;
    }
    if (!password.trim()) {
      setError("Enter password");
      return;
    }

    const ok = await login(
      companyCode.trim().toUpperCase(),
      username.trim(),
      password,
    );
    if (ok) {
      navigate({ to: "/" });
    } else {
      const company = getCompanyByCode(companyCode.trim().toUpperCase());
      if (company && company.status !== "active") {
        setError(`Company is ${company.status}. Contact HumanskeyAI support.`);
      } else {
        setError("Invalid company code, username, or password");
      }
    }
  }, [companyCode, username, password, login, navigate]);

  const displayName =
    companyPreview?.brandName || companyPreview?.companyName || "";
  const initials = displayName.slice(0, 2).toUpperCase();
  const isBlocked =
    companyPreview &&
    (companyPreview.status === "suspended" ||
      companyPreview.status === "inactive");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <HardHat className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Company Login</h1>
          <p className="text-sm text-gray-500 mt-1">
            HumanskeyAI Workforce Platform
          </p>
        </div>

        {sessionSource === "canister" && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Session verified on ICP canister
          </div>
        )}

        {/* Company preview card */}
        {previewLooked && companyPreview && (
          <div
            className={`mb-4 rounded-xl border p-3 flex items-center gap-3 ${
              isBlocked
                ? "border-red-200 bg-red-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            {companyPreview.logoDataUrl ? (
              <img
                src={companyPreview.logoDataUrl}
                alt="logo"
                className="w-10 h-10 rounded-lg object-contain border border-gray-200 bg-white"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {displayName}
              </p>
              {isBlocked ? (
                <p className="text-xs text-red-600 flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="w-3 h-3" />
                  {companyPreview.status === "suspended"
                    ? "Account suspended. Contact platform admin."
                    : "Account inactive. Contact platform admin."}
                </p>
              ) : (
                <p className="text-xs text-emerald-600 mt-0.5">
                  Active account
                </p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company-code">
              <Building2 className="w-3.5 h-3.5 inline mr-1" />
              Company Code
            </Label>
            <Input
              id="company-code"
              data-ocid="admin.login.input"
              value={companyCode}
              onChange={handleCodeChange}
              onBlur={() => lookupCompany(companyCode)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="e.g. COOLABS"
              className="uppercase"
            />
            <p className="text-xs text-gray-400">Default: COOLABS</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-username">
              <User className="w-3.5 h-3.5 inline mr-1" />
              Username
            </Label>
            <Input
              id="admin-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="admin"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-pw">
              <Lock className="w-3.5 h-3.5 inline mr-1" />
              Password
            </Label>
            <div className="relative">
              <Input
                id="admin-pw"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPw ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400">Default: admin123</p>
          </div>

          {error && (
            <div
              data-ocid="admin.login.error_state"
              className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200"
            >
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <Button
            data-ocid="admin.login.submit_button"
            onClick={handleLogin}
            disabled={loggingIn || !!isBlocked}
            className="w-full"
          >
            <Lock className="w-4 h-4 mr-2" />
            {loggingIn ? "Verifying..." : "Login"}
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Session authenticated via ICP canister
          </p>
        </div>

        <div className="mt-3 text-center">
          <Link
            to="/superadmin/login"
            className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
          >
            Platform Admin (HumanskeyAI)? Login here →
          </Link>
        </div>
      </div>
    </div>
  );
}
