/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Provider, 
  Service, 
  Booking, 
  AvailabilityRule, 
  AvailabilityException,
  Tenant,
  ServiceLocationType
} from "../types";
import { 
  getServices, 
  createService, 
  updateService, 
  deleteService, 
  getAvailabilityRules, 
  updateAvailabilityRules, 
  getExceptions, 
  createException, 
  deleteException, 
  getBookings, 
  updateBookingStatus,
  updateProviderSettings
} from "../lib/api";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell 
} from "recharts";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Plus, 
  Edit2, 
  Trash2, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Clock3, 
  Save, 
  CalendarCheck, 
  CalendarOff,
  UserCheck,
  Search,
  Check,
  FileText,
  Settings,
  Key,
  Lock,
  Mail,
  Globe,
  MapPin,
  Copy,
  ExternalLink,
  Eye,
  Palette,
  Store
} from "lucide-react";
import { motion } from "motion/react";
import Button from "./ui/Button.js";
import IconButton from "./ui/IconButton.js";
import Input from "./ui/Input.js";
import Select from "./ui/Select.js";
import Textarea from "./ui/Textarea.js";
import Field from "./ui/Field.js";
import Card, { cardClasses } from "./ui/Card.js";
import Alert from "./ui/Alert.js";
import Badge from "./ui/Badge.js";
import EmptyState from "./ui/EmptyState.js";
import Modal from "./ui/Modal.js";
import Spinner from "./ui/Spinner.js";
import { getTenantPalette } from "../theme/tenant.js";

interface ProviderDashboardProps {
  provider: Provider;
  tenant?: Tenant | null;
  isNewOnboarding?: boolean;
  onOnboardingComplete?: () => void;
  onProviderUpdate?: (updated: Provider) => void;
  onTenantUpdate?: (updated: Tenant) => void;
}

type TabType = "overview" | "bookings" | "services" | "availability" | "settings";

/* Graficos no mundo claro. A grade e os eixos sao neutros e fixos; a primeira
   serie lê a cor do estabelecimento e a segunda fica num cinza, para as duas
   linhas continuarem distinguiveis em qualquer paleta. O Recharts recebe
   valores de cor, nao custom properties, por isso `theme/tenant` e lido aqui. */
const CHART_GRID = "#e5e7eb"; // gray-200
const CHART_AXIS = "#9ca3af"; // gray-400
const CHART_SERIES_SECONDARY = "#64748b"; // slate-500
const CHART_TOOLTIP = { backgroundColor: "#ffffff", border: "1px solid #e5e7eb" };

