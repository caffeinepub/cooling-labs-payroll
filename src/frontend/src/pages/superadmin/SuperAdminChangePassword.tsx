import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changeSuperAdminPassword,
  clearSuperAdminSession,
  getSuperAdminSession,
  loginSuperAdmin,
} from "@/services/tenantStorage";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function SuperAdminChangePassword() {
  const navigate = useNavigate();
  const session = getSuperAdminSession();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Redirect if not logged in
  if (!session) {
    navigate({ to: "/superadmin/login" });
    return null;
  }

  function handleLogout() {
    clearSuperAdminSession();
    navigate({ to: "/superadmin/login" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from the current password.");
      return;
    }

    // Verify current password
    const valid = loginSuperAdmin(
      session?.username ?? "humanskeyai",
      currentPassword,
    );
    if (!valid) {
      setError("Current password is incorrect.");
      return;
    }

    changeSuperAdminPassword(newPassword);
    setSuccess(true);
    toast.success(
      "Password changed successfully. Use the new password on your next login.",
    );

    // Reset fields
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(180deg, #0B1220 0%, #0F1B2D 100%)",
      }}
    >
      {/* Top nav */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">HKAI</span>
            </div>
            <div>
              <span className="text-white font-bold text-sm">HumanskeyAI</span>
              <span className="text-slate-400 text-xs ml-2">
                Platform Admin
              </span>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/superadmin/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
              >
                <Activity className="w-4 h-4 mr-1" /> Dashboard
              </Button>
            </Link>
            <Link to="/superadmin/companies">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
              >
                <Building2 className="w-4 h-4 mr-1" /> Companies
              </Button>
            </Link>
            <Link to="/superadmin/change-password">
              <Button variant="ghost" size="sm" className="text-blue-400">
                <KeyRound className="w-4 h-4 mr-1" /> Change Password
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-red-400"
            >
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Change Password</h1>
          <p className="text-slate-400 text-sm mt-1">
            Update your Super Admin account password
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          {success ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <CheckCircle2 className="w-14 h-14 text-emerald-500" />
              <p className="text-white font-semibold text-lg">
                Password Updated Successfully
              </p>
              <p className="text-slate-400 text-sm text-center">
                Your new password is active immediately. Use it on your next
                login.
              </p>
              <div className="flex gap-3 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                  onClick={() => setSuccess(false)}
                >
                  Change Again
                </Button>
                <Link to="/superadmin/dashboard">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Current Password */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">
                  Current Password
                </Label>
                <div className="relative">
                  <Input
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showCurrent ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">New Password</Label>
                <div className="relative">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showNew ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {newPassword && newPassword.length < 8 && (
                  <p className="text-red-400 text-xs">
                    At least 8 characters required
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-sm">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="bg-slate-700 border-slate-600 text-white placeholder-slate-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showConfirm ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-red-400 text-xs">Passwords do not match</p>
                )}
                {confirmPassword &&
                  newPassword === confirmPassword &&
                  newPassword.length >= 8 && (
                    <p className="text-emerald-400 text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Passwords match
                    </p>
                  )}
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <KeyRound className="w-4 h-4 mr-2" /> Update Password
              </Button>
            </form>
          )}
        </div>

        <p className="text-slate-500 text-xs text-center mt-4">
          After changing your password, use the new password on your next login.
        </p>
      </main>
    </div>
  );
}
