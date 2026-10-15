/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Tenant, Provider } from "./types";
import { getTenants, getProviders, login, register, getMe, getTenantBySlug, createTenant } from "./lib/api.js";
import ClientPortal from "./components/ClientPortal.js";
import ProviderDashboard from "./components/ProviderDashboard.js";
import { getTenantThemeVars } from "./theme/tenant.js";
import {
  LogIn,
  LogOut,
  User,
  Mail,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Alert from "./components/ui/Alert.js";
import Button from "./components/ui/Button.js";
import Card, { cardClasses } from "./components/ui/Card.js";
import Field from "./components/ui/Field.js";
import Input from "./components/ui/Input.js";
import Modal from "./components/ui/Modal.js";
import Spinner from "./components/ui/Spinner.js";
import Textarea from "./components/ui/Textarea.js";
import TopBar from "./components/layout/TopBar.js";
import PageContainer from "./components/layout/PageContainer.js";

interface TenantRegistrationFormProps {
  onCancel: () => void;
  onSuccess: (slug: string, token: string, user: any) => void;
  tenants: Tenant[];
}

function TenantRegistrationForm({ onCancel, onSuccess, tenants }: TenantRegistrationFormProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("✂️");
  const [themeColor, setThemeColor] = useState("indigo");
  
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
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
      const res = await createTenant({
        name,
        slug: cleanSlug,
        description,
        logoUrl,
        themeColor,
        ownerName,
        email,
        password
      });
      onSuccess(cleanSlug, res.token, res.user);
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao criar o estabelecimento.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card radius="3xl" border="light" elevation="xl" padding="xl" className="max-w-xl w-full mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Cadastrar Novo Estabelecimento</h1>
        <p className="text-xs text-gray-500">
          Preencha os dados abaixo para gerar a sua página de agendamentos personalizada.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        <Field label="Nome do Estabelecimento" className="text-left" htmlFor="tenant-name">
          <Input
            id="tenant-name"
            tone="brand"
            size="md"
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ex: Barbearia Imperial, Clínica Sorella..."
          />
        </Field>

        <Field label="Link de Acesso (Slug)" className="text-left" htmlFor="tenant-slug">
          <div className="flex rounded-xl bg-gray-50 border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-600 transition-all">
            <span className="bg-gray-100/80 px-3 py-2.5 border-r border-gray-200 text-gray-600 text-2xs font-semibold select-none flex items-center">
              useagendeai.app.br/
            </span>
            <Input
              id="tenant-slug"
              bare
              size="md"
              type="text"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="barbearia-imperial"
            />
          </div>
          {isSlugTaken && (
            <p className="text-3xs text-red-600 font-semibold mt-1 text-left">⚠️ Este link de acesso já está em uso por outro parceiro.</p>
          )}
        </Field>

        <Field label="Descrição das Atividades" className="text-left" htmlFor="tenant-description">
          <Textarea
            id="tenant-description"
            tone="brand"
            size="md"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: Oferecemos cortes clássicos, estética masculina e cuidados com a barba."
            rows={3}
          />
        </Field>

        <Field label="Escolha o Logo (Emoji)" className="space-y-2 text-left" labelId="tenant-logo-label">
          <div
              role="radiogroup"
              aria-labelledby="tenant-logo-label"
              className="flex flex-wrap gap-2.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-100 justify-start"
            >
            {emojis.map((emoji) => (
              <Button
                key={emoji}
                type="button"
                variant="none"
                size="none"
                onClick={() => setLogoUrl(emoji)}
                role="radio"
                aria-checked={logoUrl === emoji}
                className={`w-11 h-11 rounded-xl text-xl border shrink-0 select-none ${
                  logoUrl === emoji
                    ? "bg-white border-indigo-600 shadow-md scale-105"
                    : "border-transparent hover:bg-white hover:border-gray-200"
                }`}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </Field>

        <Field label="Tema de Cores da Marca" className="space-y-2 text-left" labelId="tenant-theme-label">
          <div
              role="radiogroup"
              aria-labelledby="tenant-theme-label"
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
            {themes.map((t) => (
              <Button
                key={t.value}
                type="button"
                variant="none"
                size="none"
                onClick={() => setThemeColor(t.value)}
                role="radio"
                aria-checked={themeColor === t.value}
                className={`p-3 rounded-2xl justify-start gap-2 border text-2xs font-bold ${
                  themeColor === t.value
                    ? "bg-indigo-50/20 border-indigo-600 shadow-sm"
                    : "bg-white border-gray-100 hover:border-gray-200"
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full ${t.preview} shrink-0`}></span>
                <span className="text-slate-800 truncate">{t.label}</span>
              </Button>
            ))}
          </div>
        </Field>

        {/* Divider and Admin credentials section */}
        <div className="border-t border-gray-100 pt-5 space-y-4">
          <div>
            <h4 className="text-xs font-extrabold text-slate-900 text-left">Acesso do Administrador</h4>
            <p className="text-3xs text-gray-500 text-left">
              Crie as credenciais de login e senha para gerenciar a agenda deste estabelecimento.
            </p>
          </div>

          <Field label="Nome Completo do Responsável" className="text-left" htmlFor="tenant-owner-name">
            <Input
              id="tenant-owner-name"
              tone="brand"
              size="md"
              type="text"
              required
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Ex: Carlos Augusto Silva, Dra. Heloísa..."
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-mail / Login de Acesso" className="text-left" htmlFor="tenant-owner-email">
              <Input
                id="tenant-owner-email"
                tone="brand"
                size="md"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@empresa.com"
              />
            </Field>

            <Field label="Senha de Acesso" className="text-left" htmlFor="tenant-owner-password">
              <Input
                id="tenant-owner-password"
                tone="brand"
                size="md"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </Field>
          </div>
        </div>

        <div className="flex gap-4 pt-2">
          <Button variant="muted" size="md" className="flex-1" type="button" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            variant="neutral"
            size="md"
            className="flex-1"
            type="submit"
            disabled={loading || !!isSlugTaken}
            loading={loading}
          >
            Criar Estabelecimento
          </Button>
        </div>
      </form>
    </Card>
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
          setSelectedProvider(null);
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
        let matchingProv = providers.find(p => p.id === res.user.providerId);
        if (!matchingProv) {
          const loadedProviders = await getProviders(res.user.tenantId || undefined);
          setProviders(loadedProviders);
          matchingProv = loadedProviders.find(p => p.id === res.user.providerId);
        }
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
    bio?: string,
    serviceLocationType?: 'own_space' | 'at_client' | 'both'
  ) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await register(authEmail, authPassword, authName, role, tenantId, categoryId, bio, serviceLocationType);
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
        } else {
          setSelectedProvider({
            id: res.user.providerId,
            tenantId: res.user.tenantId || tenantId || 'tenant-1',
            categoryId,
            name: res.user.name || authName,
            email: res.user.email || authEmail,
            bio: bio || "",
            serviceLocationType: serviceLocationType || 'own_space'
          });
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

  const handleTenantCreated = async (slug: string, token: string, user: any) => {
    localStorage.setItem("token", token);
    setCurrentUser(user);
    
    try {
      const loadedTenants = await getTenants();
      setTenants(loadedTenants);
      const newTenant = loadedTenants.find(t => t.slug === slug);
      if (newTenant) {
        setSelectedTenant(newTenant);
        
        const loadedProviders = await getProviders(newTenant.id);
        setProviders(loadedProviders);
        const matchingProv = loadedProviders.find(p => p.id === user.providerId);
        if (matchingProv) {
          setSelectedProvider(matchingProv);
        }
      }
      setIsNewProviderOnboarding(true);
      setViewMode("provider");
      navigateTo(`/${slug}`);
    } catch (err) {
      console.error("Error setting up new tenant onboarding session:", err);
      // Fallback redirect
      navigateTo(`/${slug}`);
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
        <Spinner size="xl" tone="brand" />
        <p className="mt-4 font-semibold text-sm">Carregando ambiente multi-tenant...</p>
      </div>
    );
  }

  // Check if provider view is locked for non-providers
  const isProviderViewLocked = viewMode === "provider" && (!currentUser || currentUser.role !== "provider");

  /* O estabelecimento que a barra superior anuncia vem da rota, não do estado:
     o `handleLogout` deixa um tenant selecionado mesmo na home, e a barra não
     pode anunciar estabelecimento numa tela que não é dele. */
  const routeSlug = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  const isTenantRoute = !!routeSlug && routeSlug !== "cadastrar" && !is404;
  const topBarTenant = isTenantRoute ? selectedTenant : null;

  /* Uma largura por tela: o portal do cliente é um cartão estreito, o resto
     ocupa a largura de trabalho. */
  const pageWidth: "wide" | "narrow" =
    isTenantRoute && viewMode === "client" ? "narrow" : "wide";

  /* O atalho entre os dois portais morava dentro da barra; a barra agora só
     desenha, então a regra (que depende de prestador e sessão) fica aqui. */
  const handleToggleView = () => {
    const nextMode = viewMode === "client" ? "provider" : "client";
    if (nextMode === "provider" && !selectedProvider) {
      if (currentUser?.role === "provider" && currentUser.providerId) {
        const match = providers.find((p) => p.id === currentUser.providerId);
        if (match) setSelectedProvider(match);
        else if (providers.length > 0) setSelectedProvider(providers[0]);
      } else if (providers.length > 0) {
        setSelectedProvider(providers[0]);
      }
    }
    setViewMode(nextMode);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white font-sans antialiased text-gray-800">
      
      <TopBar
        tenant={topBarTenant}
        width={pageWidth}
        viewMode={viewMode}
        onToggleView={isTenantRoute ? handleToggleView : null}
        providerName={
          viewMode === "provider" && currentUser?.role === "provider"
            ? selectedProvider?.name
            : null
        }
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAuth={() => {
          setAuthMode("login");
          setAuthModalOpen(true);
        }}
        onHome={() => navigateTo("/")}
        /* A barra lê a cor do estabelecimento, mas só quando há um na rota:
           na home ela tem de cair no índigo padrão. */
        style={getTenantThemeVars(topBarTenant?.themeColor)}
      />

      {/* Main Container Content */}
      <main className="flex-1 flex flex-col">
        <PageContainer width={pageWidth} className="flex-1 space-y-8 flex flex-col justify-start">
        


        {error && (
          <Alert variant="error" size="md" className="rounded-2xl">
            {error}
          </Alert>
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
                className={`${cardClasses({ radius: "3xl", border: "light", elevation: "xl", padding: "xl" })} max-w-md w-full mx-auto text-center space-y-6 mt-10`}
              >
                <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl select-none font-bold">
                  ⚠️
                </div>
                <div className="space-y-2">
                  <h1 className="text-xl font-bold text-gray-900">Estabelecimento não encontrado</h1>
                  <p className="text-xs text-gray-500">
                    O link digitado não corresponde a nenhuma empresa ativa na plataforma. Certifique-se de que digitou o endereço corretamente.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Button variant="neutral" size="md" fullWidth onClick={() => navigateTo("/")}>
                    Voltar para a Página Inicial
                  </Button>
                  <Button variant="muted" size="md" fullWidth onClick={() => navigateTo("/cadastrar")}>
                    Cadastrar Novo Estabelecimento
                  </Button>
                </div>
              </motion.div>
            ) : pathname === "/" ? (
              // LANDING PAGE - USEAGENDEAI
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
                  <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-2xl mx-auto">
                    Agendamentos Inteligentes <br />
                    <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">para o seu negócio</span>
                  </h1>
                  <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
                    Crie a página de agendamentos da sua barbearia, clínica, salão ou estúdio em segundos. Ofereça reservas online aos seus clientes e gerencie tudo em um painel unificado.
                  </p>
                  <div className="flex justify-center gap-4">
                    <Button
                      variant="none"
                      size="lg"
                      onClick={() => navigateTo("/cadastrar")}
                      className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5"
                    >
                      Cadastrar Estabelecimento
                    </Button>
                  </div>
                </div>

                {/* Grid of existing tenants */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                      Estabelecimentos Parceiros
                    </h3>
                    <span className="text-xs text-slate-500 font-semibold">{tenants.length} cadastrados</span>
                  </div>

                  {tenants.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-500 text-xs">
                      Nenhum estabelecimento cadastrado. Seja o primeiro!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {tenants.map(tenant => {
                        return (
                          <Card
                            key={tenant.id}
                            radius="3xl"
                            border="light"
                            elevation="none"
                            padding="lg"
                            className="flex flex-col justify-between hover:shadow-xl hover:border-gray-200/60 hover:-translate-y-1 transition-all group duration-300"
                          >
                            <div className="space-y-4">
                              <span className="text-4xl p-3 bg-slate-50 rounded-2xl border border-slate-100/50 inline-block shadow-sm select-none">
                                {tenant.logoUrl || "🗓️"}
                              </span>
                              <div>
                                <h4 className="font-extrabold text-slate-900 text-base group-hover:text-indigo-600 transition-colors text-left">
                                  {tenant.name}
                                </h4>
                                <p className="text-3xs text-slate-500 font-mono mt-1 text-left">
                                  useagendeai.app.br/{tenant.slug}
                                </p>
                              </div>
                              <p className="text-xs text-gray-500 leading-relaxed font-medium line-clamp-3 text-left">
                                {tenant.description}
                              </p>
                            </div>

                            <Button
                              variant="soft"
                              size="none"
                              fullWidth
                              className="mt-6 py-2.5 rounded-xl text-xs"
                              onClick={() => navigateTo(`/${tenant.slug}`)}
                            >
                              Acessar Agendamentos
                            </Button>
                          </Card>
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
                <TenantRegistrationForm onCancel={() => navigateTo("/")} onSuccess={handleTenantCreated} tenants={tenants} />
              </motion.div>
            ) : isProviderViewLocked ? (
              // locked Provider view (show login form inline)
              <motion.div
                key="provider-login-lock"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className={`${cardClasses({ radius: "3xl", border: "light", elevation: "xl", padding: "xl" })} max-w-md w-full mx-auto space-y-6 mt-10`}
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto shadow-inner text-lg font-bold">
                    💼
                  </div>
                  <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Painel de Prestadores</h1>
                  <p className="text-xs text-gray-500">
                    Acesso restrito. Faça login com suas credenciais de prestador para gerenciar sua agenda.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {authError && <Alert variant="error">{authError}</Alert>}
                  <Field label="E-mail Corporativo" className="text-left" htmlFor="app-login-email">
                    <Input
                      id="app-login-email"
                      icon={Mail}
                      tone="brand"
                      size="md"
                      type="email"
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="nome@empresa.com"
                    />
                  </Field>
                  <Field label="Senha" className="text-left" htmlFor="app-login-password">
                    <Input
                      id="app-login-password"
                      icon={Lock}
                      tone="brand"
                      size="md"
                      type="password"
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </Field>

                  <Button
                    variant="neutral"
                    size="md"
                    fullWidth
                    type="submit"
                    loading={authLoading}
                  >
                    Acessar Painel
                  </Button>
                </form>

                <Alert variant="hint">
                  <span className="font-bold text-slate-700 block mb-1">Dica de teste (Prestadores pré-configurados):</span>
                  Use as contas a seguir para testar o painel:<br/>
                  • Carlos Barber: <code>carlos@imperial.com</code> (Senha: <code>12345678</code>)<br/>
                  • Dra. Heloísa: <code>heloisa@aura.com</code> (Senha: <code>12345678</code>)
                </Alert>
              </motion.div>
            ) : viewMode === "client" && selectedTenant ? (
              <motion.div
                key="client"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                /* Abre o escopo de cor do estabelecimento: tudo dentro do portal
                   do cliente le --tenant-accent* em vez de nomear uma cor. */
                style={getTenantThemeVars(selectedTenant.themeColor)}
              >
                <ClientPortal 
                  tenant={selectedTenant} 
                  selectedProvider={selectedProvider}
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
                  onNavigateHome={() => navigateTo("/")}
                />
              </motion.div>
            ) : viewMode === "provider" && selectedProvider ? (
              <motion.div
                key="provider"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                /* O painel do prestador lê a mesma cor do estabelecimento que o
                   portal do cliente — um escopo por vez, no elemento que o abre. */
                style={getTenantThemeVars(selectedTenant?.themeColor)}
              >
                <ProviderDashboard 
                  provider={selectedProvider} 
                  tenant={selectedTenant}
                  isNewOnboarding={isNewProviderOnboarding}
                  onOnboardingComplete={() => setIsNewProviderOnboarding(false)}
                  onProviderUpdate={(updated) => {
                    setSelectedProvider(updated);
                    setProviders(prev => prev.map(p => p.id === updated.id ? updated : p));
                    /* O "Olá, X" da barra lê currentUser, que só vem do /auth/me
                       no boot: sem isto a saudação fica com o nome antigo
                       depois de renomear o perfil. */
                    setCurrentUser((prev: any) =>
                      prev && prev.providerId === updated.id ? { ...prev, name: updated.name } : prev
                    );
                  }}
                  onTenantUpdate={(updated) => {
                    setSelectedTenant(updated);
                    setTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
                  }}
                />
              </motion.div>
            ) : (
              <div className="text-center py-20 text-gray-500 text-xs">
                Selecione uma empresa ou prestador para inicializar a visualização.
              </div>
            )}
          </AnimatePresence>
        </div>

        </PageContainer>
      </main>

      {/* Auth Modal (Pop-up for client login/registration from client view) */}
      <Modal
        open={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthError(null);
        }}
        size="sm"
        showClose
        labelledBy="auth-modal-title"
      >
        <div className="text-center space-y-2">
          <h3 id="auth-modal-title" className="text-lg font-extrabold text-slate-900 tracking-tight">
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
          {authError && <Alert variant="error">{authError}</Alert>}

          {authMode === "register" && (
            <Field label="Nome Completo" htmlFor="app-register-name">
              <Input
                id="app-register-name"
                icon={User}
                tone="brand"
                size="md"
                type="text"
                required
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Seu nome"
              />
            </Field>
          )}

          <Field label="E-mail" htmlFor="app-register-email">
            <Input
              id="app-register-email"
              icon={Mail}
              tone="brand"
              size="md"
              type="email"
              required
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="seuemail@provedor.com"
            />
          </Field>

          <Field label="Senha" htmlFor="app-register-password">
            <Input
              id="app-register-password"
              icon={Lock}
              tone="brand"
              size="md"
              type="password"
              required
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          <Button
            variant="brand"
            size="md"
            fullWidth
            type="submit"
            loading={authLoading}
          >
            {authMode === "login" ? "Entrar" : "Criar Conta"}
          </Button>
        </form>

        <div className="text-center text-xs border-t border-gray-100 pt-4">
          {authMode === "login" ? (
            <p className="text-gray-500">
              Ainda não tem conta?{" "}
              <Button
                variant="brandLink"
                size="none"
                onClick={() => {
                  setAuthMode("register");
                  setAuthError(null);
                }}
              >
                Cadastre-se
              </Button>
            </p>
          ) : (
            <p className="text-gray-500">
              Já tem uma conta?{" "}
              <Button
                variant="brandLink"
                size="none"
                onClick={() => {
                  setAuthMode("login");
                  setAuthError(null);
                }}
              >
                Faça Login
              </Button>
            </p>
          )}
        </div>
      </Modal>


      {/* Humble footer */}
      <footer className="bg-white border-t border-gray-100 py-6 px-8 text-center text-3xs text-gray-500 font-medium mt-auto">
        <p>© 2026 useagendeai</p>
      </footer>

    </div>
  );
}
