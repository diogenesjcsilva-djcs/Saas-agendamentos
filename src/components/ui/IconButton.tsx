/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from "react";

export type IconButtonVariant = "ghost" | "outline" | "bare";
export type IconButtonSize = "none" | "sm" | "md" | "lg";

const VARIANTS: Record<IconButtonVariant, string> = {
  ghost: "hover:bg-gray-100 text-gray-600 rounded-lg",
  outline: "border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-lg",
  bare: "text-gray-500 hover:text-gray-600",
};

/**
 * `md` e `lg` são controles de navegação (mês anterior, voltar, menu), então
 * carregam o alvo de toque de 44px. `sm` é ação de linha em lista densa, onde
 * 44px em cada linha inflaria a tabela — lá o alvo continua o do padding.
 */
const SIZES: Record<IconButtonSize, string> = {
  none: "",
  sm: "p-1",
  md: "p-1.5 min-h-11 min-w-11 inline-flex items-center justify-center",
  lg: "p-2 min-h-11 min-w-11 inline-flex items-center justify-center",
};

interface IconButtonProps {
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /**
   * Obrigatório: o botão não tem texto, então é o único rótulo que um leitor de
   * tela recebe.
   */
  label: string;
  children: ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  [key: string]: any;
}

export default function IconButton({
  variant = "ghost",
  size = "lg",
  label,
  className = "",
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      className={`transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${SIZES[size]} ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
