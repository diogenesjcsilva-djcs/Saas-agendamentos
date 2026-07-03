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
  AvailabilityException 
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
  updateBookingStatus 
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
  FileText
} from "lucide-react";
import { motion } from "motion/react";

interface ProviderDashboardProps {
  provider: Provider;
}

type TabType = "overview" | "bookings" | "services" | "availability";

export default function ProviderDashboard({ provider }: ProviderDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  
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

        // Map server availability rules to local workingDays state
        const updatedWorkingDays = {
          0: { active: false, start: "09:00", end: "18:00" },
          1: { active: false, start: "09:00", end: "18:00" },
          2: { active: false, start: "09:00", end: "18:00" },
          3: { active: false, start: "09:00", end: "18:00" },
          4: { active: false, start: "09:00", end: "18:00" },
          5: { active: false, start: "09:00", end: "18:00" },
          6: { active: false, start: "09:00", end: "18:00" },
        };
        
        rls.forEach(rule => {
          updatedWorkingDays[rule.dayOfWeek as keyof typeof updatedWorkingDays] = {
            active: true,
            start: rule.startTime,
            end: rule.endTime
          };
        });
        setWorkingDays(updatedWorkingDays);

      } catch (err) {
        console.error("Error loading dashboard data:", err);
        setError("Não foi possível carregar as informações do prestador.");
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
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">Confirmado</span>;
      case "cancelled":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">Cancelado</span>;
      case "completed":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Concluído</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 border border-yellow-200">Pendente</span>;
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-sm text-gray-500 mt-4 font-semibold">Carregando painel de controle...</p>
      </div>
    );
  }

  return (
    <div id="provider-dashboard-root" className="w-full bg-slate-900 rounded-2xl shadow-2xl border border-slate-800 overflow-hidden text-slate-100 flex flex-col md:flex-row min-h-[650px]">
      
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 bg-slate-950 p-6 border-b md:border-b-0 md:border-r border-slate-800 shrink-0 space-y-6">
        {/* Profile Card */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white font-bold flex items-center justify-center text-md border border-indigo-400">
            {provider.name.charAt(0)}
          </div>
          <div className="truncate">
            <h4 className="font-bold text-sm text-white">{provider.name}</h4>
            <p className="text-4xs text-slate-400 truncate">{provider.email}</p>
          </div>
        </div>

        {/* Tab Buttons */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all text-left w-full whitespace-nowrap shrink-0 ${
              activeTab === "overview" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            Visão Geral / Gráficos
          </button>

          <button
            onClick={() => setActiveTab("bookings")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all text-left w-full whitespace-nowrap shrink-0 ${
              activeTab === "bookings" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <CalendarCheck className="w-4 h-4 shrink-0" />
            Agendamentos ({bookings.length})
          </button>

          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all text-left w-full whitespace-nowrap shrink-0 ${
              activeTab === "services" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Clock3 className="w-4 h-4 shrink-0" />
            Meus Serviços ({services.length})
          </button>

          <button
            onClick={() => setActiveTab("availability")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all text-left w-full whitespace-nowrap shrink-0 ${
              activeTab === "availability" 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                : "text-slate-400 hover:text-white hover:bg-slate-900"
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            Agenda & Bloqueios
          </button>
        </nav>
      </div>

      {/* Main Panel Area */}
      <div className="flex-1 p-8 space-y-6 bg-slate-900/60 overflow-y-auto max-h-[800px]">
        {/* Flash Notifications */}
        {successMsg && (
          <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-xl text-indigo-200 text-xs font-medium flex items-center gap-2 shadow-lg animate-pulse">
            <CheckCircle className="w-4 h-4 text-indigo-400" />
            {successMsg}
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-200 text-xs font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            {error}
          </div>
        )}

        {/* ========================================= TAB: OVERVIEW ========================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Dashboard do Prestador</h2>
                <p className="text-xs text-slate-400 mt-0.5">Visão unificada de seus atendimentos, faturamento e desempenho comercial.</p>
              </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-medium">Faturamento Estimado</span>
                  <DollarSign className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-black text-white font-mono">{formatPrice(totalRevenue)}</h3>
                <p className="text-4xs text-slate-500">Soma dos agendamentos confirmados/concluídos</p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-medium">Total de Agendamentos</span>
                  <Users className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-black text-white font-mono">{activeBookings.length}</h3>
                <p className="text-4xs text-slate-500">Volume de clientes agendados ativos</p>
              </div>

              <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400 font-medium">Serviços Oferecidos</span>
                  <Clock3 className="w-5 h-5 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-black text-white font-mono">{services.length}</h3>
                <p className="text-4xs text-slate-500">Quantidade de modalidades criadas</p>
              </div>
            </div>

            {/* Recharts Graphs Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Service revenue distribution */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Faturamento por Categoria</h4>
                {revenueByServiceData.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-10">Crie serviços para popular o gráfico.</p>
                ) : (
                  <div className="h-64 text-2xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueByServiceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" />
                        <YAxis stroke="#64748b" />
                        <Tooltip contentStyle={{ backgroundColor: "#020617", border: "1px solid #334155" }} labelStyle={{ color: "#ffffff" }} />
                        <Bar dataKey="Faturamento (R$)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Faturamento Trend over 7 days */}
              <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Agendamentos nos Últimos 7 Dias</h4>
                <div className="h-64 text-2xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={bookingTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" />
                      <YAxis stroke="#64748b" />
                      <Tooltip contentStyle={{ backgroundColor: "#020617", border: "1px solid #334155" }} />
                      <Area type="monotone" dataKey="Faturamento (R$)" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.1} />
                      <Area type="monotone" dataKey="Agendamentos" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Quick Upcoming Appointments List */}
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Agendamentos Próximos</h4>
              {activeBookings.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Nenhum agendamento ativo registrado.</p>
              ) : (
                <div className="space-y-3">
                  {activeBookings.slice(0, 3).map(b => {
                    const serv = services.find(s => s.id === b.serviceId);
                    const bDate = new Date(b.startsAt);
                    return (
                      <div key={b.id} className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <span className="font-bold text-white text-sm">{b.clientName}</span>
                          <div className="flex flex-wrap items-center gap-3 text-slate-400">
                            <span>📱 {b.clientPhone}</span>
                            <span>📧 {b.clientEmail}</span>
                          </div>
                          {b.notes && <p className="text-4xs text-slate-500 italic">Obs: "{b.notes}"</p>}
                        </div>
                        <div className="flex sm:flex-col items-baseline sm:items-end justify-between shrink-0">
                          <span className="text-indigo-400 font-bold font-mono text-xs">
                            {bDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {b.startsAt.substring(11, 16)}
                          </span>
                          <span className="text-slate-400 font-medium">{serv?.name} ({formatPrice(serv?.price || 0)})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================= TAB: BOOKINGS ========================================= */}
        {activeTab === "bookings" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Controle de Agendamentos</h2>
              <p className="text-xs text-slate-400 mt-0.5">Gerencie os status das reservas e filtre a base de dados.</p>
            </div>

            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="relative w-full sm:max-w-xs">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Buscar cliente, email..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end text-xs">
                <span className="text-slate-500">Filtrar por:</span>
                <select
                  value={bookingFilterStatus}
                  onChange={(e) => setBookingFilterStatus(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-3 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">Todos</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="completed">Concluído</option>
                </select>
              </div>
            </div>

            {/* Bookings Table/Cards */}
            {sortedBookings.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-950">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400 font-medium">Nenhum agendamento encontrado.</p>
                <p className="text-xs text-slate-600 mt-1">Experimente remover os filtros de busca.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedBookings.map(b => {
                  const serv = services.find(s => s.id === b.serviceId);
                  const bDate = new Date(b.startsAt);
                  const isPast = bDate.getTime() < Date.now();
                  
                  return (
                    <div 
                      key={b.id} 
                      className={`p-5 rounded-2xl border bg-slate-950 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all hover:border-slate-700 ${
                        b.status === "cancelled" 
                          ? "border-slate-900 opacity-60" 
                          : "border-slate-800"
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-bold text-white text-base">{b.clientName}</span>
                          {getStatusBadge(b.status)}
                          <span className="text-3xs bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-mono">
                            ID: {b.id.replace("booking-", "")}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-400">
                          <div>📧 {b.clientEmail}</div>
                          <div>📱 {b.clientPhone}</div>
                          <div>💅 {serv?.name || "Serviço excluído"}</div>
                        </div>

                        {b.notes && (
                          <div className="p-2.5 bg-slate-900/50 rounded-lg text-slate-400 text-4xs italic border-l-2 border-slate-700">
                            " {b.notes} "
                          </div>
                        )}
                      </div>

                      {/* Scheduling Date and Action Controls */}
                      <div className="flex flex-col items-end gap-3 justify-center shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-slate-800">
                        <div className="text-right">
                          <p className="text-indigo-400 font-extrabold font-mono text-sm">
                            {bDate.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
                          </p>
                          <p className="text-xs font-bold text-white font-mono mt-0.5">
                            ⏰ {b.startsAt.substring(11, 16)} às {b.endsAt.substring(11, 16)} 
                            <span className="text-3xs text-slate-500 font-normal ml-1">
                              (+{serv?.bufferMinutes}m buffer)
                            </span>
                          </p>
                        </div>

                        {/* Actions buttons */}
                        {b.status === "confirmed" && (
                          <div className="flex items-center gap-1.5 w-full md:w-auto">
                            <button
                              onClick={() => handleStatusChange(b.id, "completed")}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-3xs font-bold flex items-center gap-1 transition-colors flex-1 md:flex-none justify-center"
                              title="Marcar como atendido"
                            >
                              <Check className="w-3.5 h-3.5" /> Concluir
                            </button>
                            <button
                              onClick={() => handleStatusChange(b.id, "cancelled")}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-red-950/40 hover:text-red-400 text-slate-300 rounded-lg text-3xs font-bold flex items-center gap-1 border border-slate-700 transition-all flex-1 md:flex-none justify-center"
                              title="Cancelar agendamento"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Cancelar
                            </button>
                          </div>
                        )}
                        {b.status === "cancelled" && (
                          <button
                            onClick={() => handleStatusChange(b.id, "confirmed")}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg text-3xs font-bold border border-slate-800 transition-colors"
                          >
                            Reativar
                          </button>
                        )}
                        {b.status === "completed" && (
                          <span className="text-4xs text-slate-500 italic flex items-center gap-1">
                            <Check className="w-3 h-3 text-green-500" /> Atendimento Concluído
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
                <h2 className="text-xl font-bold text-white">Meus Serviços</h2>
                <p className="text-xs text-slate-400 mt-0.5">Defina os tipos de atendimentos, preços e tempos de duração e preparação.</p>
              </div>
              <button
                onClick={openNewServiceModal}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/10 transition-all"
              >
                <Plus className="w-4 h-4" /> Novo Serviço
              </button>
            </div>

            {/* List Services */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map(s => (
                <div key={s.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:border-slate-700">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-bold text-white text-base leading-snug">{s.name}</h3>
                      <span className="text-indigo-400 font-extrabold font-mono text-sm whitespace-nowrap">{formatPrice(s.price)}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{s.description}</p>
                    
                    <div className="flex items-center gap-4 text-3xs text-slate-500 font-semibold pt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3.5 h-3.5" /> {s.durationMinutes} minutos de serviço
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock3 className="w-3.5 h-3.5" /> {s.bufferMinutes}m de buffer pós-serviço
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 border-t border-slate-900 pt-3">
                    <button
                      onClick={() => openEditServiceModal(s)}
                      className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-400 hover:text-white transition-colors"
                      title="Editar serviço"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleServiceDelete(s.id)}
                      className="p-1.5 hover:bg-red-950/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                      title="Excluir serviço"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Service Modal Form */}
            {showServiceModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-slate-100">
                  <div className="p-6 border-b border-slate-800">
                    <h3 className="font-bold text-white text-base">
                      {editingServiceId ? "Editar Serviço" : "Novo Serviço"}
                    </h3>
                  </div>

                  <form onSubmit={handleServiceSave} className="p-6 space-y-4">
                    <div className="space-y-1">
                      <label className="text-3xs uppercase tracking-wider font-semibold text-slate-400">Nome do Serviço *</label>
                      <input
                        type="text"
                        required
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        placeholder="Ex: Corte Degradê com Navalha"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-3xs uppercase tracking-wider font-semibold text-slate-400">Descrição</label>
                      <textarea
                        rows={2}
                        value={serviceDesc}
                        onChange={(e) => setServiceDesc(e.target.value)}
                        placeholder="Descreva o que está incluso no serviço"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-3xs uppercase tracking-wider font-semibold text-slate-400">Duração (min) *</label>
                        <input
                          type="number"
                          required
                          min={10}
                          max={360}
                          value={serviceDuration}
                          onChange={(e) => setServiceDuration(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-3xs uppercase tracking-wider font-semibold text-slate-400">Buffer (minutos)</label>
                        <input
                          type="number"
                          required
                          min={0}
                          max={60}
                          value={serviceBuffer}
                          onChange={(e) => setServiceBuffer(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-3xs uppercase tracking-wider font-semibold text-slate-400">Preço (R$) *</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={servicePrice}
                        onChange={(e) => setServicePrice(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowServiceModal(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
                      >
                        Salvar Serviço
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================= TAB: AVAILABILITY ========================================= */}
        {activeTab === "availability" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Configurar Horários e Disponibilidade</h2>
              <p className="text-xs text-slate-400 mt-0.5">Gerencie os horários recorrentes de atendimento e cadastre bloqueios ou folgas especiais.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Weekly Rules Grid (7 cols) */}
              <div className="lg:col-span-7 bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" /> Horário Semanal Recorrente
                  </h3>
                  <button
                    onClick={handleSaveRules}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all shadow-md"
                  >
                    <Save className="w-3.5 h-3.5" /> Salvar Grade
                  </button>
                </div>

                <div className="space-y-4 pt-1">
                  {[0, 1, 2, 3, 4, 5, 6].map(d => {
                    const dayVal = workingDays[d];
                    return (
                      <div key={d} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={dayVal.active}
                            onChange={(e) => setWorkingDays(prev => ({
                              ...prev,
                              [d]: { ...prev[d], active: e.target.checked }
                            }))}
                            className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                          />
                          <span className={`font-bold ${dayVal.active ? "text-white" : "text-slate-500"}`}>{dayName(d)}</span>
                        </div>

                        {dayVal.active ? (
                          <div className="flex items-center gap-2 font-mono">
                            <input
                              type="text"
                              value={dayVal.start}
                              onChange={(e) => setWorkingDays(prev => ({
                                ...prev,
                                [d]: { ...prev[d], start: e.target.value }
                              }))}
                              placeholder="09:00"
                              className="w-16 bg-slate-950 border border-slate-800 rounded-lg text-center py-1 text-white"
                            />
                            <span className="text-slate-600">às</span>
                            <input
                              type="text"
                              value={dayVal.end}
                              onChange={(e) => setWorkingDays(prev => ({
                                ...prev,
                                [d]: { ...prev[d], end: e.target.value }
                              }))}
                              placeholder="18:00"
                              className="w-16 bg-slate-950 border border-slate-800 rounded-lg text-center py-1 text-white"
                            />
                          </div>
                        ) : (
                          <span className="text-slate-500 font-semibold italic flex items-center gap-1">
                            <CalendarOff className="w-3.5 h-3.5" /> Fechado / Sem Expediente
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exceptions and Blocked Days Panel (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Add Exception Form */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h3 className="font-bold text-white text-sm border-b border-slate-800 pb-2 flex items-center gap-2">
                    <CalendarOff className="w-4 h-4 text-indigo-400" /> Cadastrar Bloqueio / Folga
                  </h3>

                  <form onSubmit={handleAddException} className="space-y-4 text-xs">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-400">Escolha a Data *</label>
                      <input
                        type="date"
                        required
                        value={exceptDate}
                        onChange={(e) => setExceptDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={exceptBlocked}
                        onChange={(e) => setExceptBlocked(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                      />
                      <span className="font-bold text-slate-300">Bloquear o dia inteiro?</span>
                    </div>

                    {!exceptBlocked && (
                      <div className="grid grid-cols-2 gap-3 font-mono">
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-400 font-sans">Horário Início</label>
                          <input
                            type="text"
                            value={exceptStart}
                            onChange={(e) => setExceptStart(e.target.value)}
                            placeholder="08:00"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 text-white text-center"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-semibold text-slate-400 font-sans">Horário Fim</label>
                          <input
                            type="text"
                            value={exceptEnd}
                            onChange={(e) => setExceptEnd(e.target.value)}
                            placeholder="14:00"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 text-white text-center"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!exceptDate}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-bold flex items-center justify-center gap-1 shadow-md transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar Bloqueio
                    </button>
                  </form>
                </div>

                {/* Exceptions List */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">Bloqueios Cadastrados</h3>
                  {exceptions.length === 0 ? (
                    <p className="text-4xs text-slate-600 py-3 italic">Nenhuma exceção ou bloqueio ativo.</p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {exceptions.map(e => {
                        const dateObj = new Date(`${e.date}T00:00:00`);
                        return (
                          <div key={e.id} className="p-3 bg-slate-900 rounded-xl border border-slate-850 flex items-center justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-white">
                                {dateObj.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                              </span>
                              <p className="text-4xs text-slate-500 font-medium">
                                {e.isBlocked ? (
                                  <span className="text-red-400 font-semibold">Dia todo bloqueado</span>
                                ) : (
                                  <span>Trabalha: {e.startTime} às {e.endTime}</span>
                                )}
                              </p>
                            </div>
                            <button
                              onClick={() => handleRemoveException(e.id)}
                              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                              title="Remover bloqueio"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
