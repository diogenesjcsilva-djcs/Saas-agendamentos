/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cardClasses } from "./Card.js";
import IconButton from "./IconButton.js";

export type ModalSize = "sm" | "md" | "lg";
export type ModalScrim = "default" | "strong";
export type ModalLayer = "base" | "top";

const SIZES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
};

const SCRIMS: Record<ModalScrim, string> = {
  default: "bg-slate-900/60 backdrop-blur-sm",
  strong: "bg-slate-950/80 backdrop-blur-md",
};

const LAYERS: Record<ModalLayer, string> = {
  base: "z-50",
  top: "z-[60]",
};

/**
 * Candidatos a receber foco dentro do painel. O que está desabilitado ou
 * escondido é descartado em `focusables()`, para o seletor ficar sem `:not()`.
 */
const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";

/**
 * Modais abertos, na ordem de abertura. Dois podem estar abertos ao mesmo
 * tempo (o de autenticação social abre por cima do de login), e só o de cima
 * deve reagir ao Escape e prender o Tab.
 */
const openModals: object[] = [];

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  scrim?: ModalScrim;
  /** Modais aninhados (um abre por cima do outro) precisam de camadas distintas. */
  layer?: ModalLayer;
  /** Sem moldura: o conteúdo traz o próprio fundo e respiro. */
  bare?: boolean;
  /** Desenha o ✕ no canto superior direito. */
  showClose?: boolean;
  /** `id` do título visível. Dá nome ao diálogo para o leitor de tela. */
  labelledBy?: string;
  /** Alternativa ao `labelledBy`, quando o título não existe no DOM. */
  ariaLabel?: string;
  className?: string;
}

export default function Modal({
  open,
  onClose,
  children,
  size = "md",
  scrim = "default",
  layer = "base",
  bare = false,
  showClose = false,
  labelledBy,
  ariaLabel,
  className = "",
}: ModalProps) {
  const panelRef = useRef<any>(null);
  const token = useRef<any>({});

  useEffect(() => {
    if (!open) return;

    const me = token.current;
    openModals.push(me);
    const isTopmost = () => openModals[openModals.length - 1] === me;

    // Onde o foco estava antes de abrir, para devolver no fechamento.
    const previouslyFocused = document.activeElement as any;

    // O projeto não tem @types/react, então o que vem do DOM chega como
    // `unknown` e precisa ser anotado na mão.
    const focusables = (): any[] => {
      const panel = panelRef.current as any;
      if (!panel) return [];
      return (Array.from(panel.querySelectorAll(FOCUSABLE)) as any[]).filter(
        (el: any) =>
          !el.hasAttribute("disabled") &&
          el.tabIndex !== -1 &&
          (el.offsetParent !== null || el === document.activeElement),
      );
    };

    // O foco entra no painel: primeiro controle, ou o próprio painel.
    const first = focusables()[0];
    (first ?? panelRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost()) return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const nodes = focusables();
      if (nodes.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const firstNode = nodes[0];
      const lastNode = nodes[nodes.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === firstNode || active === panelRef.current) {
          event.preventDefault();
          lastNode.focus();
        }
      } else if (active === lastNode || !panelRef.current?.contains(active)) {
        event.preventDefault();
        firstNode.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = openModals.indexOf(me);
      if (index >= 0) openModals.splice(index, 1);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  const panel = bare
    ? cardClasses({ radius: "3xl", tone: "none", border: "none", elevation: "2xl", padding: "none" })
    : cardClasses({ radius: "3xl", tone: "white", border: "light", elevation: "2xl", padding: "xl" });

  return (
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 ${SCRIMS[scrim]} ${LAYERS[layer]} flex items-center justify-center p-4`}
        >
          {/* O próprio painel é animado — sem wrapper, senão a caixa muda de
              tamanho na animação e o ✕ sai do lugar. */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : ariaLabel}
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`w-full ${SIZES[size]} ${panel} focus:outline-none ${
              bare ? "overflow-hidden" : "space-y-6 relative"
            } ${className}`}
          >
            {showClose && (
              <IconButton
                variant="bare"
                size="none"
                label="Fechar"
                onClick={onClose}
                className="absolute right-6 top-6 font-bold text-sm"
              >
                ✕
              </IconButton>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
