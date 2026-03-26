import { useNavigate } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, Lock, Shield } from "lucide-react";
import React, { useState, useCallback } from "react";
import { ToastContainer } from "../components/ui/ToastContainer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useToast } from "../hooks/useToast";
import { loginSuperAdmin } from "../services/tenantStorage";

export function SuperAdminLogin() {
  const { toasts, addToast, removeToast } = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      addToast("Enter username and password", "warning");
      return;
    }
    setLoading(true);
    try {
      const ok = loginSuperAdmin(username.trim(), password);
      if (ok) {
        navigate({ to: "/superadmin/dashboard" });
      } else {
        addToast("Invalid credentials", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [username, password, navigate, addToast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-white font-bold text-sm tracking-wider">
              HKAI
            </span>
          </div>
          <h1 className="text-lg font-bold text-white">Platform Admin</h1>
          <p className="text-sm text-slate-400 mt-1">
            HumanskeyAI Super Admin Portal
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300">Username</Label>
            <Input
              data-ocid="superadmin.login.input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="humanskeyai"
              className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300">Password</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter platform password"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowPw((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPw ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <Button
            data-ocid="superadmin.login.submit_button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <Shield className="w-4 h-4 mr-2" />
            {loading ? "Logging in..." : "Login as Platform Admin"}
          </Button>
        </div>
        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            className="text-xs text-slate-500 hover:text-blue-400 transition-colors"
          >
            ← Back to Company Login
          </Link>
        </div>
      </div>
    </div>
  );
}
