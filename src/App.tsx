/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { Tenant, Provider } from "./types";
import { getTenants, getProviders } from "./lib/api";
import ClientPortal from "./components/ClientPortal";
import ProviderDashboard from "./components/ProviderDashboard";
import { 
  Users, 
  Calendar, 
  Settings, 
  Layers, 
  Compass, 
  CheckSquare, 
  PlayCircle,
  HelpCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function App() {
  const [viewMode, setViewMode] = useState<"client" | "provider">("client");
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const t = await getTenants();
        setTenants(t);
        if (t.length > 0) {
          setSelectedTenant(t[0]);
        }

        const p = await getProviders();
        setProviders(p);
        if (p.length > 0) {
          setSelectedProvider(p[0]);
        }
      } catch (err) {
        console.error("Error loading application config:", err);
        setError("Erro ao carregar configurações de multi-tenancy.");
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Sync provider list when selecting client tenant to allow matching simulation
  const filteredProvidersForActiveTenant = providers.filter(
    p => selectedTenant && p.tenantId === selectedTenant.id
  );

  const handleTenantChange = (slug: string) => {
    const t = tenants.find(tenant => tenant.slug === slug);
    if (t) {
      setSelectedTenant(t);
      // Auto-set the first provider of this tenant as active for administration simulation comfort
      const firstProv = providers.find(p => p.tenantId === t.id);
      if (firstProv) setSelectedProvider(firstProv);
    }
  };

  const handleProviderChange = (id: string) => {
    const p = providers.find(prov => prov.id === id);
    if (p) {
      setSelectedProvider(p);
      // Sync the client view tenant as well so they match
      const matchingTenant = tenants.find(t => t.id === p.tenantId);
      if (matchingTenant) setSelectedTenant(matchingTenant);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-700">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="mt-4 font-semibold text-sm">Carregando ambiente multi-tenant...</p>
      </div>
    );
  }

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

          {/* Tenant/Provider Quick Simulator Selectors */}
          <div className="flex items-center gap-3 text-xs">
            {viewMode === "client" ? (
              <div className="flex items-center gap-2 bg-slate-950/60 py-1.5 px-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-4xs font-semibold uppercase tracking-wider">Alternar Empresa:</span>
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
            ) : (
              <div className="flex items-center gap-2 bg-slate-950/60 py-1.5 px-3 rounded-lg border border-slate-800">
                <span className="text-slate-500 text-4xs font-semibold uppercase tracking-wider">Ver como Prestador:</span>
                <select
                  value={selectedProvider?.id || ""}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  className="bg-transparent text-white font-semibold focus:outline-none border-none py-0 pr-6 pl-0 cursor-pointer"
                >
                  {providers.map(p => {
                    const t = tenants.find(tenant => tenant.id === p.tenantId);
                    return (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                        {p.name} ({t?.name})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8 flex flex-col justify-start">
        
        {/* Real-time Interaction Guide Banner (Aesthetic Explainer) */}
        <div className="bg-gradient-to-r from-indigo-50 to-indigo-100/50 border border-indigo-100 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5">
              <PlayCircle className="w-4 h-4 text-indigo-600" />
              Como testar a reatividade em tempo real do SaaS?
            </h3>
            <p className="text-xs text-indigo-800 leading-relaxed max-w-3xl">
              Este protótipo roda um servidor Express real no container. Faça um agendamento no <strong>Portal Cliente</strong>.
              Depois, mude para o <strong>Painel Prestador</strong> do mesmo profissional e veja a reserva aparecer no mesmo instante, faturamento recalcular, e o horário ficar ocupado para novos clientes!
            </p>
          </div>
          <a
            href="#client-portal-root"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById(viewMode === "client" ? "client-portal-root" : "provider-dashboard-root")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-3xs font-bold rounded-lg shrink-0 transition-colors shadow-sm shadow-indigo-600/10"
          >
            Ir para aplicação ↓
          </a>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 font-medium text-xs">
            {error}
          </div>
        )}

        {/* Dynamic Display of components */}
        <div className="flex-1 flex flex-col justify-start min-h-[500px]">
          <AnimatePresence mode="wait">
            {viewMode === "client" && selectedTenant ? (
              <motion.div
                key="client"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <ClientPortal tenant={selectedTenant} />
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

      {/* Humble footer */}
      <footer className="bg-white border-t border-gray-100 py-6 px-8 text-center text-3xs text-gray-400 font-medium">
        <p>© 2026 Scheduler SaaS Multi-Tenant. Lógica de concorrência com prevenção de overlap de slots.</p>
      </footer>

    </div>
  );
}
