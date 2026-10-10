/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FOCUS_RING, SURFACE, type ControlSurface, type ControlTone } from "./controlStyles.js";

export type TextareaSize = "sm" | "md" | "lg";

const SIZES: Record<TextareaSize, string> = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-2.5 text-xs",
  lg: "px-4 py-2.5 text-sm",
};

interface TextareaProps {
  tone?: ControlTone;
  size?: TextareaSize;
  surface?: ControlSurface;
  className?: string;
  [key: string]: any;
}

export default function Textarea({
  tone = "accent",
  size = "sm",
  surface = "muted",
  className = "",
  ...rest
}: TextareaProps) {
  return (
    <textarea
      {...rest}
      className={`w-full border border-gray-200 rounded-xl focus:outline-none transition-all font-semibold resize-none ${SIZES[size]} ${SURFACE[surface]} ${FOCUS_RING[tone]} ${className}`}
    />
  );
}