export default function ProviderDashboard({
  provider, 
  tenant, 
  isNewOnboarding, 
  onOnboardingComplete,
  onProviderUpdate,
  onTenantUpdate 
}: ProviderDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Cor do estabelecimento resolvida em valor, para os graficos do Recharts.
  const palette = getTenantPalette(tenant?.themeColor);
  
  // Dynamic Data
  const [services, setServices] = useState<Service[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // CRUD Forms States
  // Service Form
  const [showServiceModal, setShowServiceModal] = useState<boolean>(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceName, setServiceName] = useState<string>("");
  const [serviceDesc, setServiceDesc] = useState<string>("");
  const [serviceDuration, setServiceDuration] = useState<number>(30);
  const [serviceBuffer, setServiceBuffer] = useState<number>(10);
  const [servicePrice, setServicePrice] = useState<number>(50);

  // Booking Filtering
  const [bookingFilterStatus, setBookingFilterStatus] = useState<string>("all");
  const [bookingSearch, setBookingSearch] = useState<string>("");

  // Exception Form
  const [exceptDate, setExceptDate] = useState<string>("");
  const [exceptBlocked, setExceptBlocked] = useState<boolean>(true);
  const [exceptStart, setExceptStart] = useState<string>("09:00");
  const [exceptEnd, setExceptEnd] = useState<string>("18:00");

  // Weekly availability grid
  const [workingDays, setWorkingDays] = useState<Record<number, { active: boolean; start: string; end: string }>>({
    0: { active: false, start: "09:00", end: "18:00" }, // Dom
    1: { active: true, start: "09:00", end: "18:00" }, // Seg
    2: { active: true, start: "09:00", end: "18:00" }, // Ter
    3: { active: true, start: "09:00", end: "18:00" }, // Qua
    4: { active: true, start: "09:00", end: "18:00" }, // Qui
    5: { active: true, start: "09:00", end: "18:00" }, // Sex
    6: { active: false, start: "09:00", end: "18:00" }, // Sáb
  });

  // Load everything on mount or provider change
  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      setError(null);
      try {
        const [servs, bks, rls, exps] = await Promise.all([
          getServices(provider.id),
          getBookings(provider.id),
          getAvailabilityRules(provider.id),
          getExceptions(provider.id)
        ]);

        setServices(servs);
        setBookings(bks);
        setRules(rls);
        setExceptions(exps);
        const newWorkingDays = { ...workingDays };
        rls.forEach(rule => {
          newWorkingDays[rule.dayOfWeek] = {
            active: true,
            start: rule.startTime,
            end: rule.endTime
          };
        });
        setWorkingDays(newWorkingDays);

        if (isNewOnboarding || servs.length === 0) {
          setActiveTab("services");
          setShowServiceModal(true);
          if (isNewOnboarding && onOnboardingComplete) {
            onOnboardingComplete();
          }
        }
      } catch (err) {
        setError("Erro ao carregar dados do painel.");
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [provider]);

  // Flash messages helper
  const showFlashSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Settings State
  const [settingsName, setSettingsName] = useState<string>(provider.name || "");
  const [settingsEmail, setSettingsEmail] = useState<string>(provider.email || "");
  const [settingsBio, setSettingsBio] = useState<string>(provider.bio || "");
  const [settingsLocationType, setSettingsLocationType] = useState<ServiceLocationType>(provider.serviceLocationType || "both");
  const [settingsAvatarUrl, setSettingsAvatarUrl] = useState<string>(provider.avatarUrl || "");
  const [settingsSlug, setSettingsSlug] = useState<string>(tenant?.slug || "");
  const [settingsThemeColor, setSettingsThemeColor] = useState<string>(tenant?.themeColor || "indigo");
  const [settingsTenantName, setSettingsTenantName] = useState<string>(tenant?.name || provider.name || "");
  const [settingsTenantDesc, setSettingsTenantDesc] = useState<string>(tenant?.description || provider.bio || "");
  
  const [settingsPassword, setSettingsPassword] = useState<string>("");
  const [settingsConfirmPassword, setSettingsConfirmPassword] = useState<string>("");
  const [settingsSaving, setSettingsSaving] = useState<boolean>(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  /* Nome de exibicao do prestador, editavel no proprio cartao de perfil. */
  const [editingName, setEditingName] = useState<boolean>(false);
  const [inlineName, setInlineName] = useState<string>(provider.name || "");
  const [inlineNameSaving, setInlineNameSaving] = useState<boolean>(false);

  useEffect(() => {
    setSettingsName(provider.name || "");
    setSettingsEmail(provider.email || "");
    setSettingsBio(provider.bio || "");
    setSettingsLocationType(provider.serviceLocationType || "both");
    setSettingsAvatarUrl(provider.avatarUrl || "");
    setInlineName(provider.name || "");
    if (tenant) {
      setSettingsSlug(tenant.slug || "");
      setSettingsThemeColor(tenant.themeColor || "indigo");
      setSettingsTenantName(tenant.name || provider.name || "");
      setSettingsTenantDesc(tenant.description || provider.bio || "");
    }
  }, [provider, tenant]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsError(null);

    if (settingsPassword && settingsPassword.length < 6) {
      setSettingsError("A nova senha deve conter pelo menos 6 caracteres.");
      setSettingsSaving(false);
      return;
    }

    if (settingsPassword && settingsPassword !== settingsConfirmPassword) {
      setSettingsError("A confirmação de senha não confere com a nova senha digitada.");
      setSettingsSaving(false);
      return;
    }

    try {
      const res = await updateProviderSettings({
        name: settingsName,
        email: settingsEmail,
        password: settingsPassword || undefined,
        bio: settingsBio,
        avatarUrl: settingsAvatarUrl,
        serviceLocationType: settingsLocationType,
        slug: settingsSlug || undefined,
        themeColor: settingsThemeColor || undefined,
        tenantName: settingsTenantName || undefined,
        tenantDescription: settingsTenantDesc || undefined
      });

      showFlashSuccess("Configurações atualizadas com sucesso!");
      setSettingsPassword("");
      setSettingsConfirmPassword("");

      if (res.provider && onProviderUpdate) {
        onProviderUpdate(res.provider);
      }
      if (res.tenant && onTenantUpdate) {
        onTenantUpdate(res.tenant);
      }
    } catch (err: any) {
      setSettingsError(err.message || "Erro ao salvar configurações.");
    } finally {
      setSettingsSaving(false);
    }
  };

  /* Renomear o nome de exibicao sem passar por Configuracoes. A API grava
     users, providers e tenants na mesma transacao, e o nome do estabelecimento
     cai para o nome do prestador quando `tenantName` nao vai no corpo — por
     isso os campos que nao estao em edicao sao reenviados como estao hoje. */
  const handleInlineNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextName = inlineName.trim();

    if (!nextName) {
      setError("O nome de exibição não pode ficar vazio.");
      return;
    }
    if (nextName === provider.name) {
      setEditingName(false);
      return;
    }

    setInlineNameSaving(true);
    setError(null);
    try {
      const res = await updateProviderSettings({
        name: nextName,
        email: provider.email,
        bio: provider.bio || "",
        avatarUrl: provider.avatarUrl || "",
        serviceLocationType: provider.serviceLocationType || "both",
        tenantName: tenant?.name || undefined,
        tenantDescription: tenant?.description || undefined
      });

      if (res.provider && onProviderUpdate) onProviderUpdate(res.provider);
      if (res.tenant && onTenantUpdate) onTenantUpdate(res.tenant);
      showFlashSuccess("Nome de exibição atualizado com sucesso!");
      setEditingName(false);
    } catch (err: any) {
      setError(err.message || "Erro ao atualizar o nome de exibição.");
    } finally {
      setInlineNameSaving(false);
    }
  };


  // 1. Manage Bookings
  const handleStatusChange = async (bookingId: string, newStatus: Booking["status"]) => {
    try {
      const updated = await updateBookingStatus(bookingId, newStatus);
      setBookings(prev => prev.map(b => b.id === bookingId ? updated : b));
      showFlashSuccess(`Agendamento marcado como ${newStatus === 'confirmed' ? 'confirmado' : newStatus === 'cancelled' ? 'cancelado' : 'concluído'}!`);
    } catch (err) {
      console.error(err);
      setError("Não foi possível alterar o status do agendamento.");
    }
  };

  // 2. Manage Services CRUD
  const openNewServiceModal = () => {
    setEditingServiceId(null);
    setServiceName("");
    setServiceDesc("");
    setServiceDuration(30);
    setServiceBuffer(10);
    setServicePrice(50);
    setShowServiceModal(true);
  };

  const openEditServiceModal = (s: Service) => {
    setEditingServiceId(s.id);
    setServiceName(s.name);
    setServiceDesc(s.description);
    setServiceDuration(s.durationMinutes);
    setServiceBuffer(s.bufferMinutes);
    setServicePrice(s.price);
    setShowServiceModal(true);
  };

  const closeServiceModal = () => setShowServiceModal(false);

  const handleServiceSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingServiceId) {
        const updated = await updateService(editingServiceId, {
          name: serviceName,
          description: serviceDesc,
          durationMinutes: serviceDuration,
          bufferMinutes: serviceBuffer,
          price: servicePrice
        });
        setServices(prev => prev.map(s => s.id === editingServiceId ? updated : s));
        showFlashSuccess("Serviço atualizado com sucesso!");
      } else {
        const created = await createService({
          providerId: provider.id,
          name: serviceName,
          description: serviceDesc,
          durationMinutes: serviceDuration,
          bufferMinutes: serviceBuffer,
          price: servicePrice
        });
        setServices(prev => [...prev, created]);
        showFlashSuccess("Serviço adicionado com sucesso!");
      }
      setShowServiceModal(false);
    } catch (err) {
      console.error(err);
      setError("Erro ao salvar o serviço.");
    }
  };

  const handleServiceDelete = async (serviceId: string) => {
    if (!confirm("Tem certeza que deseja excluir este serviço?")) return;
    try {
      await deleteService(serviceId);
      setServices(prev => prev.filter(s => s.id !== serviceId));
      showFlashSuccess("Serviço excluído com sucesso!");
    } catch (err) {
      console.error(err);
      setError("Erro ao excluir o serviço.");
    }
  };

  // 3. Save Availability Rules
  const handleSaveRules = async () => {
    const rulesToPayload = Object.entries(workingDays)
      .filter(([_, value]) => (value as any).active)
      .map(([day, value]) => {
        const val = value as any;
        return {
          providerId: provider.id,
          dayOfWeek: Number(day),
          startTime: val.start,
          endTime: val.end
        };
      });

    try {
      const saved = await updateAvailabilityRules(provider.id, rulesToPayload);
      setRules(saved);
      showFlashSuccess("Regras de horário semanal salvas com sucesso!");
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar os horários de funcionamento.");
    }
  };

  // 4. Create Availability Exception
  const handleAddException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptDate) return;
    
    try {
      const data = {
        providerId: provider.id,
        date: exceptDate,
        isBlocked: exceptBlocked,
        startTime: exceptBlocked ? undefined : exceptStart,
        endTime: exceptBlocked ? undefined : exceptEnd
      };

      const created = await createException(data);
      setExceptions(prev => [...prev.filter(e => e.date !== exceptDate), created]);
      setExceptDate("");
      showFlashSuccess("Exceção adicionada com sucesso!");
    } catch (err) {
      console.error(err);
      setError("Erro ao salvar a exceção de disponibilidade.");
    }
  };

  const handleRemoveException = async (id: string) => {
    try {
      await deleteException(id);
      setExceptions(prev => prev.filter(e => e.id !== id));
      showFlashSuccess("Exceção removida!");
    } catch (err) {
      console.error(err);
      setError("Erro ao remover exceção.");
    }
  };

  // --- ANALYTICS CALCULATIONS ---
  const activeBookings = bookings.filter(b => b.status !== "cancelled");
  const totalRevenue = activeBookings.reduce((sum, b) => {
    const s = services.find(serv => serv.id === b.serviceId);
    return sum + (s ? s.price : 0);
  }, 0);

  // Group revenue by service for BarChart
  const revenueByServiceData = services.map(s => {
    const serviceBks = activeBookings.filter(b => b.serviceId === s.id);
    const rev = serviceBks.reduce((sum, b) => sum + s.price, 0);
    return {
      name: s.name.substring(0, 15) + (s.name.length > 15 ? "..." : ""),
      "Faturamento (R$)": rev,
      "Agendamentos": serviceBks.length
    };
  });

  // Group booking trend by day for AreaChart
  const bookingTrendMap: Record<string, { date: string, count: number, faturamento: number }> = {};
  
  // Initialize last 7 days including today
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
    bookingTrendMap[dateStr] = { date: label, count: 0, faturamento: 0 };
  }

  activeBookings.forEach(b => {
    const datePart = b.startsAt.substring(0, 10);
    if (bookingTrendMap[datePart]) {
      const s = services.find(serv => serv.id === b.serviceId);
      bookingTrendMap[datePart].count += 1;
      bookingTrendMap[datePart].faturamento += s ? s.price : 0;
    }
  });

  const bookingTrendData = Object.values(bookingTrendMap);

  // Filtered Bookings for the Bookings Tab
  const filteredBookings = bookings.filter(b => {
    const matchStatus = bookingFilterStatus === "all" || b.status === bookingFilterStatus;
    const matchSearch = 
      b.clientName.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.clientEmail.toLowerCase().includes(bookingSearch.toLowerCase()) ||
      b.clientPhone.includes(bookingSearch);
    return matchStatus && matchSearch;
  });

  // Sort bookings: active first, then chronological
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    // Sort completed/cancelled to the bottom, active future at the top
    if (a.status === "cancelled" && b.status !== "cancelled") return 1;
    if (b.status === "cancelled" && a.status !== "cancelled") return -1;
    return b.startsAt.localeCompare(a.startsAt);
  });

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p);
  };

  const getStatusBadge = (status: Booking["status"]) => {
    switch (status) {
      case "confirmed":
        return <Badge tone="success">Confirmado</Badge>;
      case "cancelled":
        return <Badge tone="danger">Cancelado</Badge>;
      case "completed":
        return <Badge tone="info">Concluído</Badge>;
      default:
        return <Badge tone="warning">Pendente</Badge>;
    }
  };

  // Convert weekday number to localized human day name
  const dayName = (dayNum: number) => {
    const names = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    return names[dayNum];
  };

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center p-20 min-h-[400px]">
        <Spinner size="xl" tone="accent" />
        <p className="text-sm text-gray-500 mt-4 font-semibold">Carregando painel de controle...</p>
      </div>
    );
  }

  return (
    <div
      id="provider-dashboard-root"
      className={`${cardClasses({ radius: "2xl", tone: "white", border: "default", elevation: "2xl", padding: "none" })} w-full overflow-hidden text-slate-800 flex flex-col md:flex-row min-h-[650px]`}
    >
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 bg-gray-50 p-6 border-b md:border-b-0 md:border-r border-gray-200 shrink-0 space-y-6">
        {/* Profile Card — o nome de exibicao se edita aqui mesmo, no lapis. */}
        <div className="border-b border-gray-200 pb-4">
          {editingName ? (
            <form onSubmit={handleInlineNameSave} className="space-y-2">
              <Input
                id="provider-name-inline"
                size="sm"
                type="text"
                value={inlineName}
                onChange={(e) => setInlineName(e.target.value)}
                aria-label="Nome de exibição do prestador"
                placeholder="Nome de exibição"
                autoFocus
              />
              <div className="flex items-center gap-1.5">
                <Button
                  type="submit"
                  size="none"
                  loading={inlineNameSaving}
                  className="px-3 py-1.5 rounded-lg text-2xs"
                >
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="none"
                  onClick={() => {
                    setInlineName(provider.name || "");
                    setEditingName(false);
                    setError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-2xs text-gray-500"
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--tenant-accent)] text-white font-bold flex items-center justify-center text-base shrink-0">
                {provider.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-sm text-slate-900 truncate">{provider.name}</h4>
                <p className="text-3xs text-gray-500 truncate">{provider.email}</p>
              </div>
              <IconButton
                variant="ghost"
                size="md"
                label="Editar nome de exibição"
                title="Editar nome de exibição"
                onClick={() => {
                  setInlineName(provider.name || "");
                  setEditingName(true);
                }}
                className="shrink-0"
              >
                <Edit2 className="w-4 h-4" />
              </IconButton>
            </div>
          )}
        </div>

        {/* Tab Buttons */}
        <nav aria-label="Seções do painel" className="-mx-6 px-6 md:mx-0 md:px-0 flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <Button
            variant="none"
            size="none"
            onClick={() => setActiveTab("overview")}
            aria-current={activeTab === "overview" ? "page" : undefined}
            className={`min-h-11 px-4 py-2.5 rounded-xl text-xs font-semibold gap-2.5 justify-start text-left md:w-full whitespace-nowrap shrink-0 ${
              activeTab === "overview"
                ? "bg-[var(--tenant-accent)] text-white shadow-md"
                : "text-gray-500 hover:text-slate-900 hover:bg-gray-100"
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            Visão Geral / Gráficos
          </Button>

          <Button
            variant="none"
            size="none"
            onClick={() => setActiveTab("bookings")}
            aria-current={activeTab === "bookings" ? "page" : undefined}
            className={`min-h-11 px-4 py-2.5 rounded-xl text-xs font-semibold gap-2.5 justify-start text-left md:w-full whitespace-nowrap shrink-0 ${
              activeTab === "bookings"
                ? "bg-[var(--tenant-accent)] text-white shadow-md"
                : "text-gray-500 hover:text-slate-900 hover:bg-gray-100"
            }`}
          >
            <CalendarCheck className="w-4 h-4 shrink-0" />
            Agendamentos ({bookings.length})
          </Button>

          <Button
            variant="none"
            size="none"
            onClick={() => setActiveTab("services")}
            aria-current={activeTab === "services" ? "page" : undefined}
            className={`min-h-11 px-4 py-2.5 rounded-xl text-xs font-semibold gap-2.5 justify-start text-left md:w-full whitespace-nowrap shrink-0 ${
              activeTab === "services"
                ? "bg-[var(--tenant-accent)] text-white shadow-md"
                : "text-gray-500 hover:text-slate-900 hover:bg-gray-100"
            }`}
          >
            <Clock3 className="w-4 h-4 shrink-0" />
            Meus Serviços ({services.length})
          </Button>

          <Button
            variant="none"
            size="none"
            onClick={() => setActiveTab("availability")}
            aria-current={activeTab === "availability" ? "page" : undefined}
            className={`min-h-11 px-4 py-2.5 rounded-xl text-xs font-semibold gap-2.5 justify-start text-left md:w-full whitespace-nowrap shrink-0 ${
              activeTab === "availability"
                ? "bg-[var(--tenant-accent)] text-white shadow-md"
                : "text-gray-500 hover:text-slate-900 hover:bg-gray-100"
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            Agenda & Bloqueios
          </Button>

          <Button
            variant="none"
            size="none"
            onClick={() => setActiveTab("settings")}
            aria-current={activeTab === "settings" ? "page" : undefined}
            className={`min-h-11 px-4 py-2.5 rounded-xl text-xs font-semibold gap-2.5 justify-start text-left md:w-full whitespace-nowrap shrink-0 ${
              activeTab === "settings"
                ? "bg-[var(--tenant-accent)] text-white shadow-md"
                : "text-gray-500 hover:text-slate-900 hover:bg-gray-100"
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Configurações
          </Button>
        </nav>
      </div>

      {/* Main Panel Area. `min-w-0` é obrigatório: como item de flex, o painel
          tem `min-width: auto` e não encolhe abaixo do próprio conteúdo. Sem
          isso ele ficava preso em ~592px (o bloco do link público tem URL
          `nowrap` e botões que não encolhem) e, entre 768px e ~940px de
          viewport, o cartão era cortado pela borda do painel, que é
          `overflow-hidden`. */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 bg-gray-50">
        {/* Flash Notifications */}
        {successMsg && (
          <Alert variant="success" icon={CheckCircle}>
            {successMsg}
          </Alert>
        )}
        {error && (
          <Alert variant="error" icon={AlertTriangle}>
            {error}
          </Alert>
        )}

        {/* ========================================= TAB: OVERVIEW ========================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Dashboard do Prestador</h1>
                <p className="text-xs text-gray-500 mt-0.5">Visão unificada de seus atendimentos, faturamento e desempenho comercial.</p>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card elevation="none" padding="md" className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-medium">Faturamento Estimado</span>
                  <DollarSign className="w-5 h-5 text-[var(--tenant-accent)]" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 font-mono">{formatPrice(totalRevenue)}</h3>
                <p className="text-3xs text-gray-500">Soma dos agendamentos confirmados/concluídos</p>
              </Card>

              <Card elevation="none" padding="md" className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-medium">Total de Agendamentos</span>
                  <Users className="w-5 h-5 text-[var(--tenant-accent)]" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 font-mono">{activeBookings.length}</h3>
                <p className="text-3xs text-gray-500">Volume de clientes agendados ativos</p>
              </Card>

              <Card elevation="none" padding="md" className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-medium">Serviços Oferecidos</span>
                  <Clock3 className="w-5 h-5 text-[var(--tenant-accent)]" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 font-mono">{services.length}</h3>
                <p className="text-3xs text-gray-500">Quantidade de modalidades criadas</p>
              </Card>
            </div>

            {/* Recharts Graphs Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Service revenue distribution */}
              <Card padding="lg" elevation="none" className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Faturamento por Categoria</h4>
                {revenueByServiceData.length === 0 ? (
                  <EmptyState size="xs" bordered={false}>Crie serviços para popular o gráfico.</EmptyState>
                ) : (
                  <div className="h-64 text-2xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueByServiceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis dataKey="name" stroke={CHART_AXIS} />
                        <YAxis stroke={CHART_AXIS} />
                        <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: "#111827" }} />
                        <Bar dataKey="Faturamento (R$)" fill={palette.accent} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              {/* Faturamento Trend over 7 days */}
              <Card padding="lg" elevation="none" className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Agendamentos nos Últimos 7 Dias</h4>
                <div className="h-64 text-2xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bookingTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis dataKey="date" stroke={CHART_AXIS} />
                      <YAxis stroke={CHART_AXIS} />
                      <Tooltip contentStyle={CHART_TOOLTIP} labelStyle={{ color: "#111827" }} />
                      <Area type="monotone" dataKey="Faturamento (R$)" stroke={palette.accent} fill={palette.accent} fillOpacity={0.1} />
                      <Area type="monotone" dataKey="Agendamentos" stroke={CHART_SERIES_SECONDARY} fill={CHART_SERIES_SECONDARY} fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Quick Upcoming Appointments List */}
            <Card padding="lg" elevation="none" className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Agendamentos Próximos</h4>
              {activeBookings.length === 0 ? (
                <EmptyState size="xs" bordered={false}>Nenhum agendamento ativo registrado.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {activeBookings.slice(0, 3).map(b => {
                    const serv = services.find(s => s.id === b.serviceId);
                    const bDate = new Date(b.startsAt);
                    return (
                      <div key={b.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <span className="font-bold text-slate-900 text-sm">{b.clientName}</span>
                          <div className="flex flex-wrap items-center gap-3 text-gray-500">
                            <span>📱 {b.clientPhone}</span>
                            <span>📧 {b.clientEmail}</span>
                          </div>
                          {b.clientAddress && (
                            <p className="text-3xs text-blue-600 font-medium">📍 {b.clientAddress}</p>
                          )}
                          {b.notes && <p className="text-3xs text-gray-500 italic">Obs: "{b.notes}"</p>}
                        </div>
                        <div className="flex sm:flex-col items-baseline sm:items-end justify-between shrink-0">
                          <span className="text-[var(--tenant-accent)] font-bold font-mono text-xs">
                            {bDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {b.startsAt.substring(11, 16)}
                          </span>
                          <span className="text-gray-500 font-medium">{serv?.name} ({formatPrice(serv?.price || 0)})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ========================================= TAB: BOOKINGS ========================================= */}
        {activeTab === "bookings" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Controle de Agendamentos</h1>
              <p className="text-xs text-gray-500 mt-0.5">Gerencie os status das reservas e filtre a base de dados.</p>
            </div>

            {/* Search and Filters Bar */}
            <Card padding="sm" radius="xl" elevation="none" className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="w-full sm:max-w-xs">
                <Input
                  icon={Search}
                  type="text"
                  size="sm"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Buscar cliente, email..."
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end text-xs">
                <span className="text-gray-500">Filtrar por:</span>
                <Select
                  value={bookingFilterStatus}
                  onChange={(e) => setBookingFilterStatus(e.target.value)}
                  className="w-full sm:w-auto"
                >
                  <option value="all">Todos</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="completed">Concluído</option>
                </Select>
              </div>
            </Card>

            {/* Bookings Table/Cards */}
            {sortedBookings.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<FileText className="w-12 h-12 text-gray-300 mb-2" />}
              >
                <p className="text-sm text-gray-500 font-medium">Nenhum agendamento encontrado.</p>
                <p className="text-xs text-gray-500 mt-1">Experimente remover os filtros de busca.</p>
              </EmptyState>
            ) : (
              <div className="space-y-4">
                {sortedBookings.map(b => {
                  const serv = services.find(s => s.id === b.serviceId);
                  const bDate = new Date(b.startsAt);
                  const isPast = bDate.getTime() < Date.now();
                  
                  return (
                    <div
                      key={b.id}
                      className={`p-5 rounded-2xl border bg-white flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all hover:border-gray-300 ${
                        b.status === "cancelled"
                          ? "border-gray-100 opacity-60"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-base">{b.clientName}</span>
                          {getStatusBadge(b.status)}
                          <Badge tone="neutral">ID: {b.id.replace("booking-", "")}</Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-500">
                          <div>📧 {b.clientEmail}</div>
                          <div>📱 {b.clientPhone}</div>
                          <div>💅 {serv?.name || "Serviço excluído"}</div>
                        </div>

                        {b.clientAddress ? (
                          <div className="p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-blue-700 text-xs flex items-center gap-1.5">
                            <span>🚗 <strong>Atendimento no Cliente:</strong> {b.clientAddress}</span>
                          </div>
                        ) : (
                          <div className="text-3xs text-gray-500 flex items-center gap-1">
                            <span>🏢 Atendimento no estabelecimento</span>
                          </div>
                        )}

                        {b.notes && (
                          <div className="p-2.5 bg-gray-50 rounded-lg text-gray-500 text-3xs italic border-l-2 border-gray-300">
                            " {b.notes} "
                          </div>
                        )}
                      </div>

                      {/* Scheduling Date and Action Controls */}
                      <div className="flex flex-col items-end gap-3 justify-center shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-gray-200">
                        <div className="text-right">
                          <p className="text-[var(--tenant-accent)] font-extrabold font-mono text-sm">
                            {bDate.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
                          </p>
                          <p className="text-xs font-bold text-slate-900 font-mono mt-0.5">
                            ⏰ {b.startsAt.substring(11, 16)} às {b.endsAt.substring(11, 16)} 
                            <span className="text-3xs text-gray-500 font-normal ml-1">
                              (+{serv?.bufferMinutes}m buffer)
                            </span>
                          </p>
                        </div>

                        {/* Actions buttons */}
                        {b.status === "confirmed" && (
                          <div className="flex items-center gap-1.5 w-full md:w-auto">
                            <Button
                              variant="none"
                              size="none"
                              onClick={() => handleStatusChange(b.id, "completed")}
                              className="px-3 py-1.5 bg-[var(--tenant-accent)] hover:bg-[var(--tenant-accent-strong)] text-white rounded-lg text-3xs gap-1 flex-1 md:flex-none"
                              title="Marcar como atendido"
                              leftIcon={<Check className="w-3.5 h-3.5" />}
                            >
                              Concluir
                            </Button>
                            <Button
                              variant="none"
                              size="none"
                              onClick={() => handleStatusChange(b.id, "cancelled")}
                              className="px-3 py-1.5 bg-white hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-lg text-3xs gap-1 border border-gray-200 flex-1 md:flex-none"
                              title="Cancelar agendamento"
                              leftIcon={<XCircle className="w-3.5 h-3.5" />}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                        {b.status === "cancelled" && (
                          <Button
                            variant="none"
                            size="none"
                            onClick={() => handleStatusChange(b.id, "confirmed")}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-3xs border border-gray-200"
                          >
                            Reativar
                          </Button>
                        )}
                        {b.status === "completed" && (
                          <span className="text-3xs text-gray-500 italic flex items-center gap-1">
                            <Check className="w-3 h-3 text-green-600" /> Atendimento Concluído
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================= TAB: SERVICES ========================================= */}
        {activeTab === "services" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Meus Serviços</h1>
                <p className="text-xs text-gray-500 mt-0.5">Defina os tipos de atendimentos, preços e tempos de duração e preparação.</p>
              </div>
              <Button
                size="none"
                onClick={openNewServiceModal}
                className="px-3.5 py-2 rounded-xl text-xs gap-1.5"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Novo Serviço
              </Button>
            </div>

            {/* List Services */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map(s => (
                <Card key={s.id} elevation="none" padding="md" className="flex flex-col justify-between gap-4 transition-all hover:border-gray-300">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-bold text-slate-900 text-base leading-snug">{s.name}</h3>
                      <span className="text-[var(--tenant-accent)] font-extrabold font-mono text-sm whitespace-nowrap">{formatPrice(s.price)}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{s.description}</p>
                    
                    <div className="flex items-center gap-4 text-3xs text-gray-500 font-semibold pt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5" /> {s.durationMinutes} minutos de serviço
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock3 className="w-3.5 h-3.5" /> {s.bufferMinutes}m de buffer pós-serviço
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 border-t border-gray-100 pt-3">
                    <IconButton
                      variant="ghost"
                      size="md"
                      label="Editar serviço"
                      title="Editar serviço"
                      onClick={() => openEditServiceModal(s)}
                      className="hover:text-slate-900"
                    >
                      <Edit2 className="w-4 h-4" />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      size="md"
                      label="Excluir serviço"
                      title="Excluir serviço"
                      onClick={() => handleServiceDelete(s.id)}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  </div>
                </Card>
              ))}
            </div>

            {/* Service Modal Form */}
            <Modal
              open={showServiceModal}
              onClose={closeServiceModal}
              size="md"
              labelledBy="service-modal-title"
            >
              <div className="border-b border-gray-100 pb-4">
                <h3 id="service-modal-title" className="font-bold text-slate-900 text-base">
                  {editingServiceId ? "Editar Serviço" : "Novo Serviço"}
                </h3>
              </div>

              <form onSubmit={handleServiceSave} className="space-y-4">
                <Field label="Nome do Serviço *" htmlFor="service-name">
                  <Input
                    id="service-name"
                    type="text"
                    required
                    size="sm"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="Ex: Corte Degradê com Navalha"
                  />
                </Field>

                <Field label="Descrição" htmlFor="service-desc">
                  <Textarea
                    id="service-desc"
                    rows={2}
                    value={serviceDesc}
                    onChange={(e) => setServiceDesc(e.target.value)}
                    placeholder="Descreva o que está incluso no serviço"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Duração (min) *" htmlFor="service-duration">
                    <Input
                      id="service-duration"
                      type="number"
                      required
                      size="sm"
                      min={10}
                      max={360}
                      value={serviceDuration}
                      onChange={(e) => setServiceDuration(Number(e.target.value))}
                      className="font-mono"
                    />
                  </Field>

                  <Field label="Buffer (minutos)" htmlFor="service-buffer">
                    <Input
                      id="service-buffer"
                      type="number"
                      required
                      size="sm"
                      min={0}
                      max={60}
                      value={serviceBuffer}
                      onChange={(e) => setServiceBuffer(Number(e.target.value))}
                      className="font-mono"
                    />
                  </Field>
                </div>

                <Field label="Preço (R$) *" htmlFor="service-price">
                  <Input
                    id="service-price"
                    type="number"
                    required
                    size="sm"
                    min={0}
                    value={servicePrice}
                    onChange={(e) => setServicePrice(Number(e.target.value))}
                    className="font-mono"
                  />
                </Field>

                <div className="flex gap-2 justify-end pt-4 border-t border-gray-100">
                  <Button variant="secondary" size="sm" type="button" onClick={closeServiceModal}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm">
                    Salvar Serviço
                  </Button>
                </div>
              </form>
            </Modal>
          </div>
        )}

        {/* ========================================= TAB: AVAILABILITY ========================================= */}
        {activeTab === "availability" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Configurar Horários e Disponibilidade</h1>
              <p className="text-xs text-gray-500 mt-0.5">Gerencie os horários recorrentes de atendimento e cadastre bloqueios ou folgas especiais.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Weekly Rules Grid (7 cols) */}
              <Card padding="lg" elevation="none" className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--tenant-accent)]" /> Horário Semanal Recorrente
                  </h3>
                  <Button
                    size="none"
                    onClick={handleSaveRules}
                    className="px-3 py-1.5 rounded-lg text-xs gap-1"
                    leftIcon={<Save className="w-3.5 h-3.5" />}
                  >
                    Salvar Grade
                  </Button>
                </div>

                <div className="space-y-4 pt-1">
                  {[0, 1, 2, 3, 4, 5, 6].map(d => {
                    const dayVal = workingDays[d];
                    return (
                      <div key={d} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={dayVal.active}
                            onChange={(e) => setWorkingDays(prev => ({
                              ...prev,
                              [d]: { ...prev[d], active: e.target.checked }
                            }))}
                            className="rounded bg-white border-gray-300 text-[var(--tenant-accent)] focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                          />
                          <span className={`font-bold ${dayVal.active ? "text-slate-900" : "text-gray-500"}`}>{dayName(d)}</span>
                        </div>

                        {dayVal.active ? (
                          <div className="flex items-center gap-2 font-mono">
                            <div className="w-20">
                              <Input
                                type="text"
                                size="xs"
                                surface="plain"
                                value={dayVal.start}
                                onChange={(e) => setWorkingDays(prev => ({
                                  ...prev,
                                  [d]: { ...prev[d], start: e.target.value }
                                }))}
                                placeholder="09:00"
                                className="text-center"
                              />
                            </div>
                            <span className="text-gray-500">às</span>
                            <div className="w-20">
                              <Input
                                type="text"
                                size="xs"
                                surface="plain"
                                value={dayVal.end}
                                onChange={(e) => setWorkingDays(prev => ({
                                  ...prev,
                                  [d]: { ...prev[d], end: e.target.value }
                                }))}
                                placeholder="18:00"
                                className="text-center"
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500 font-semibold italic flex items-center gap-1">
                            <CalendarOff className="w-3.5 h-3.5" /> Fechado / Sem Expediente
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Exceptions and Blocked Days Panel (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Add Exception Form */}
                <Card padding="lg" elevation="none" className="space-y-4">
                  <h3 className="font-bold text-slate-900 text-sm border-b border-gray-100 pb-2 flex items-center gap-2">
                    <CalendarOff className="w-4 h-4 text-[var(--tenant-accent)]" /> Cadastrar Bloqueio / Folga
                  </h3>

                  <form onSubmit={handleAddException} className="space-y-4">
                    <Field label="Escolha a Data *" htmlFor="except-date">
                      <Input
                        id="except-date"
                        type="date"
                        required
                        size="sm"
                        value={exceptDate}
                        onChange={(e) => setExceptDate(e.target.value)}
                        className="font-mono"
                      />
                    </Field>

                    <div className="flex items-center gap-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={exceptBlocked}
                        onChange={(e) => setExceptBlocked(e.target.checked)}
                        className="rounded bg-white border-gray-300 text-[var(--tenant-accent)] focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-bold text-slate-700">Bloquear o dia inteiro?</span>
                    </div>

                    {!exceptBlocked && (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Horário Início" htmlFor="except-start">
                          <Input
                            id="except-start"
                            type="text"
                            size="sm"
                            value={exceptStart}
                            onChange={(e) => setExceptStart(e.target.value)}
                            placeholder="08:00"
                            className="text-center font-mono"
                          />
                        </Field>
                        <Field label="Horário Fim" htmlFor="except-end">
                          <Input
                            id="except-end"
                            type="text"
                            size="sm"
                            value={exceptEnd}
                            onChange={(e) => setExceptEnd(e.target.value)}
                            placeholder="14:00"
                            className="text-center font-mono"
                          />
                        </Field>
                      </div>
                    )}

                    <Button
                      type="submit"
                      fullWidth
                      size="none"
                      disabled={!exceptDate}
                      className="py-2 rounded-lg text-xs gap-1"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                    >
                      Adicionar Bloqueio
                    </Button>
                  </form>
                </Card>

                {/* Exceptions List */}
                <Card padding="lg" elevation="none" className="space-y-4">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">Bloqueios Cadastrados</h3>
                  {exceptions.length === 0 ? (
                    <p className="text-3xs text-gray-500 py-3 italic">Nenhuma exceção ou bloqueio ativo.</p>
                  ) : (
                    <div className="space-y-2">
                      {exceptions.map(e => {
                        const dateObj = new Date(`${e.date}T00:00:00`);
                        return (
                          <div key={e.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-slate-900">
                                {dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                              </span>
                              <p className="text-3xs text-gray-500 font-medium">
                                {e.isBlocked ? (
                                  <span className="text-red-600 font-semibold">Dia todo bloqueado</span>
                                ) : (
                                  <span>Trabalha: {e.startTime} às {e.endTime}</span>
                                )}
                              </p>
                            </div>
                            <IconButton
                              variant="ghost"
                              size="sm"
                              label="Remover bloqueio"
                              title="Remover bloqueio"
                              onClick={() => handleRemoveException(e.id)}
                              className="hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </IconButton>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

              </div>
            </div>
          </div>
        )}

        {/* ========================================= TAB: SETTINGS ========================================= */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-[var(--tenant-accent)]" />
                  Configurações da Conta & Estabelecimento
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Atualize suas credenciais de login, senha, link de divulgação e modalidade de atendimento.
                </p>
              </div>
            </div>

            {settingsError && (
              <Alert variant="error" icon={AlertTriangle}>
                {settingsError}
              </Alert>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-6">
              
              {/* Card 1: Perfil & Apresentação */}
              <Card padding="lg" elevation="none" className="space-y-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <UserCheck className="w-4 h-4 text-[var(--tenant-accent)]" />
                  <h3 className="font-bold text-slate-900 text-sm">Perfil & Apresentação Profissional</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Nome do Profissional / Estúdio *" variant="default" htmlFor="settings-name">
                    <Input
                      id="settings-name"
                      type="text"
                      required
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      placeholder="Ex: Juliana Sobrancelhas"
                    />
                  </Field>

                  <Field label="Ícone ou Emoji de Avatar" variant="default" htmlFor="settings-avatar">
                    <Input
                      id="settings-avatar"
                      type="text"
                      value={settingsAvatarUrl}
                      onChange={(e) => setSettingsAvatarUrl(e.target.value)}
                      placeholder="Ex: 💅, ✂️, 💄 ou URL da imagem"
                    />
                  </Field>

                  <Field
                    label="Biografia / Apresentação de Especialidades"
                    variant="default"
                    className="md:col-span-2" htmlFor="settings-bio">
                    <Textarea
                      id="settings-bio"
                      rows={3}
                      value={settingsBio}
                      onChange={(e) => setSettingsBio(e.target.value)}
                      placeholder="Descreva suas especialidades, cursos e diferenciais para seus clientes..."
                    />
                  </Field>
                </div>

                {/* Modalidade de Atendimento */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <span className="font-bold text-gray-700 text-xs block">
                    Onde você atende seus clientes? (Modalidade de Atendimento)
                  </span>
                  {/* `lg:grid-cols-3` (e não `sm:`): entre 768px e 1023px o
                      painel tem só ~446–640px de largura e três colunas viram
                      caixas de ~116px, com o texto quebrando em 3–4 linhas.
                      Abaixo de lg os botões empilham em largura cheia. */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <Button
                      variant="none"
                      size="none"
                      type="button"
                      onClick={() => setSettingsLocationType("own_space")}
                      className={`p-3 rounded-xl justify-start flex-col items-start text-left ${
                        settingsLocationType === "own_space"
                          ? "border bg-[var(--tenant-accent-soft)] border-[var(--tenant-accent)] text-[var(--tenant-accent-strong)] font-bold shadow-sm"
                          : "border bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-slate-700"
                      }`}
                    >
                      <span className="text-sm font-extrabold flex items-center gap-1.5">
                        🏢 Espaço Próprio
                      </span>
                      <span className="text-2xs text-gray-600 mt-1 font-normal">
                        Atendimento apenas no seu estúdio/salão
                      </span>
                    </Button>

                    <Button
                      variant="none"
                      size="none"
                      type="button"
                      onClick={() => setSettingsLocationType("at_client")}
                      className={`p-3 rounded-xl justify-start flex-col items-start text-left ${
                        settingsLocationType === "at_client"
                          ? "border bg-[var(--tenant-accent-soft)] border-[var(--tenant-accent)] text-[var(--tenant-accent-strong)] font-bold shadow-sm"
                          : "border bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-slate-700"
                      }`}
                    >
                      <span className="text-sm font-extrabold flex items-center gap-1.5">
                        🚗 A Domicílio
                      </span>
                      <span className="text-2xs text-gray-600 mt-1 font-normal">
                        Atendimento exclusivo no endereço do cliente
                      </span>
                    </Button>

                    <Button
                      variant="none"
                      size="none"
                      type="button"
                      onClick={() => setSettingsLocationType("both")}
                      className={`p-3 rounded-xl justify-start flex-col items-start text-left ${
                        settingsLocationType === "both"
                          ? "border bg-[var(--tenant-accent-soft)] border-[var(--tenant-accent)] text-[var(--tenant-accent-strong)] font-bold shadow-sm"
                          : "border bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-slate-700"
                      }`}
                    >
                      <span className="text-sm font-extrabold flex items-center gap-1.5">
                        🔄 Ambos
                      </span>
                      <span className="text-2xs text-gray-600 mt-1 font-normal">
                        O cliente escolhe no agendamento
                      </span>
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Card 2: Estabelecimento (nome e descricao publicos) */}
              {tenant && (
                <Card padding="lg" elevation="none" className="space-y-5">
                  <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                    <Store className="w-4 h-4 text-[var(--tenant-accent)]" />
                    <h3 className="font-bold text-slate-900 text-sm">Estabelecimento</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Nome do Estabelecimento *" variant="default" htmlFor="settings-tenant-name">
                      <Input
                        id="settings-tenant-name"
                        type="text"
                        required
                        value={settingsTenantName}
                        onChange={(e) => setSettingsTenantName(e.target.value)}
                        placeholder="Ex: Studio Aurora"
                      />
                    </Field>

                    <Field label="Descrição do Estabelecimento" variant="default" htmlFor="settings-tenant-desc">
                      <Textarea
                        id="settings-tenant-desc"
                        rows={2}
                        value={settingsTenantDesc}
                        onChange={(e) => setSettingsTenantDesc(e.target.value)}
                        placeholder="Como o estabelecimento se apresenta para quem chega pelo link..."
                      />
                    </Field>
                  </div>

                  <p className="text-3xs text-gray-500">
                    É este o nome anunciado na barra superior e no link público do estabelecimento.
                  </p>
                </Card>
              )}

              {/* Card 3: Credenciais & Segurança (Login e Senha) */}
              <Card padding="lg" elevation="none" className="space-y-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Lock className="w-4 h-4 text-[var(--tenant-accent)]" />
                  <h3 className="font-bold text-slate-900 text-sm">Acesso & Segurança da Conta (Login / Senha)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="E-mail de Login *" variant="default" htmlFor="settings-email">
                    <Input
                      id="settings-email"
                      icon={Mail}
                      type="email"
                      required
                      value={settingsEmail}
                      onChange={(e) => setSettingsEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                    />
                  </Field>

                  <Field label="Nova Senha (deixe em branco para manter)" variant="default" htmlFor="settings-password">
                    <Input
                      id="settings-password"
                      icon={Key}
                      type="password"
                      value={settingsPassword}
                      onChange={(e) => setSettingsPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </Field>

                  <Field label="Confirmar Nova Senha" variant="default" htmlFor="settings-confirm-password">
                    <Input
                      id="settings-confirm-password"
                      icon={Key}
                      type="password"
                      value={settingsConfirmPassword}
                      onChange={(e) => setSettingsConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                    />
                  </Field>
                </div>
              </Card>

              {/* Card 3: Link e URL Personalizada */}
              <Card padding="lg" elevation="none" className="space-y-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Globe className="w-4 h-4 text-[var(--tenant-accent)]" />
                  <h3 className="font-bold text-slate-900 text-sm">Link de Agendamento & Divulgação (URL)</h3>
                </div>

                <div className="space-y-4">
                  <Field label="URL / Slug Personalizado do Portal" variant="default" htmlFor="settings-slug">
                    <div className="flex items-center gap-2">
                      <span className="bg-gray-50 text-gray-500 px-3 py-2.5 rounded-xl border border-gray-200 font-mono text-xs select-none shrink-0">
                        agendeai.app.br/
                      </span>
                      <Input
                        id="settings-slug"
                        type="text"
                        value={settingsSlug}
                        onChange={(e) => setSettingsSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        placeholder="meu-estudio"
                        className="flex-1 min-w-0 font-mono"
                      />
                    </div>
                  </Field>

                  {/* Share Preview Banner. `flex-wrap` importa: com a URL em
                      `nowrap` e os botões sem encolher, o bloco precisa de
                      ~470px. Em vez de espremer o texto numa coluna de poucos
                      pixels quando o painel é estreito (janela de 768–940px),
                      os botões descem para a linha de baixo. */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-wrap flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0 grow">
                      <span className="text-2xs font-bold text-[var(--tenant-accent)] uppercase tracking-wider block">
                        Link público para seus clientes agendarem
                      </span>
                      <p className="text-xs text-slate-700 font-mono truncate">
                        {window.location.origin}/{settingsSlug || tenant?.slug || "agendar"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="none"
                        size="none"
                        type="button"
                        onClick={() => {
                          const link = `${window.location.origin}/${settingsSlug || tenant?.slug || ""}`;
                          navigator.clipboard.writeText(link);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2500);
                        }}
                        className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-slate-700 rounded-lg text-xs gap-1.5"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-600" />
                            <span className="text-green-600">Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Link</span>
                          </>
                        )}
                      </Button>

                      <a
                        href={`/${settingsSlug || tenant?.slug || ""}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--tenant-accent)] hover:bg-[var(--tenant-accent-strong)] text-white text-xs font-bold transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir Portal</span>
                      </a>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Botão de Salvar Alterações */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="submit"
                  size="lg"
                  loading={settingsSaving}
                  leftIcon={<Save className="w-4 h-4" />}
                >
                  Salvar Todas as Configurações
                </Button>
              </div>

            </form>
          </div>
        )}
      </div>

    </div>
  );
}

