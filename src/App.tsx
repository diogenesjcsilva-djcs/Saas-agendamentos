/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Tenant, Provider } from "./types";
import { getTenants, getProviders, login, register, getMe, socialLogin, getTenantBySlug, createTenant } from "./lib/api.js";
import ClientPortal from "./components/ClientPortal.js";
import ProviderDashboard from "./components/ProviderDashboard.js";
import { 
  Users, 
  Compass, 
  PlayCircle,
  LogIn,
  LogOut,
  User,
  Mail,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TenantRegistrationFormProps {
  onCancel: () => void;
  onSuccess: (slug: string) => void;
  tenants: Tenant[];
}

function TenantRegistrationForm({ onCancel, onSuccess, tenants }: TenantRegistrationFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("✂️");
  const [themeColor, setThemeColor] = useState("indigo");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Suggested emojis for logo
  const emojis = ["✂️", "✨", "💆‍♀️", "💅", "💄", "💈", "🦷", "🩺", "🏋️‍♂️", "🎨", "🐾", "🍰", "🚗", "💼"];

  // Suggested themes
  const themes = [
    { value: "indigo", label: "Azul Indigo", preview: "bg-indigo-600" },
    { value: "emerald", label: "Verde Esmeralda", preview: "bg-emerald-600" },
    { value: "rose", label: "Rosa Quartzo", preview: "bg-rose-600" },
    { value: "amber", label: "Laranja Âmbar", preview: "bg-amber-600" },
  ];

  // Auto-generate slug from name
  const handleNameChange = (val: string) => {
    setName(val);
    const generated = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-_ ]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
    setSlug(generated);
  };

  // Check if slug is already taken
  const cleanSlug = slug
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const isSlugTaken = cleanSlug && tenants.some(t => t.slug === cleanSlug);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSlugTaken) {
      setError("Este link de estabelecimento já está sendo utilizado.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createTenant({
        name,
        slug: cleanSlug,
        description,
        logoUrl,
        themeColor
      });
      onSuccess(cleanSlug);
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao criar o estabelecimento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl w-full mx-auto bg-white border border-gray-100 shadow-xl rounded-3xl p-8 space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Cadastrar Novo Estabelecimento</h3>
        <p className="text-xs text-gray-500">
          Preencha os dados abaixo para gerar a sua página de agendamentos personalizada.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider block text-left">Nome do Estabelecimento</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ex: Barbearia Imperial, Clínica Sorella..."
            className="w-full bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold"
          />
        </div>

        <div className="space-y-1">
          <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider block text-left">Link de Acesso (Slug)</label>
          <div className="flex rounded-xl bg-gray-50 border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-600 transition-all">
            <span className="bg-gray-100/80 px-3 py-2.5 border-r border-gray-200 text-gray-400 text-2xs font-semibold select-none flex items-center">
              portalagendeai.app.br/
            </span>
            <input
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="barbearia-imperial"
              className="w-full bg-transparent px-3 py-2.5 text-xs focus:outline-none font-semibold"
            />
          </div>
          {isSlugTaken && (
            <p className="text-3xs text-red-600 font-semibold mt-1 text-left">⚠️ Este link de acesso já está em uso por outro parceiro.</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider block text-left">Descrição das Atividades</label>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Oferecemos cortes clássicos, estética masculina e cuidados com a barba."
            rows={3}
            className="w-full bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider block text-left font-sans">Escolha o Logo (Emoji)</label>
          <div className="flex flex-wrap gap-2.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-100 justify-start">
            {emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setLogoUrl(emoji)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all border shrink-0 select-none cursor-pointer ${
                  logoUrl === emoji
                    ? "bg-white border-indigo-600 shadow-md scale-105"
                    : "border-transparent hover:bg-white hover:border-gray-200"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider block text-left">Tema de Cores da Marca</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {themes.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setThemeColor(t.value)}
                className={`p-3 rounded-2xl flex items-center gap-2 border text-2xs font-bold transition-all cursor-pointer ${
                  themeColor === t.value
                    ? "bg-indigo-50/20 border-indigo-600 shadow-sm"
                    : "bg-white border-gray-100 hover:border-gray-200"
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full ${t.preview} shrink-0`}></span>
                <span className="text-slate-800 truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !!isSlugTaken}
            className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            ) : (
              "Criar Estabelecimento"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [viewMode, setViewMode] = useState<"client" | "provider">("client");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [isNewProviderOnboarding, setIsNewProviderOnboarding] = useState<boolean>(false);

  const [pathname, setPathname] = useState<string>(window.location.pathname);
  const [is404, setIs404] = useState<boolean>(false);

  const navigateTo = (path: string) => {
    window.history.pushState(null, "", path);
    setPathname(path);
    setIs404(false);
  };
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState<string>("");
  const [authPassword, setAuthPassword] = useState<string>("");
  const [authName, setAuthName] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Social Authentication Simulator State
  const [socialAuthOpen, setSocialAuthOpen] = useState<"google" | "instagram" | null>(null);
  const [socialEmail, setSocialEmail] = useState<string>("");
  const [socialName, setSocialName] = useState<string>("");
  const [socialError, setSocialError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState<boolean>(false);
  // Browser history routing sync
  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
      setIs404(false);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    async function initApp() {
      setLoading(true);
      setError(null);
      try {
        const loadedTenants = await getTenants();
        setTenants(loadedTenants);

        // Check authentication session
        const token = localStorage.getItem("token");
        let activeUser = currentUser;
        if (token && !currentUser) {
          try {
            const res = await getMe();
            setCurrentUser(res.user);
            activeUser = res.user;
          } catch (err) {
            console.error("Session verification failed, logging out:", err);
            localStorage.removeItem("token");
            setCurrentUser(null);
          }
        }

        // Parse path
        const slug = pathname.substring(1); // Remove leading slash

        if (slug && slug !== "cadastrar") {
          // It's a tenant slug
          let tenant = loadedTenants.find(t => t.slug === slug);
          if (!tenant) {
            // Try fetching by slug directly in case it's newly created
            tenant = await getTenantBySlug(slug) || undefined;
          }

          if (tenant) {
            setSelectedTenant(tenant);
            setIs404(false);
            
            // Load providers for this tenant only
            const loadedProviders = await getProviders(tenant.id);
            setProviders(loadedProviders);
            
            // If logged-in user is a provider for this tenant, auto-select them
            if (activeUser && activeUser.role === "provider" && activeUser.providerId) {
              const matchingProv = loadedProviders.find(p => p.id === activeUser.providerId);
              if (matchingProv) {
                setSelectedProvider(matchingProv);
              } else if (loadedProviders.length > 0) {
                setSelectedProvider(loadedProviders[0]);
              }
            } else if (loadedProviders.length > 0) {
              setSelectedProvider(loadedProviders[0]);
            } else {
              setSelectedProvider(null);
            }
          } else {
            // Tenant not found -> 404
            setSelectedTenant(null);
            setIs404(true);
          }
        } else {
          // Home '/' or '/cadastrar'
          setSelectedTenant(null);
          setIs404(false);
        }
      } catch (err: any) {
        setError("Erro ao carregar dados do servidor. Certifique-se de que o backend e o banco estão ativos.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    initApp();
  }, [pathname]);

  const handleProviderChange = (id: string) => {
    const provider = providers.find(p => p.id === id);
    if (provider) {
      setSelectedProvider(provider);
      const tenant = tenants.find(t => t.id === provider.tenantId);
      if (tenant) {
        setSelectedTenant(tenant);
      }
    }
  };

  // Auth Operations
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await login(authEmail, authPassword);
      localStorage.setItem("token", res.token);
      setCurrentUser(res.user);
      setAuthModalOpen(false);
      setAuthEmail("");
      setAuthPassword("");
      
      // If logged in as provider, set view to provider and select correct provider profile
      if (res.user.role === "provider") {
        setViewMode("provider");
        const matchingProv = providers.find(p => p.id === res.user.providerId);
        if (matchingProv) {
          setSelectedProvider(matchingProv);
          const matchingTenant = tenants.find(t => t.id === matchingProv.tenantId);
          if (matchingTenant) setSelectedTenant(matchingTenant);
        }
      } else {
        setViewMode("client");
      }
    } catch (err: any) {
      setAuthError(err.message || "E-mail ou senha incorretos.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (
    e: React.FormEvent,
    role?: string,
    tenantId?: string,
    categoryId?: string,
    bio?: string
  ) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await register(authEmail, authPassword, authName, role, tenantId, categoryId, bio);
      localStorage.setItem("token", res.token);
      setCurrentUser(res.user);
      setAuthModalOpen(false);
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
      if (res.user.role === "provider") {
        const loadedProviders = await getProviders(tenantId);
        setProviders(loadedProviders);
        const matchingProv = loadedProviders.find(p => p.id === res.user.providerId);
        if (matchingProv) {
          setSelectedProvider(matchingProv);
        }
        setIsNewProviderOnboarding(true);
        setViewMode("provider");
      } else {
        setViewMode("client");
      }
    } catch (err: any) {
      setAuthError(err.message || "Erro ao realizar o cadastro.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSocialAuthSubmit = async (email: string, name: string, provider: "google" | "instagram") => {
    setSocialLoading(true);
    setSocialError(null);
    try {
      const res = await socialLogin(email, name, provider);
      localStorage.setItem("token", res.token);
      setCurrentUser(res.user);
      setSocialAuthOpen(null);
      setAuthModalOpen(false);
      setSocialEmail("");
      setSocialName("");
      setViewMode("client");
    } catch (err: any) {
      setSocialError(err.message || "Erro ao conectar com conta social.");
    } finally {
      setSocialLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setCurrentUser(null);
    setViewMode("client");
    
    // Reset selections to defaults
    if (tenants.length > 0) setSelectedTenant(tenants[0]);
    if (providers.length > 0) setSelectedProvider(providers[0]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-700">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="mt-4 font-semibold text-sm">Carregando ambiente multi-tenant...</p>
      </div>
    );
  }

  // Check if provider view is locked for non-providers
  const isProviderViewLocked = viewMode === "provider" && (!currentUser || currentUser.role !== "provider");

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white font-sans antialiased text-gray-800">
      
      {/* Top Interactive Banner / Demo Switcher */}
      <div className="bg-slate-900 border-b border-slate-800 text-white py-3 px-6 shadow-md z-10 sticky top-0 backdrop-blur-md bg-slate-900/95">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo & Subdomain info */}
          <div 
            onClick={() => navigateTo("/")} 
            className="flex items-center gap-3 shrink-0 cursor-pointer group"
          >
            <span className="text-xl bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-500/10 shadow-inner leading-none select-none group-hover:scale-105 transition-transform">
              🗓️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white leading-none whitespace-nowrap group-hover:text-indigo-400 transition-colors">portalagendeai</h1>
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-1.5 whitespace-nowrap">
                {selectedTenant 
                  ? `${selectedTenant.slug}.portalagendeai.app.br`
                  : `portalagendeai.app.br`
                }
              </p>
            </div>
          </div>

          {/* User Session Area */}
          <div className="flex items-center gap-4 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Discreet Provider / Client Switcher */}
            {selectedTenant && (
              <button
                onClick={() => setViewMode(viewMode === "client" ? "provider" : "client")}
                className="text-slate-400 hover:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors mr-2 whitespace-nowrap"
              >
                {viewMode === "client" ? (
                  <>
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>Área do Prestador</span>
                  </>
                ) : (
                  <>
                    <Compass className="w-3.5 h-3.5 shrink-0" />
                    <span>Voltar ao Portal</span>
                  </>
                )}
              </button>
            )}
            {/* Provider selector (only visible for provider portal when logged in as provider) */}
            {viewMode === "provider" && currentUser?.role === "provider" && (
              <div className="flex items-center gap-2 bg-slate-950/60 py-1.5 px-3 rounded-lg border border-slate-800 text-xs whitespace-nowrap">
                <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider">Prestador:</span>
                <span className="text-white font-semibold">
                  {selectedProvider?.name}
                </span>
              </div>
            )}

            {/* Session Action */}
            {currentUser ? (
              <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
                {currentUser.avatarUrl ? (
                  <img 
                    src={currentUser.avatarUrl} 
                    alt={currentUser.name} 
                    className="w-7 h-7 rounded-full border border-slate-700 shadow-sm shrink-0" 
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 select-none">
                    {currentUser.name.charAt(0)}
                  </span>
                )}
                <span className="text-slate-300 text-xs hidden sm:inline">
                  Olá, <strong className="text-white">{currentUser.name.replace(/\s*\((instagram|google)\)/i, "")}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  Sair
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setAuthModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/10 whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 shrink-0" />
                Entrar / Cadastrar
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8 flex flex-col justify-start">
        


        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 font-medium text-xs">
            {error}
          </div>
        )}

        {/* Dynamic Display of components */}
        <div className="flex-1 flex flex-col justify-start min-h-[500px]">
          <AnimatePresence mode="wait">
            {is404 ? (
              // 404 - ESTABELECIMENTO NÃO ENCONTRADO
              <motion.div
                key="error-404"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="max-w-md w-full mx-auto bg-white border border-gray-100 shadow-xl rounded-3xl p-8 text-center space-y-6 mt-10"
              >
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl select-none font-bold">
                  ⚠️
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-gray-900">Estabelecimento não encontrado</h2>
                  <p className="text-xs text-gray-500">
                    O link digitado não corresponde a nenhuma empresa ativa na plataforma. Certifique-se de que digitou o endereço corretamente.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => navigateTo("/")}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Voltar para a Página Inicial
                  </button>
                  <button
                    onClick={() => navigateTo("/cadastrar")}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cadastrar Novo Estabelecimento
                  </button>
                </div>
              </motion.div>
            ) : pathname === "/" ? (
              // LANDING PAGE - PORTALAGENDEAI
              <motion.div
                key="landing-page"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-12"
              >
                {/* Hero Section */}
                <div className="text-center space-y-6 py-8">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-full select-none">
                    ✨ Nova Plataforma Multi-Estabelecimentos
                  </span>
                  <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-2xl mx-auto">
                    Agendamentos Inteligentes <br />
                    <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">para o seu negócio</span>
                  </h2>
                  <p className="text-sm text-gray-505 max-w-lg mx-auto leading-relaxed">
                    Crie a página de agendamentos da sua barbearia, clínica, salão ou estúdio em segundos. Ofereça reservas online aos seus clientes e gerencie tudo em um painel unificado.
                  </p>
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => navigateTo("/cadastrar")}
                      className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-505 hover:from-indigo-700 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5 cursor-pointer"
                    >
                      Cadastrar Estabelecimento
                    </button>
                  </div>
                </div>

                {/* Grid of existing tenants */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">
                      Estabelecimentos Parceiros
                    </h3>
                    <span className="text-xs text-slate-500 font-semibold">{tenants.length} cadastrados</span>
                  </div>

                  {tenants.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 text-xs">
                      Nenhum estabelecimento cadastrado. Seja o primeiro!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {tenants.map(tenant => {
                        const theme = tenant.themeColor || "indigo";
                        const themeColorClass = 
                          theme === "emerald" ? "emerald" :
                          theme === "rose" ? "rose" :
                          theme === "amber" ? "amber" : "indigo";
                        
                        return (
                          <div
                            key={tenant.id}
                            className="bg-white rounded-3xl border border-gray-100 p-6 flex flex-col justify-between hover:shadow-xl hover:border-gray-200/60 hover:-translate-y-1 transition-all group duration-300"
                          >
                            <div className="space-y-4">
                              <span className="text-4xl p-3 bg-slate-50 rounded-2xl border border-slate-100/50 inline-block shadow-sm select-none">
                                {tenant.logoUrl || "🗓️"}
                              </span>
                              <div>
                                <h4 className="font-extrabold text-slate-900 text-base group-hover:text-indigo-600 transition-colors text-left">
                                  {tenant.name}
                                </h4>
                                <p className="text-4xs text-slate-450 font-mono mt-1 text-left">
                                  portalagendeai.app.br/{tenant.slug}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500 leading-relaxed font-medium line-clamp-3 text-left">
                                {tenant.description}
                              </p>
                            </div>

                            <button
                              onClick={() => navigateTo(`/${tenant.slug}`)}
                              className={`w-full mt-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm border border-transparent ${
                                themeColorClass === "emerald" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white" :
                                themeColorClass === "rose" ? "bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white" :
                                themeColorClass === "amber" ? "bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white" :
                                "bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white"
                              } cursor-pointer`}
                            >
                              Acessar Agendamentos
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            ) : pathname === "/cadastrar" ? (
              // TENANT REGISTRATION FORM
              <motion.div
                key="register-tenant"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
              >
                <TenantRegistrationForm onCancel={() => navigateTo("/")} onSuccess={(slug) => navigateTo(`/${slug}`)} tenants={tenants} />
              </motion.div>
            ) : isProviderViewLocked ? (
              // locked Provider view (show login form inline)
              <motion.div
                key="provider-login-lock"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="max-w-md w-full mx-auto bg-white border border-gray-100 shadow-xl rounded-3xl p-8 space-y-6 mt-10"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-inner text-lg font-bold">
                    💼
                  </div>
                  <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Painel de Prestadores</h2>
                  <p className="text-xs text-gray-500">
                    Acesso restrito. Faça login com suas credenciais de prestador para gerenciar sua agenda.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {authError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
                      {authError}
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider block text-left">E-mail Corporativo</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="nome@empresa.com"
                        className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider block text-left">Senha</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-505/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {authLoading ? (
                      <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                    ) : (
                      <>Acessar Painel</>
                    )}
                  </button>
                </form>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-4xs leading-relaxed text-slate-500 font-medium">
                  <span className="font-bold text-slate-700 block mb-1">Dica de teste (Prestadores pré-configurados):</span>
                  Use as contas a seguir para testar o painel:<br/>
                  • Carlos Barber: <code>carlos@imperial.com</code> (Senha: <code>12345678</code>)<br/>
                  • Dra. Heloísa: <code>heloisa@aura.com</code> (Senha: <code>12345678</code>)
                </div>
              </motion.div>
            ) : viewMode === "client" && selectedTenant ? (
              <motion.div
                key="client"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <ClientPortal 
                  tenant={selectedTenant} 
                  currentUser={currentUser}
                  authMode={authMode}
                  setAuthMode={setAuthMode}
                  authEmail={authEmail}
                  setAuthEmail={setAuthEmail}
                  authPassword={authPassword}
                  setAuthPassword={setAuthPassword}
                  authName={authName}
                  setAuthName={setAuthName}
                  authError={authError}
                  setAuthError={setAuthError}
                  authLoading={authLoading}
                  setAuthLoading={setAuthLoading}
                  handleLogin={handleLogin}
                  handleRegister={handleRegister}
                  setSocialAuthOpen={setSocialAuthOpen}
                />
              </motion.div>
            ) : viewMode === "provider" && selectedProvider ? (
              <motion.div
                key="provider"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <ProviderDashboard 
                  provider={selectedProvider} 
                  isNewOnboarding={isNewProviderOnboarding}
                  onOnboardingComplete={() => setIsNewProviderOnboarding(false)}
                />
              </motion.div>
            ) : (
              <div className="text-center py-20 text-gray-400 text-xs">
                Selecione uma empresa ou prestador para inicializar a visualização.
              </div>
            )}
          </AnimatePresence>
        </div>

      </main>

      {/* Auth Modal (Pop-up for client login/registration from client view) */}
      <AnimatePresence>
        {authModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-gray-100 shadow-2xl rounded-3xl p-8 max-w-sm w-full space-y-6 relative"
            >
              <button
                onClick={() => {
                  setAuthModalOpen(false);
                  setAuthError(null);
                }}
                className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>

              <div className="text-center space-y-2">
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  {authMode === "login" ? "Entrar na sua Conta" : "Criar sua Conta"}
                </h3>
                <p className="text-xs text-gray-500">
                  {authMode === "login" 
                    ? "Entre para ver seus agendamentos e agendar mais rápido." 
                    : "Cadastre-se para acompanhar seu histórico de reservas."
                  }
                </p>
              </div>

              <form onSubmit={authMode === "login" ? handleLogin : handleRegister} className="space-y-4">
                {authError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
                    {authError}
                  </div>
                )}

                {authMode === "register" && (
                  <div className="space-y-1">
                    <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider">Nome Completo</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder="Seu nome"
                        className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider">E-mail</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="seuemail@provedor.com"
                      className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider">Senha</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-gray-50 border border-gray-200 pl-10 pr-4 py-2.5 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 shadow-indigo-600/10"
                >
                  {authLoading ? (
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>{authMode === "login" ? "Entrar" : "Criar Conta"}</>
                  )}
                </button>
              </form>

              {/* Social Dividers & Intuitive Buttons */}
              <div className="relative flex items-center justify-center my-4">
                <div className="border-t border-gray-150 w-full"></div>
                <span className="absolute bg-white px-3 text-3xs text-gray-400 font-bold uppercase tracking-wider">ou continuar com</span>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSocialError(null);
                    setSocialAuthOpen("google");
                  }}
                  className="w-full py-2.5 bg-white hover:bg-gray-50 border border-gray-250 text-gray-700 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.57h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48C21.68,11.75 21.56,11.4 21.35,11.1z" fill="#4285F4" />
                    <path d="M12,20.62c2.6,0 4.78,-0.86 6.37,-2.33l-3.3,-2.57c-0.91,0.61 -2.07,0.98 -3.07,0.98 -2.37,0 -4.38,-1.6 -5.1,-3.75H3.5v2.66C5.09,18.88 8.35,20.62 12,20.62z" fill="#34A853" />
                    <path d="M6.9,13.06c-0.18,-0.54 -0.28,-1.11 -0.28,-1.7s0.1,-1.16 0.28,-1.7V7H3.5c-0.6,1.19 -0.94,2.53 -0.94,3.96S2.9,13.7 3.5,14.88L6.9,13.06z" fill="#FBBC05" />
                    <path d="M12,6.08c1.41,0 2.69,0.49 3.69,1.44l2.76,-2.76C16.78,3.2 14.6,2.38 12,2.38c-3.65,0 -6.91,1.74 -8.5,4.62l3.4,2.66C7.62,7.68 9.63,6.08 12,6.08z" fill="#EA4335" />
                  </svg>
                  Google
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSocialError(null);
                    setSocialAuthOpen("instagram");
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 via-pink-500 to-yellow-500 hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                  Instagram
                </button>
              </div>

              <div className="text-center text-xs border-t border-gray-100 pt-4">
                {authMode === "login" ? (
                  <p className="text-gray-500">
                    Ainda não tem conta?{" "}
                    <button
                      onClick={() => {
                        setAuthMode("register");
                        setAuthError(null);
                      }}
                      className="text-indigo-600 font-bold hover:underline"
                    >
                      Cadastre-se
                    </button>
                  </p>
                ) : (
                  <p className="text-gray-500">
                    Já tem uma conta?{" "}
                    <button
                      onClick={() => {
                        setAuthMode("login");
                        setAuthError(null);
                      }}
                      className="text-indigo-600 font-bold hover:underline"
                    >
                      Faça Login
                    </button>
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Social Authentication Simulator Modals */}
      <AnimatePresence>
        {socialAuthOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full overflow-hidden shadow-2xl rounded-3xl"
            >
              {socialAuthOpen === "google" ? (
                // GOOGLE OAUTH SIMULATOR
                <div className="bg-white border border-gray-200 text-gray-800 p-8 space-y-6">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.57h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48C21.68,11.75 21.56,11.4 21.35,11.1z" fill="#4285F4" />
                      <path d="M12,20.62c2.6,0 4.78,-0.86 6.37,-2.33l-3.3,-2.57c-0.91,0.61 -2.07,0.98 -3.07,0.98 -2.37,0 -4.38,-1.6 -5.1,-3.75H3.5v2.66C5.09,18.88 8.35,20.62 12,20.62z" fill="#34A853" />
                      <path d="M6.9,13.06c-0.18,-0.54 -0.28,-1.11 -0.28,-1.7s0.1,-1.16 0.28,-1.7V7H3.5c-0.6,1.19 -0.94,2.53 -0.94,3.96S2.9,13.7 3.5,14.88L6.9,13.06z" fill="#FBBC05" />
                      <path d="M12,6.08c1.41,0 2.69,0.49 3.69,1.44l2.76,-2.76C16.78,3.2 14.6,2.38 12,2.38c-3.65,0 -6.91,1.74 -8.5,4.62l3.4,2.66C7.62,7.68 9.63,6.08 12,6.08z" fill="#EA4335" />
                    </svg>
                    <h3 className="text-lg font-bold text-gray-900 leading-tight">Escolha uma conta</h3>
                    <p className="text-xs text-gray-500">para prosseguir para <span className="text-gray-900 font-semibold">Scheduler SaaS</span></p>
                  </div>

                  {socialError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
                      {socialError}
                    </div>
                  )}

                  <div className="divide-y divide-gray-150 border border-gray-150 rounded-2xl overflow-hidden text-xs">
                    {/* Option 1 */}
                    <button
                      onClick={() => handleSocialAuthSubmit("diogenes.silva@gmail.com", "Diógenes Silva", "google")}
                      disabled={socialLoading}
                      className="w-full p-4 hover:bg-gray-50 transition-colors text-left flex items-center justify-between"
                    >
                      <div>
                        <p className="font-bold text-gray-900">Diógenes Silva</p>
                        <p className="text-gray-500 font-medium">diogenes.silva@gmail.com</p>
                      </div>
                      <span className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100">DS</span>
                    </button>

                    {/* Custom input option */}
                    <div className="p-4 bg-gray-50/50 space-y-3">
                      <p className="text-gray-400 font-bold uppercase tracking-wider text-5xs">Ou usar outra conta</p>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Seu nome"
                          value={socialName}
                          onChange={(e) => setSocialName(e.target.value)}
                          className="w-full bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                        />
                        <input
                          type="email"
                          placeholder="seu.email@gmail.com"
                          value={socialEmail}
                          onChange={(e) => setSocialEmail(e.target.value)}
                          className="w-full bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={socialLoading || !socialEmail || !socialName}
                          onClick={() => handleSocialAuthSubmit(socialEmail, socialName, "google")}
                          className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-2xs font-bold transition-colors disabled:opacity-50"
                        >
                          Entrar com e-mail customizado
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-3xs text-gray-400 pt-2 font-medium">
                    <span>Termos de Serviço</span>
                    <button onClick={() => setSocialAuthOpen(null)} className="text-indigo-600 hover:underline font-bold text-xs">Cancelar</button>
                    <span>Privacidade</span>
                  </div>
                </div>
              ) : (
                // INSTAGRAM AUTH SIMULATOR
                <div className="bg-slate-900 border border-slate-800 text-slate-200 p-8 space-y-6">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <div className="w-12 h-12 bg-gradient-to-tr from-purple-600 via-pink-500 to-yellow-500 rounded-2xl flex items-center justify-center text-white shadow-md">
                      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-white leading-tight">Autorização do Instagram</h3>
                    <p className="text-xs text-slate-400">
                      <span className="text-white font-semibold">Scheduler SaaS</span> gostaria de obter as seguintes informações da sua conta do Instagram:
                    </p>
                  </div>

                  {socialError && (
                    <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-xl text-red-200 text-xs font-semibold">
                      {socialError}
                    </div>
                  )}

                  <div className="bg-slate-950 border border-slate-850 rounded-2xl p-5 space-y-4 text-xs">
                    <div className="space-y-1">
                      <p className="font-bold text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Perfil Básico (Obrigatório)
                      </p>
                      <p className="text-4xs text-slate-500">Nome de usuário, tipo de conta e e-mail cadastrado.</p>
                    </div>

                    <div className="border-t border-slate-900 pt-4 space-y-3">
                      <p className="text-5xs text-slate-500 font-bold uppercase tracking-wider">Conta a ser conectada:</p>
                      <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-bold text-xs text-white">D</div>
                        <div>
                          <p className="font-bold text-white">@diogenes_silva</p>
                          <p className="text-5xs text-slate-500">diogenes.instagram@instagram.com</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSocialAuthOpen(null)}
                      className="flex-1 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white text-xs font-bold transition-all"
                    >
                      Não Autorizar
                    </button>
                    <button
                      disabled={socialLoading}
                      onClick={() => handleSocialAuthSubmit("diogenes.instagram@instagram.com", "Diógenes Silva (Instagram)", "instagram")}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {socialLoading ? (
                        <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                      ) : (
                        <>Autorizar e Entrar</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Humble footer */}
      <footer className="bg-white border-t border-gray-100 py-6 px-8 text-center text-3xs text-gray-400 font-medium mt-auto">
        <p>© 2026 Scheduler SaaS Multi-Tenant. Lógica de concorrência com prevenção de overlap de slots.</p>
      </footer>

    </div>
  );
}
