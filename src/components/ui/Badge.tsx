/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from "react";

/**
 * Etiqueta curta. O peso e a caixa da fonte fazem parte do tom, porque os dois
 * usos do app divergem justamente nisso: a duração do serviço é monoespaçada e
 * em caixa baixa, o status do agendamento é caixa alta e extra-negrito.
 */
export type BadgeTone = "neutral" | "info" | "success" | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-600 font-mono font-bold",
  info: "font-extrabold uppercase bg-blue-50 text-blue-500 border border-blue-100",
  success: "font-extrabold uppercase bg-green-50 text-green-500 border border-green-100",
  danger: "font-extrabold uppercase bg-red-50 text-red-500 border border-red-100",
};

export default function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={`text-3xs px-2 py-0.5 rounded-full ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
