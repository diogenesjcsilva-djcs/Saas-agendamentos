/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ComponentType, ReactNode } from "react";

export type AlertVariant = "error" | "info" | "hint";
export type AlertSize = "sm" | "md";

const VARIANTS: Record<AlertVariant, Record<AlertSize, string>> = {
  error: {
    sm: "p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold",
    md: "p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-3",
  },
  info: {
    sm: "p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-3xs font-semibold text-gray-600 flex items-center justify-center gap-2",
    md: "p-4 bg-gray-50 border border-gray-200 rounded-xl text-3xs font-semibold text-gray-600 flex items-center justify-center gap-2",
  },
  hint: {
    sm: "bg-slate-50 p-4 rounded-2xl border border-slate-100 text-3xs leading-relaxed text-slate-500 font-medium",
    md: "bg-slate-50 p-4 rounded-2xl border border-slate-100 text-3xs leading-relaxed text-slate-500 font-medium",
  },
};

const ICON_TONES: Record<AlertVariant, string> = {
  error: "w-5 h-5 text-red-600 shrink-0 mt-0.5",
  info: "w-4 h-4 shrink-0",
  hint: "w-4 h-4 shrink-0",
};

interface AlertProps {
  variant?: AlertVariant;
  size?: AlertSize;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  children: ReactNode;
}

export default function Alert({
  variant = "error",
  size = "sm",
  icon: Icon,
  className = "",
  children,
}: AlertProps) {
  const body =
    variant === "error" && size === "md" ? (
      <div className="text-sm font-medium">{children}</div>
    ) : (
      children
    );

  return (
    <div className={`${VARIANTS[variant][size]} ${className}`}>
      {Icon ? <Icon className={ICON_TONES[variant]} /> : null}
      {body}
    </div>
  );
}
