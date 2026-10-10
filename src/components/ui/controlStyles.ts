/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Pedaços de classe compartilhados por Input, Textarea e Select, para que o
 * anel de foco e o fundo do campo não divirjam entre os três.
 */

export type ControlTone = "accent" | "brand";
export type ControlSurface = "muted" | "plain";

/** `accent` segue a cor do estabelecimento; `brand` é o índigo da marca do app. */
export const FOCUS_RING: Record<ControlTone, string> = {
  accent:
    "focus:ring-2 focus:ring-[var(--tenant-accent)]/20 focus:border-[var(--tenant-accent)]",
  brand: "focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600",
};

export const SURFACE: Record<ControlSurface, string> = {
  muted: "bg-gray-50",
  plain: "bg-white",
};
