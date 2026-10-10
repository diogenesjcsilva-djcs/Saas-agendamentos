/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from "react";
import Spinner, { type SpinnerSize, type SpinnerTone } from "./Spinner.js";

/**
 * Botão de ação.
 *
 * `primary`, `soft` e `accent` leem a cor do estabelecimento pelas custom
 * properties `--tenant-accent*`, então mudam de cor sozinhos dentro do portal
 * do cliente. `brand` é o índigo da marca do app e não segue o tenant.
 */
export type ButtonVariant =
  | "primary"
  | "brand"
  | "neutral"
  | "secondary"
  | "outline"
  | "ghost"
  | "soft"
  | "accent"
  | "danger"
  | "muted"
  | "link"
  | "brandLink"
  | "none";

export type ButtonSize = "none" | "xs" | "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--tenant-accent)] hover:bg-[var(--tenant-accent-strong)] text-white shadow-md",
  brand: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/10",
  neutral: "bg-slate-900 hover:bg-slate-800 text-white shadow-md",
  muted: "bg-gray-100 hover:bg-gray-200 text-slate-800",
  secondary: "bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 shadow-sm",
  outline: "border border-gray-200 hover:bg-gray-50 text-gray-700",
  ghost: "text-gray-600 hover:bg-gray-100",
  soft: "bg-[var(--tenant-accent-soft)] text-[var(--tenant-accent-strong)] hover:bg-[var(--tenant-accent)] hover:text-white shadow-sm border border-transparent",
  accent:
    "border border-[var(--tenant-accent)] text-[var(--tenant-accent)] hover:bg-[var(--tenant-accent-soft)]",
  danger: "border border-red-200 text-red-600 hover:bg-red-50",
  link: "text-[var(--tenant-accent)] hover:underline",
  brandLink: "text-indigo-600 hover:underline",
  none: "",
};

const SIZES: Record<ButtonSize, string> = {
  none: "",
  xs: "px-3 py-1.5 text-2xs rounded-lg gap-1.5",
  sm: "px-4 py-2 text-xs rounded-xl gap-2",
  md: "px-4 py-2.5 text-xs rounded-xl gap-2",
  lg: "px-6 py-3 text-xs rounded-xl gap-2",
};

// O projeto não tem @types/react instalado, então os atributos do React não
// existem para o tsc. As props usadas ficam nomeadas e o resto passa por um
// índice aberto, para não travar `aria-*`, `title`, `form`, etc.
interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Mostra o spinner e desabilita o botão. O rótulo some, salvo `loadingLabel`. */
  loading?: boolean;
  loadingLabel?: ReactNode;
  loadingSize?: SpinnerSize;
  /**
   * Traço do spinner. O padrão (`onSolid`) é o anel com trilho translúcido, que
   * funciona sobre cor cheia; alguns botões usam o arco fino (`white`).
   */
  loadingTone?: SpinnerTone;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  [key: string]: any;
}

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  loadingLabel,
  loadingSize = "sm",
  loadingTone = "onSolid",
  leftIcon,
  rightIcon,
  className = "",
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${SIZES[size]} ${VARIANTS[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading ? (
        <>
          <Spinner size={loadingSize} tone={loadingTone} />
          {loadingLabel}
        </>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}
