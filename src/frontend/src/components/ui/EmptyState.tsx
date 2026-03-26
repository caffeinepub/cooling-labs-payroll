import type React from "react";
import { Button } from "./button";

interface Props {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-gray-300 mb-4">{icon}</div>}
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      {subtitle && (
        <p className="text-sm text-gray-500 mb-4 max-w-xs">{subtitle}</p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      )}
    </div>
  );
}
