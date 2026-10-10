/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from "react";

export type EmptyStateSize = "xs" | "sm" | "md";

const SIZES: Record<EmptyStateSize, string> = {
  xs: "p-4 text-xs text-gray-500",
  sm: "py-12 space-y-2",
  md: "p-12 space-y-3",
};

const BORDERED: Record<EmptyStateSize, string> = {
  xs: "border border-dashed border-gray-200 rounded-xl",
  sm: "border border-dashed border-gray-200 rounded-2xl",
  md: "border border-dashed border-gray-200 rounded-2xl",
};

/**
 * Bloco "não há nada aqui". O ícone entra pronto pelo chamador, porque o app
 * usa tamanhos e cores diferentes em cada tela.
 */
export default function EmptyState({
  icon,
  size = "sm",
  bordered = true,
  className = "",
  children,
}: {
  icon?: ReactNode;
  size?: EmptyStateSize;
  bordered?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        size === "xs" ? "" : "text-gray-500"
      } ${SIZES[size]} ${bordered ? BORDERED[size] : ""} ${className}`}
    >
      {icon}
      {children}
    </div>
  );
}
