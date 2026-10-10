/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from "react";

/**
 * Superfície com moldura.
 *
 * Cada eixo é independente de propósito: os cartões do app variam raio, borda,
 * fundo, sombra e respiro de forma solta, e espremer isso em poucos presets
 * obrigaria a inventar nomes que não descrevem nada. Os valores de cada eixo
 * são exatamente os que o app já usava — esta fase extrai, não redesenha.
 */

export type CardRadius = "xl" | "2xl" | "3xl";
export type CardTone = "white" | "muted" | "mutedSoft" | "none";
export type CardBorder = "light" | "default" | "none";
export type CardElevation = "none" | "sm" | "xl" | "2xl";
export type CardPadding = "none" | "sm" | "md" | "lg" | "xl";

const RADII: Record<CardRadius, string> = {
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
};

const TONES: Record<CardTone, string> = {
  white: "bg-white",
  muted: "bg-gray-50",
  mutedSoft: "bg-gray-50/50",
  none: "",
};

const BORDERS: Record<CardBorder, string> = {
  light: "border border-gray-100",
  default: "border border-gray-200",
  none: "",
};

const ELEVATIONS: Record<CardElevation, string> = {
  none: "",
  sm: "shadow-sm",
  xl: "shadow-xl",
  "2xl": "shadow-2xl",
};

const PADDINGS: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
  xl: "p-8",
};

export interface CardStyle {
  radius?: CardRadius;
  tone?: CardTone;
  border?: CardBorder;
  elevation?: CardElevation;
  padding?: CardPadding;
}

/**
 * Monta a lista de classes de uma superfície. Existe separado do componente
 * para que quem precisa de outro elemento (um `motion.div`, por exemplo) possa
 * usar a mesma superfície sem aninhar uma `div` extra.
 */
export function cardClasses({
  radius = "2xl",
  tone = "white",
  border = "default",
  elevation = "sm",
  padding = "md",
}: CardStyle = {}): string {
  return `${RADII[radius]} ${TONES[tone]} ${BORDERS[border]} ${ELEVATIONS[elevation]} ${PADDINGS[padding]}`;
}

interface CardProps extends CardStyle {
  className?: string;
  children: ReactNode;
  [key: string]: any;
}

export default function Card({
  className = "",
  children,
  radius,
  tone,
  border,
  elevation,
  padding,
  ...rest
}: CardProps) {
  // `rest` vai para a `div`: os cartões do app carregam `id`, `onClick` e afins,
  // e perder isso em silêncio quebra quem procura o nó no DOM.
  return (
    <div {...rest} className={`${cardClasses({ radius, tone, border, elevation, padding })} ${className}`}>
      {children}
    </div>
  );
}
