/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FOCUS_RING, SURFACE, type ControlSurface, type ControlTone } from "./controlStyles.js";

interface SelectProps {
  tone?: ControlTone;
  surface?: ControlSurface;
  className?: string;
  children?: any;
  [key: string]: any;
}

export default function Select({
  tone = "accent",
  surface = "muted",
  className = "",
  children,
  ...rest
}: SelectProps) {
  return (
    <select
      {...rest}
      className={`w-full border border-gray-200 rounded-xl focus:outline-none transition-all font-semibold cursor-pointer px-3 py-2 text-xs ${SURFACE[surface]} ${FOCUS_RING[tone]} ${className}`}
    >
      {children}
    </select>
  );
}
