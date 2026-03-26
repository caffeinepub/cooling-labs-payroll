import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import React from "react";
import type { Toast } from "../../hooks/useToast";

const icons = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <XCircle className="w-5 h-5 text-red-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
};

const bg = {
  success: "border-green-200 bg-green-50",
  error: "border-red-200 bg-red-50",
  warning: "border-yellow-200 bg-yellow-50",
  info: "border-blue-200 bg-blue-50",
};

export function ToastContainer({
  toasts,
  onRemove,
}: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${bg[t.type]}`}
        >
          {icons[t.type]}
          <p className="flex-1 text-sm text-gray-800">{t.message}</p>
          <button
            type="button"
            onClick={() => onRemove(t.id)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
