import React from "react";

type Variant =
  | "active"
  | "inactive"
  | "present"
  | "absent"
  | "halfday"
  | "leave"
  | "regularized"
  | "admin"
  | "supervisor";

const styles: Record<Variant, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-600",
  halfday: "bg-yellow-100 text-yellow-700",
  leave: "bg-purple-100 text-purple-700",
  regularized: "bg-blue-100 text-blue-700",
  admin: "bg-indigo-100 text-indigo-700",
  supervisor: "bg-orange-100 text-orange-700",
};

const labels: Record<Variant, string> = {
  active: "Active",
  inactive: "Inactive",
  present: "Present",
  absent: "Absent",
  halfday: "Half Day",
  leave: "Leave",
  regularized: "Regularized",
  admin: "Admin",
  supervisor: "Supervisor",
};

export function StatusBadge({ variant }: { variant: Variant }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[variant]}`}
    >
      {labels[variant]}
    </span>
  );
}

export function AttendanceBadge({ status }: { status: string }) {
  const v =
    status === "Present"
      ? "present"
      : status === "Absent"
        ? "absent"
        : status === "HalfDay"
          ? "halfday"
          : "leave";
  return <StatusBadge variant={v as Variant} />;
}
