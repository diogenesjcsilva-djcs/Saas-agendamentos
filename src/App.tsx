/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Tenant, Provider } from "./types";
import { getTenants, getProviders, login, register, getMe } from "./lib/api.js";
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

export default function App() {
  const [viewMode, setViewMode] = useState<"client" | "provider">("client");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  
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

  useEffect(() => {
    async function initApp() {
      try {
        const loadedTenants = await getTenants();
        setTenants(loadedTenants);
        if (loadedTenants.length > 0) {
          setSelectedTenant(loadedTenants[0]);
        }

        const loadedProviders = await getProviders();
        setProviders(loadedProviders);
        if (loadedProviders.length > 0) {
          setSelectedProvider(loadedProviders[0]);
        }

        // Check authentication session
        const token = localStorage.getItem("token");
        if (token) {
          try {
            const res = await getMe();
            setCurrentUser(res.user);
            
            // If provider is logged in, auto-select their provider profile
            if (res.user.role === "provider") {
              const matchingProv = loadedProviders.find(p => p.id === res.user.providerId);
              if (matchingProv) {
                setSelectedProvider(matchingProv);
                const matchingTenant = loadedTenants.find(t => t.id === matchingProv.tenantId);
                if (matchingTenant) setSelectedTenant(matchingTenant);
              }
            }
          } catch (err) {
            console.error("Session verification failed, logging out:", err);
            localStorage.removeItem("token");
            setCurrentUser(null);
          }
        }
      } catch (err: any) {
        setError("Erro ao carregar dados do servidor. Certifique-se de que o backend está ativo.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    initApp();
  }, []);

  const handleTenantChange = (slug: string) => {
    const tenant = tenants.find(t => t.slug === slug);
    if (tenant) {
      setSelectedTenant(tenant);
      const tenantProviders = providers.filter(p => p.tenantId === tenant.id);
      if (tenantProviders.length > 0) {
        setSelectedProvider(tenantProviders[0]);
      }
    }
  };

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await register(authEmail, authPassword, authName);
      localStorage.setItem("token", res.token);
      setCurrentUser(res.user);
      setAuthModalOpen(false);
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");
      setViewMode("client");
    } catch (err: any) {
      setAuthError(err.message || "Erro ao realizar o cadastro.");
    } finally {
      setAuthLoading(false);
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
          <div className="flex items-center gap-3">
            <span className="text-xl bg-indigo-600/20 p-2 rounded-xl text-indigo-400 border border-indigo-500/10 shadow-inner leading-none">
              🗓️
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight text-white leading-none">Scheduler SaaS</h1>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-5xs font-bold px-1.5 py-0.5 rounded uppercase leading-none tracking-wider">
                  Multi-Tenant
                </span>
              </div>
              <p className="text-5xs text-slate-400 font-mono mt-1">
                {viewMode === "client" 
                  ? `Subdomínio simulado: https://${selectedTenant?.slug}.schedulersaas.com`
                  : `Admin Portal: https://admin.schedulersaas.com/dashboard`
                }
              </p>
            </div>
          </div>

          {/* Core Visual Toggle (Persona Mode Switcher) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setViewMode("client")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "client"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              🌍 Ver Portal Cliente
            </button>
            <button
              onClick={() => setViewMode("provider")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === "provider"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              💼 Ver Painel Prestador
            </button>
          </div>

          {/* User Session Area */}
          <div className="flex items-center gap-4">
            {/* Tenant selector (only visible for client portal view when not locked) */}
            {viewMode === "client" && (
              <div className="flex items-center gap-2 bg-slate-950/60 py-1.5 px-3 rounded-lg border border-slate-800 text-xs">
                <span className="text-slate-500 text-5xs font-semibold uppercase tracking-wider">Empresa:</span>
                <select
                  value={selectedTenant?.slug || ""}
                  onChange={(e) => handleTenantChange(e.target.value)}
                  className="bg-transparent text-white font-semibold focus:outline-none border-none py-0 pr-6 pl-0 cursor-pointer"
                >
                  {tenants.map(t => (
                    <option key={t.id} value={t.slug} className="bg-slate-900 text-white">
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Provider selector (only visible for provider portal when logged in as provider) */}
            {viewMode === "provider" && currentUser?.role === "provider" && (
              <div className="flex items-center gap-2 bg-slate-950/60 py-1.5 px-3 rounded-lg border border-slate-800 text-xs">
                <span className="text-slate-500 text-5xs font-semibold uppercase tracking-wider">Prestador:</span>
                <span className="text-white font-semibold">
                  {selectedProvider?.name}
                </span>
              </div>
            )}

            {/* Session Action */}
            {currentUser ? (
              <div className="flex items-center gap-3">
                <span className="text-slate-300 text-xs hidden sm:inline">
                  Olá, <strong className="text-white">{currentUser.name}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sair
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAuthMode("login");
                  setAuthModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/10"
              >
                <LogIn className="w-3.5 h-3.5" />
                Entrar / Cadastrar
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8 flex flex-col justify-start">
        
        {/* Real-time Interaction Guide Banner (Aesthetic Explainer) */}
        {!isProviderViewLocked && (
          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 border border-indigo-100 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
                <PlayCircle className="w-4 h-4 text-indigo-600" />
                Agendamentos com Autenticação e Gestão Reativa
              </h3>
              <p className="text-xs text-indigo-800 leading-relaxed max-w-3xl">
                {currentUser?.role === "client" ? (
                  <>Você está logado como <strong>Cliente ({currentUser.name})</strong>. Seus agendamentos serão preenchidos automaticamente. Acesse a aba <strong>"Meus Agendamentos"</strong> no portal para cancelar ou reagendar suas reservas em tempo real!</>
                ) : currentUser?.role === "provider" ? (
                  <>Você está logado como <strong>Prestador ({currentUser.name})</strong>. Seu painel de controle está aberto. Você pode gerenciar seus serviços, bloquear datas e reagendar reservas de forma privada.</>
                ) : (
                  <>Navegue como cliente ou prestador. Crie uma conta de cliente ou faça login com um prestador padrão (ex: <code>carlos@imperial.com</code> / senha <code>12345678</code>) para ver a gestão em funcionamento.</>
                )}
              </p>
            </div>
            {viewMode === "client" && (
              <a
                href="#client-portal-root"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("client-portal-root")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-3xs font-bold rounded-lg shrink-0 transition-colors shadow-sm shadow-indigo-600/10"
              >
                Ir para aplicação ↓
              </a>
            )}
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 font-medium text-xs">
            {error}
          </div>
        )}

        {/* Dynamic Display of components */}
        <div className="flex-1 flex flex-col justify-start min-h-[500px]">
          <AnimatePresence mode="wait">
            {isProviderViewLocked ? (
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
                    <label className="text-3xs font-bold text-gray-400 uppercase tracking-wider">E-mail Corporativo</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="nome@empresa.com"
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
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2"
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
                <ClientPortal tenant={selectedTenant} currentUser={currentUser} />
              </motion.div>
            ) : viewMode === "provider" && selectedProvider ? (
              <motion.div
                key="provider"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <ProviderDashboard provider={selectedProvider} />
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

              <div className="text-center text-xs">
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

      {/* Humble footer */}
      <footer className="bg-white border-t border-gray-100 py-6 px-8 text-center text-3xs text-gray-400 font-medium mt-auto">
        <p>© 2026 Scheduler SaaS Multi-Tenant. Lógica de concorrência com prevenção de overlap de slots.</p>
      </footer>

    </div>
  );
}
