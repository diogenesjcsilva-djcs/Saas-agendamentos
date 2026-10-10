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
  micro: "text-3xs font-bold text-gray-500 uppercase tracking-wider block",
  default: "text-xs font-semibold text-gray-700 block",
};

export default function Field({
  label,
  htmlFor,
  labelId,
  variant = "micro",
  className = "",
  children,
}: {
  label: ReactNode;
  /**
   * `id` do controle. Sempre que houver um controle único dentro do campo,
   * passe o mesmo `id` que ele usa — é o que faz o clique no rótulo focar o
   * campo e o leitor de tela anunciar o nome junto.
   */
  htmlFor?: string;
  /**
   * Para quando não existe um controle único: grupos de rádio, grades de
   * botões. O rótulo ganha esse `id` e o grupo aponta para ele com
   * `aria-labelledby`, já que `<label for>` não vale para contêineres.
   */
  labelId?: string;
  variant?: FieldVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`${WRAPPERS[variant]} ${className}`}>
      <label htmlFor={htmlFor} id={labelId} className={LABELS[variant]}>
        {label}
      </label>
      {children}
    </div>
  );
}
