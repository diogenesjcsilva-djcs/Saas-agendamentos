/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  className = "",
}: ModalProps) {
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
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`w-full ${SIZES[size]} ${panel} ${
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
