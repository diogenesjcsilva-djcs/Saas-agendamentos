/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from "react";

/**
 * Rótulo + controle.
 *
 * Dois estilos de rótulo existem no app e os dois estão aqui:
 *  - `micro`: caixa alta, 10px, cinza — usado nos formulários de conta.
 *  - `default`: 12px, cinza-escuro — usado nos formulários de dados.
 */

export type FieldVariant = "micro" | "default";

const WRAPPERS: Record<FieldVariant, string> = {
  micro: "space-y-1",
  default: "space-y-1.5",
};

const LABELS: Record<FieldVariant, string> = {
  micro: "text-3xs font-bold text-gray-400 uppercase tracking-wider block",
  default: "text-xs font-semibold text-gray-700 block",
};

export default function Field({
  label,
  htmlFor,
  variant = "micro",
  className = "",
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  variant?: FieldVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${WRAPPERS[variant]} ${className}`}>
      <label htmlFor={htmlFor} className={LABELS[variant]}>
        {label}
      </label>
      {children}
    </div>
  );
}
