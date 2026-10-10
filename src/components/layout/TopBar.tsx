/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Compass, LogIn, LogOut, Menu, Users, X } from "lucide-react";
import { Tenant } from "../../types";
import Button from "../ui/Button.js";
import IconButton from "../ui/IconButton.js";

export type TopBarWidth = "wide" | "narrow";

const WIDTHS: Record<TopBarWidth, string> = {
  wide: "max-w-7xl",
  narrow: "max-w-4xl",
};

interface TopBarProps {
  /** Estabelecimento ativo. Sem ele a barra mostra a marca do app. */
  tenant?: Tenant | null;
  viewMode: "client" | "provider";
  /** Troca entre portal do cliente e painel do prestador. Ausente = sem atalho. */
  onToggleView?: (() => void) | null;
  /** Prestador selecionado, mostrado só dentro do painel. */
  providerName?: string | null;
  currentUser?: any;
  onLogout: () => void;
  onOpenAuth: () => void;
  onHome: () => void;
  /**
   * Acompanha a largura do `PageContainer` da tela para o logo e a sessão
   * ficarem alinhados com o conteúdo, e não com a viewport.
   */
  width?: TopBarWidth;
  className?: string;
  [key: string]: any;
}

/**
 * Barra superior do app.
 *
 * Ela é a moldura: fica branca, no mesmo tom do resto, e quem carrega a
 * identidade é o estabelecimento ativo — logo, nome e endereço. A marca do app
 * ("portalagendeai") só aparece quando não há estabelecimento, e como texto
 * comum, porque o `<h1>` de cada tela é o título do conteúdo, não o logo.
 */
export default function TopBar({
  tenant = null,
  viewMode,
  onToggleView = null,
  providerName = null,
  currentUser = null,
  onLogout,
  onOpenAuth,
  onHome,
  width = "wide",
  className = "",
  ...rest
}: TopBarProps) {
  // Abaixo de 640px a sessão e os seletores não cabem na linha: eles descem
  // para este painel, que abre pelo botão ao lado do avatar.
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  const isProviderMode = viewMode === "provider";
  const displayName = currentUser
    ? String(currentUser.name).replace(/\s*\((instagram|google)\)/i, "")
    : "";

  const avatar = currentUser ? (
    currentUser.avatarUrl ? (
      <img
        src={currentUser.avatarUrl}
        alt=""
        className="w-7 h-7 rounded-full border border-gray-200 shrink-0"
      />
    ) : (
      <span className="w-7 h-7 rounded-full bg-[var(--tenant-accent)] text-white flex items-center justify-center font-bold text-xs shrink-0 select-none">
        {displayName.charAt(0)}
      </span>
    )
  ) : null;

  // O mesmo atalho aparece na linha (desktop) e no painel (mobile), com o
  // respiro de cada um.
  const viewSwitcher = (fullWidth: boolean) =>
    onToggleView ? (
      <button
        type="button"
        onClick={() => {
          closeMenu();
          onToggleView();
        }}
        className={`${
          fullWidth ? "w-full py-2" : ""
        } text-gray-500 hover:text-[var(--tenant-accent)] text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer`}
      >
        {isProviderMode ? (
          <Compass className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <Users className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>{isProviderMode ? "Voltar ao Portal" : "Área do Prestador"}</span>
      </button>
    ) : null;

  const providerBadge =
    isProviderMode && providerName ? (
      <span className="flex items-center gap-2 bg-gray-50 py-1.5 px-3 rounded-lg border border-gray-200 text-xs whitespace-nowrap">
        <span className="text-gray-400 text-2xs font-semibold uppercase tracking-wider">
          Prestador:
        </span>
        <span className="text-slate-900 font-semibold">{providerName}</span>
      </span>
    ) : null;

  const logoutButton = (
    <Button
      variant="muted"
      size="none"
      leftIcon={<LogOut className="w-3.5 h-3.5 shrink-0" />}
      onClick={() => {
        closeMenu();
        onLogout();
      }}
      className="px-3 py-1.5 rounded-lg text-xs gap-1.5"
    >
      Sair
    </Button>
  );

  const authButton = (fullWidth: boolean) => (
    <Button
      size="none"
      fullWidth={fullWidth}
      leftIcon={<LogIn className="w-3.5 h-3.5 shrink-0" />}
      onClick={() => {
        closeMenu();
        onOpenAuth();
      }}
      className="px-3.5 py-1.5 rounded-lg text-xs gap-1.5 shadow-md shadow-[color:var(--tenant-accent)]/10"
    >
      Entrar / Cadastrar
    </Button>
  );

  return (
    <header
      {...rest}
      className={`sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 ${className}`}
    >
      <div
        className={`${WIDTHS[width]} mx-auto px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between gap-4`}
      >
        {/* Identidade: o estabelecimento quando há um, a marca quando não há */}
        <button
          type="button"
          onClick={() => {
            closeMenu();
            onHome();
          }}
          className="flex items-center gap-3 min-w-0 text-left cursor-pointer group"
        >
          <span className="w-9 h-9 rounded-xl bg-[var(--tenant-accent-soft)] border border-[var(--tenant-accent)]/20 text-[var(--tenant-accent)] flex items-center justify-center text-lg leading-none shrink-0 select-none transition-transform group-hover:scale-105">
            {tenant ? tenant.logoUrl || "🗓️" : "🗓️"}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold tracking-tight text-slate-900 truncate group-hover:text-[var(--tenant-accent)] transition-colors">
              {tenant ? tenant.name : "portalagendeai"}
            </span>
            <span className="block text-3xs text-gray-400 font-mono mt-0.5 truncate">
              {tenant ? `${tenant.slug}.portalagendeai.app.br` : "portalagendeai.app.br"}
            </span>
          </span>
        </button>

        {/* Linha única a partir de 640px */}
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          {viewSwitcher(false)}
          {providerBadge}
          {currentUser ? (
            <div className="flex items-center gap-2.5 whitespace-nowrap">
              {avatar}
              <span className="text-gray-500 text-xs hidden lg:inline">
                Olá, <strong className="text-slate-900">{displayName}</strong>
              </span>
              {logoutButton}
            </div>
          ) : (
            authButton(false)
          )}
        </div>

        {/* Abaixo de 640px: só o avatar (ou o atalho de entrar) na linha */}
        <div className="sm:hidden flex items-center gap-2 shrink-0">
          {currentUser ? (
            avatar
          ) : (
            <Button
              size="none"
              onClick={() => {
                closeMenu();
                onOpenAuth();
              }}
              className="px-3 py-1.5 rounded-lg text-2xs"
            >
              Entrar
            </Button>
          )}
          <IconButton
            label={menuOpen ? "Fechar menu" : "Abrir menu"}
            variant="outline"
            size="md"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </IconButton>
        </div>
      </div>

      {/* Painel compacto do mobile */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3">
          {currentUser && (
            <div className="flex items-center gap-2.5 min-w-0">
              {avatar}
              <span className="text-xs text-gray-500 truncate">
                Olá, <strong className="text-slate-900">{displayName}</strong>
              </span>
            </div>
          )}
          {providerBadge}
          {viewSwitcher(true)}
          {currentUser ? (
            <Button
              variant="muted"
              size="none"
              fullWidth
              leftIcon={<LogOut className="w-3.5 h-3.5 shrink-0" />}
              onClick={() => {
                closeMenu();
                onLogout();
              }}
              className="px-3 py-2 rounded-lg text-xs gap-1.5"
            >
              Sair
            </Button>
          ) : (
            authButton(true)
          )}
        </div>
      )}
    </header>
  );
}
