import type { CSSProperties } from "react";

/* ===========================================================================
   Tenant accent theme
   ---------------------------------------------------------------------------
   A tenant picks one palette (`Tenant.themeColor`, one of the four the
   registration form offers). Every component inside the tenant's scope reads
   the resolved colours from three CSS custom properties — background, border
   and text utilities all point at the same `--tenant-accent` names — so no
   component names a colour of its own.

   `getTenantThemeVars()` writes those three properties onto the element that
   opens the scope (see App.tsx, around <ClientPortal>). `src/index.css`
   declares the same names with the default palette, so the utilities still
   resolve outside a tenant (home page, registration) instead of falling back
   to an invalid value.
   =========================================================================== */

/** The palettes a tenant can pick. Mirrors the `themeColor` values the API accepts. */
export const TENANT_THEME_COLORS = ["indigo", "emerald", "rose", "amber"] as const;

export type TenantThemeColor = (typeof TENANT_THEME_COLORS)[number];

export interface TenantPalette {
  /** Main accent — solid buttons, active tab, links. */
  accent: string;
  /** Darker accent — hover and pressed states on a solid accent surface. */
  accentStrong: string;
  /** Faintest tint — selected cards, tinted panels. */
  accentSoft: string;
}

export const DEFAULT_TENANT_THEME_COLOR: TenantThemeColor = "indigo";

/**
 * The palette steps the UI already used, kept as plain colour values rather
 * than `var()` references so charts and other non-CSS consumers can read them.
 * Keep in sync with the `--tenant-accent*` defaults in src/index.css.
 */
export const TENANT_THEME_PALETTES: Record<TenantThemeColor, TenantPalette> = {
  indigo: {
    accent: "oklch(51.1% 0.262 276.966)", // indigo-600
    accentStrong: "oklch(45.7% 0.24 277.023)", // indigo-700
    accentSoft: "oklch(96.2% 0.018 272.314)", // indigo-50
  },
  emerald: {
    accent: "oklch(59.6% 0.145 163.225)", // emerald-600
    accentStrong: "oklch(50.8% 0.118 165.612)", // emerald-700
    accentSoft: "oklch(97.9% 0.021 166.113)", // emerald-50
  },
  rose: {
    accent: "oklch(58.6% 0.253 17.585)", // rose-600
    accentStrong: "oklch(51.4% 0.222 16.935)", // rose-700
    accentSoft: "oklch(96.9% 0.015 12.422)", // rose-50
  },
  amber: {
    accent: "oklch(66.6% 0.179 58.318)", // amber-600
    accentStrong: "oklch(55.5% 0.163 48.998)", // amber-700
    accentSoft: "oklch(98.7% 0.022 95.277)", // amber-50
  },
};

/** Narrows a `themeColor` coming from the database to a palette we know. */
export function getTenantThemeColor(themeColor?: string | null): TenantThemeColor {
  return TENANT_THEME_COLORS.includes(themeColor as TenantThemeColor)
    ? (themeColor as TenantThemeColor)
    : DEFAULT_TENANT_THEME_COLOR;
}

export function getTenantPalette(themeColor?: string | null): TenantPalette {
  return TENANT_THEME_PALETTES[getTenantThemeColor(themeColor)];
}

/**
 * The three custom properties for a tenant, ready to spread into `style` on the
 * element that opens the tenant scope. An unknown or missing palette resolves
 * to the default, so the scope is always complete.
 */
export function getTenantThemeVars(themeColor?: string | null): CSSProperties {
  const palette = getTenantPalette(themeColor);

  return {
    "--tenant-accent": palette.accent,
    "--tenant-accent-strong": palette.accentStrong,
    "--tenant-accent-soft": palette.accentSoft,
  } as CSSProperties;
}
