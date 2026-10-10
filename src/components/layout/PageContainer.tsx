/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from "react";

/**
 * O container de largura do app inteiro.
 *
 * Existem só duas larguras, e a escolha é da tela, não do conteúdo:
 *
 * - `wide` (`max-w-7xl`) — telas de trabalho: home, cadastro de estabelecimento,
 *   painel do prestador, 404.
 * - `narrow` (`max-w-4xl`) — portal do cliente, que é um cartão só e fica melhor
 *   perto de 900px do que de 1280px.
 *
 * Antes disso cada tela escolhia o próprio `max-w-*` e o próprio padding, então
 * o portal do cliente era um `max-w-4xl` dentro de um `max-w-7xl` com os dois
 * paddings somados — cartão dentro de container. Agora a moldura é uma só e o
 * que vem depois é conteúdo, não outro container.
 */
export type PageContainerWidth = "wide" | "narrow";

const WIDTHS: Record<PageContainerWidth, string> = {
  wide: "max-w-7xl",
  narrow: "max-w-4xl",
};

interface PageContainerProps {
  width?: PageContainerWidth;
  className?: string;
  children?: ReactNode;
  [key: string]: any;
}

export default function PageContainer({
  width = "wide",
  className = "",
  children,
  ...rest
}: PageContainerProps) {
  return (
    <div
      {...rest}
      className={`w-full mx-auto px-4 py-6 sm:px-6 md:px-8 md:py-8 ${WIDTHS[width]} ${className}`}
    >
      {children}
    </div>
  );
}
