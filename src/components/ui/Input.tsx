/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ComponentType } from "react";
import { FOCUS_RING, SURFACE, type ControlSurface, type ControlTone } from "./controlStyles.js";

export type InputSize = "xs" | "sm" | "md" | "lg";

const SIZES: Record<InputSize, { field: string; iconField: string; iconLeft: string }> = {
  // `xs` é o campo de célula: grade de horários, onde a altura tem de bater com
  // a das caixas de seleção ao lado.
  xs: { field: "py-1 text-xs", iconField: "pl-9 pr-4", iconLeft: "left-3" },
  sm: { field: "py-2 text-xs", iconField: "pl-9 pr-4", iconLeft: "left-3" },
  md: { field: "py-2.5 text-xs", iconField: "pl-10 pr-4", iconLeft: "left-3.5" },
  lg: { field: "py-2.5 text-sm", iconField: "pl-10 pr-4", iconLeft: "left-3" },
};

interface InputProps {
  /** Ícone lucide desenhado dentro do campo, à esquerda. */
  icon?: ComponentType<{ className?: string }>;
  tone?: ControlTone;
  size?: InputSize;
  surface?: ControlSurface;
  /** `bare` é o campo sem moldura, para entrar em grupos compostos. */
  bare?: boolean;
  className?: string;
  [key: string]: any;
}

export default function Input({
  icon: Icon,
  tone = "accent",
  size = "md",
  surface = "muted",
  bare = false,
  className = "",
  ...rest
}: InputProps) {
  const s = SIZES[size];

  const field = bare
    ? `w-full bg-transparent focus:outline-none font-semibold ${s.field} px-3 ${className}`
    : `w-full border border-gray-200 rounded-xl focus:outline-none transition-all font-semibold ${s.field} ${
        Icon ? s.iconField : "px-4"
      } ${SURFACE[surface]} ${FOCUS_RING[tone]} ${className}`;

  if (!Icon) {
    return <input {...rest} className={field} />;
  }

  return (
    <div className="relative">
      <Icon
        className={`w-4 h-4 text-gray-400 absolute ${s.iconLeft} top-1/2 -translate-y-1/2`}
      />
      <input {...rest} className={field} />
    </div>
  );
}
