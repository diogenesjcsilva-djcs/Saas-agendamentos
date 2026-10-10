/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Indicador de carregamento.
 *
 * Duas famílias de traço convivem no app, e as duas estão aqui de propósito —
 * esta fase só extrai o que existe, não redesenha:
 *  - `onSolid` e `accentRing` desenham um anel completo com trilho translúcido,
 *    que é o que funciona sobre cor cheia.
 *  - `accent`, `brand` e `white` desenham um arco único girando, usado sobre
 *    fundo claro.
 */

export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";
export type SpinnerTone = "onSolid" | "accentRing" | "accent" | "brand" | "white";

const SIZES: Record<SpinnerSize, string> = {
  xs: "w-3.5 h-3.5",
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

const TONES: Record<SpinnerTone, string> = {
  onSolid: "border-2 border-white/20 border-t-white",
  accentRing: "border-2 border-[var(--tenant-accent)]/30 border-t-[var(--tenant-accent)]",
  accent: "border-b-2 border-[var(--tenant-accent)]",
  brand: "border-b-2 border-indigo-600",
  white: "border-b-2 border-white",
};

export default function Spinner({
  size = "sm",
  tone = "onSolid",
  className = "",
}: {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  className?: string;
}) {
  return (
    <span
      className={`block animate-spin rounded-full ${SIZES[size]} ${TONES[tone]} ${className}`}
    />
  );
}
