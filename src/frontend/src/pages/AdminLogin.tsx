import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, HardHat, Lock } from "lucide-react";
import React, { useState, useCallback } from "react";
import { ToastContainer } from "../components/ui/ToastContainer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useToast } from "../hooks/useToast";

export function AdminLogin() {
  const { login, loggingIn } = useAdminAuth();
  const { toasts, addToast, removeToast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!password.trim()) {
      addToast("Enter password", "warning");
      return;
    }
    const ok = await login(password);
    if (ok) {
      navigate({ to: "/" });
    } else {
      addToast("Invalid password", "error");
    }
  }, [password, login, navigate, addToast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <HardHat className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Admin Login</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cooling Labs Payroll System
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value="admin" disabled className="bg-gray-50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-pw">Password</Label>
            <div className="relative">
              <Input
                id="admin-pw"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter admin password"
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
            <p className="text-xs text-gray-400">Default password: admin123</p>
          </div>
          <Button onClick={handleLogin} disabled={loggingIn} className="w-full">
            <Lock className="w-4 h-4 mr-2" />
            {loggingIn ? "Logging in..." : "Login"}
          </Button>
        </div>
      </div>
    </div>
  );
}
