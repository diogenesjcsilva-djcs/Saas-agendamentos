/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Tenant, 
  Provider, 
  Service, 
  TimeSlot, 
  Booking,
  Category 
} from "../types";
import { 
  getProviders, 
  getServices, 
  getSlots, 
  createBooking,
  getMyBookings,
  updateBookingStatus,
  rescheduleBooking,
  getCategories
} from "../lib/api.js";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Mail, 
  Lock,
  Phone, 
  CheckCircle, 
  ArrowLeft, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Scissors,
  CalendarDays,
  FileText
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ClientPortalProps {
  tenant: Tenant;
  currentUser?: any;
  // Auth state & handlers passed from App.tsx
  authMode: "login" | "register";
  setAuthMode: (mode: "login" | "register") => void;
  authEmail: string;
  setAuthEmail: (email: string) => void;
  authPassword: string;
  setAuthPassword: (password: string) => void;
  authName: string;
  setAuthName: (name: string) => void;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  authLoading: boolean;
  setAuthLoading: (loading: boolean) => void;
  handleLogin: (e: React.FormEvent) => Promise<void>;
  handleRegister: (
    e: React.FormEvent,
    role?: string,
    tenantId?: string,
    categoryId?: string,
    bio?: string
  ) => Promise<void>;
  setSocialAuthOpen: (provider: "google" | "instagram" | null) => void;
}

const getServiceIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes("corte") || lower.includes("cabelo") || lower.includes("barba") || lower.includes("aparar") || lower.includes("penteado")) {
    return "✂️";
  }
  if (lower.includes("facial") || lower.includes("pele") || lower.includes("limpeza") || lower.includes("estética") || lower.includes("laser") || lower.includes("peeling")) {
    return "✨";
  }
  if (lower.includes("massagem") || lower.includes("corporal") || lower.includes("relaxante") || lower.includes("drenagem") || lower.includes("spa")) {
    return "💆‍♀️";
  }
  if (lower.includes("unha") || lower.includes("manicure") || lower.includes("pedicure") || lower.includes("esmalte")) {
    return "💅";
  }
  if (lower.includes("maquiagem") || lower.includes("makeup") || lower.includes("sobrancelha") || lower.includes("cílios")) {
    return "💄";
  }
  return "🗓️";
};

export default function ClientPortal({ 
  tenant, 
  currentUser,
  authMode,
  setAuthMode,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authName,
  setAuthName,
  authError,
  setAuthError,
  authLoading,
  setAuthLoading,
  handleLogin,
  handleRegister,
  setSocialAuthOpen
}: ClientPortalProps) {
  // Categories and professional register states
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [registerRole, setRegisterRole] = useState<"client" | "provider">("client");
  const [registerCategoryId, setRegisterCategoryId] = useState<string>("");
  const [registerBio, setRegisterBio] = useState<string>("");

  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<"new" | "my">("new");
  
  // Selection States
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(""); // YYYY-MM-DD
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  
  // Slots State
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState<boolean>(false);
  
  // Form States
  const [clientName, setClientName] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  
  // Flow/Status States
  const [step, setStep] = useState<number>(1); // 1: Service, 2: Provider, 3: Date/Time, 4: Client Info, 5: Success
  const [bookingLoading, setBookingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successBooking, setSuccessBooking] = useState<Booking | null>(null);

  // My Bookings State
  const [myBookings, setMyBookings] = useState<any[]>([]);
  const [myBookingsLoading, setMyBookingsLoading] = useState<boolean>(false);

  // Rescheduling state
  const [reschedulingBooking, setReschedulingBooking] = useState<any | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState<boolean>(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<TimeSlot | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  // Month navigation for custom calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [rescheduleMonth, setRescheduleMonth] = useState<Date>(new Date());

  // Auto-fill client form fields if logged in
  useEffect(() => {
    if (currentUser && currentUser.role === "client") {
      setClientName(currentUser.name || "");
      setClientEmail(currentUser.email || "");
    } else {
      setClientName("");
      setClientEmail("");
    }
  }, [currentUser]);

  // Fetch initial services, providers, and categories for this tenant
  useEffect(() => {
    async function loadData() {
      try {
        const provs = await getProviders(tenant.id);
        setProviders(provs);
        
        const servs = await getServices();
        setServices(servs);

        const cats = await getCategories();
        setCategories(cats);
        if (cats.length > 0) {
          setRegisterCategoryId(cats[0].id);
        }
      } catch (err) {
        console.error("Error loading portal data", err);
        setError("Não foi possível carregar as informações do agendamento.");
      }
    }
    loadData();
    
    // Reset selection if tenant changes
    setSelectedCategory(null);
    setSelectedService(null);
    setSelectedProvider(null);
    setSelectedDate("");
    setSelectedSlot(null);
    setStep(1);
    setError(null);
    setActiveTab("new");
  }, [tenant]);

  // Filter categories that have registered providers in this tenant
  const activeCategories = categories.filter(cat => 
    providers.some(p => p.categoryId === cat.id)
  );

  // Filter providers in the selected category
  const filteredProviders = providers.filter(p => 
    selectedCategory ? p.categoryId === selectedCategory.id : true
  );

  // Filter services offered by the selected provider
  const filteredServices = services.filter(s => 
    selectedProvider ? s.providerId === selectedProvider.id : true
  );

  // Load slots when service and date are selected
  useEffect(() => {
    if (selectedService && selectedDate) {
      async function loadSlots() {
        setSlotsLoading(true);
        setError(null);
        try {
          const availableSlots = await getSlots(selectedService!.id, selectedDate);
          setSlots(availableSlots);
        } catch (err) {
          console.error("Error fetching slots:", err);
          setError("Erro ao buscar horários disponíveis para esta data.");
        } finally {
          setSlotsLoading(false);
        }
      }
      loadSlots();
    } else {
      setSlots([]);
    }
  }, [selectedService, selectedDate]);

  // Load reschedule slots
  useEffect(() => {
    if (reschedulingBooking && rescheduleDate) {
      async function loadReschedSlots() {
        setRescheduleSlotsLoading(true);
        setRescheduleError(null);
        try {
          const availableSlots = await getSlots(reschedulingBooking.serviceId, rescheduleDate);
          setRescheduleSlots(availableSlots);
        } catch (err) {
          console.error("Error fetching reschedule slots:", err);
          setRescheduleError("Erro ao buscar horários disponíveis.");
        } finally {
          setRescheduleSlotsLoading(false);
        }
      }
      loadReschedSlots();
    } else {
      setRescheduleSlots([]);
    }
  }, [reschedulingBooking, rescheduleDate]);

  // Fetch client bookings
  const fetchBookings = async () => {
    setMyBookingsLoading(true);
    try {
      const data = await getMyBookings();
      setMyBookings(data);
    } catch (err) {
      console.error("Error fetching client bookings:", err);
      setError("Erro ao obter lista de agendamentos.");
    } finally {
      setMyBookingsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "my" && currentUser) {
      fetchBookings();
    }
  }, [activeTab, currentUser]);

  // Custom Calendar helpers
  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleReschedulePrevMonth = () => {
    setRescheduleMonth(new Date(rescheduleMonth.getFullYear(), rescheduleMonth.getMonth() - 1, 1));
  };

  const handleRescheduleNextMonth = () => {
    setRescheduleMonth(new Date(rescheduleMonth.getFullYear(), rescheduleMonth.getMonth() + 1, 1));
  };

  const selectDateHandler = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = (currentMonth.getMonth() + 1).toString().padStart(2, "0");
    const dayStr = day.toString().padStart(2, "0");
    const dateStr = `${year}-${month}-${dayStr}`;
    
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateStr < todayStr) return;

    setSelectedDate(dateStr);
    setSelectedSlot(null);
  };

  const selectRescheduleDateHandler = (day: number) => {
    const year = rescheduleMonth.getFullYear();
    const month = (rescheduleMonth.getMonth() + 1).toString().padStart(2, "0");
    const dayStr = day.toString().padStart(2, "0");
    const dateStr = `${year}-${month}-${dayStr}`;
    
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateStr < todayStr) return;

    setRescheduleDate(dateStr);
    setSelectedRescheduleSlot(null);
  };

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider || !selectedService || !selectedSlot || !clientName || !clientEmail || !clientPhone) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    setBookingLoading(true);
    setError(null);

    try {
      const b = await createBooking({
        providerId: selectedProvider.id,
        serviceId: selectedService.id,
        startsAt: selectedSlot.datetime,
        clientName,
        clientEmail,
        clientPhone,
        notes
      });
      setSuccessBooking(b);
      setStep(6);
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao realizar seu agendamento. Tente novamente.");
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm("Deseja realmente cancelar este agendamento?")) return;
    try {
      await updateBookingStatus(id, "cancelled");
      fetchBookings();
    } catch (err: any) {
      alert("Erro ao cancelar o agendamento: " + err.message);
    }
  };

  const handleRescheduleConfirm = async () => {
    if (!reschedulingBooking || !selectedRescheduleSlot) return;
    try {
      await rescheduleBooking(reschedulingBooking.id, selectedRescheduleSlot.datetime);
      setReschedulingBooking(null);
      setRescheduleDate("");
      setSelectedRescheduleSlot(null);
      fetchBookings();
      alert("Reagendamento confirmado com sucesso!");
    } catch (err: any) {
      setRescheduleError(err.message || "Erro ao reagendar.");
    }
  };

  // Color mappings
  const colorMap: Record<string, { bg: string, border: string, text: string, hover: string, accent: string }> = {
    indigo: {
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      text: "text-indigo-900",
      hover: "hover:bg-indigo-500 hover:text-white",
      accent: "indigo-600"
    },
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-900",
      hover: "hover:bg-emerald-500 hover:text-white",
      accent: "emerald-600"
    },
    rose: {
      bg: "bg-rose-50",
      border: "border-rose-200",
      text: "text-rose-900",
      hover: "hover:bg-rose-500 hover:text-white",
      accent: "rose-600"
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-900",
      hover: "hover:bg-amber-500 hover:text-white",
      accent: "amber-600"
    }
  };

  const currentTheme = colorMap[tenant.themeColor] || colorMap.indigo;

  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p);
  };

  const formatDateHuman = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  };

  const onRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleRegister(
      e,
      registerRole,
      tenant.id,
      registerRole === "provider" ? registerCategoryId : undefined,
      registerRole === "provider" ? registerBio : undefined
    );
  };

  if (!currentUser) {
    return (
      <div id="client-portal-root" className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">


        {/* Auth Required Screen */}
        <div className="p-8 md:p-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">Faça login para agendar</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Para garantir uma experiência segura, rápida e possibilitar o reagendamento ou cancelamento online, solicitamos o login antes de escolher os serviços.
              </p>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-700">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center font-bold">⚡</span>
                <span>Agendamento rápido em menos de 1 minuto</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center font-bold">🔄</span>
                <span>Reagende ou cancele de forma 100% online</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center font-bold">🔔</span>
                <span>Histórico completo de visitas no seu portal</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 bg-white border border-gray-150 rounded-2xl p-6 md:p-8 shadow-sm space-y-5">
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-slate-900 text-base">
                {authMode === "login" ? "Entrar na sua Conta" : "Criar sua Conta"}
              </h3>
              <p className="text-4xs text-gray-500">
                {authMode === "login" 
                  ? "Entre para ver seus agendamentos e agendar mais rápido." 
                  : "Cadastre-se para acompanhar seu histórico de reservas."
                }
              </p>
            </div>

            <form onSubmit={authMode === "login" ? handleLogin : onRegisterSubmit} className="space-y-3.5">
              {authError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
                  {authError}
                </div>
              )}

              {authMode === "register" && (
                <>
                  {/* Account Type Selection */}
                  <div className="space-y-1">
                    <label className="text-4xs font-bold text-gray-400 uppercase tracking-wider block font-semibold">Tipo de Conta</label>
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setRegisterRole("client")}
                        className={`py-1.5 rounded-lg text-3xs font-bold transition-all ${
                          registerRole === "client"
                            ? "bg-white text-indigo-650 shadow-sm border border-gray-150"
                            : "text-gray-400 hover:text-gray-650"
                        }`}
                      >
                        Sou Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => setRegisterRole("provider")}
                        className={`py-1.5 rounded-lg text-3xs font-bold transition-all ${
                          registerRole === "provider"
                            ? "bg-white text-indigo-650 shadow-sm border border-gray-150"
                            : "text-gray-400 hover:text-gray-650"
                        }`}
                      >
                        Sou Profissional
                      </button>
                    </div>
                  </div>

                  {/* Name field */}
                  <div className="space-y-1">
                    <label className="text-4xs font-bold text-gray-400 uppercase tracking-wider">Nome Completo</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        required
                        value={authName}
                        onChange={(e) => setAuthName(e.target.value)}
                        placeholder={registerRole === "provider" ? "Nome do Profissional" : "Seu nome"}
                        className="w-full bg-gray-50 border border-gray-200 pl-9 pr-4 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold"
                      />
                    </div>
                  </div>

                  {/* Provider custom fields */}
                  {registerRole === "provider" && (
                    <>
                      <div className="space-y-1">
                        <label className="text-4xs font-bold text-gray-400 uppercase tracking-wider">Especialidade / Categoria</label>
                        <select
                          value={registerCategoryId}
                          onChange={(e) => setRegisterCategoryId(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold cursor-pointer"
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.imageUrl} {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-4xs font-bold text-gray-400 uppercase tracking-wider">Biografia / Apresentação</label>
                        <textarea
                          value={registerBio}
                          onChange={(e) => setRegisterBio(e.target.value)}
                          placeholder="Fale um pouco sobre sua experiência e serviços..."
                          rows={2}
                          className="w-full bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold resize-none"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="space-y-1">
                <label className="text-4xs font-bold text-gray-400 uppercase tracking-wider">E-mail</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="seuemail@provedor.com"
                    className="w-full bg-gray-50 border border-gray-200 pl-9 pr-4 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-4xs font-bold text-gray-400 uppercase tracking-wider">Senha</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-50 border border-gray-200 pl-9 pr-4 py-2 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition-all font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors flex items-center justify-center gap-2 shadow-indigo-600/10"
              >
                {authLoading ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>{authMode === "login" ? "Entrar" : "Criar Conta"}</>
                )}
              </button>
            </form>

            {/* Social Dividers & Intuitive Buttons */}
            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-gray-150 w-full"></div>
              <span className="absolute bg-white px-2 text-5xs text-gray-400 font-bold uppercase tracking-wider">ou</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSocialAuthOpen("google")}
                className="py-2 bg-white hover:bg-gray-50 border border-gray-250 text-gray-700 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.57h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48C21.68,11.75 21.56,11.4 21.35,11.1z" fill="#4285F4" />
                  <path d="M12,20.62c2.6,0 4.78,-0.86 6.37,-2.33l-3.3,-2.57c-0.91,0.61 -2.07,0.98 -3.07,0.98 -2.37,0 -4.38,-1.6 -5.1,-3.75H3.5v2.66C5.09,18.88 8.35,20.62 12,20.62z" fill="#34A853" />
                  <path d="M6.9,13.06c-0.18,-0.54 -0.28,-1.11 -0.28,-1.7s0.1,-1.16 0.28,-1.7V7H3.5c-0.6,1.19 -0.94,2.53 -0.94,3.96S2.9,13.7 3.5,14.88L6.9,13.06z" fill="#FBBC05" />
                  <path d="M12,6.08c1.41,0 2.69,0.49 3.69,1.44l2.76,-2.76C16.78,3.2 14.6,2.38 12,2.38c-3.65,0 -6.91,1.74 -8.5,4.62l3.4,2.66C7.62,7.68 9.63,6.08 12,6.08z" fill="#EA4335" />
                </svg>
                Google
              </button>

              <button
                type="button"
                onClick={() => setSocialAuthOpen("instagram")}
                className="py-2 bg-gradient-to-r from-purple-600 via-pink-500 to-yellow-500 hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
                Instagram
              </button>
            </div>

            <div className="text-center text-xs border-t border-gray-100 pt-3">
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="client-portal-root" className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">


      {/* Tabs Switcher for Authenticated Clients */}
      {currentUser && currentUser.role === "client" && (
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          <button
            onClick={() => setActiveTab("new")}
            className={`flex-1 py-4 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === "new"
                ? `border-${currentTheme.accent} text-${currentTheme.accent} bg-white`
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Novo Agendamento
          </button>
          <button
            onClick={() => setActiveTab("my")}
            className={`flex-1 py-4 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === "my"
                ? `border-${currentTheme.accent} text-${currentTheme.accent} bg-white`
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <FileText className="w-4 h-4" />
            Meus Agendamentos
          </button>
        </div>
      )}

      {/* Progress Steps Indicator */}
      {activeTab === "new" && step < 6 && (
        <div className="px-8 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between text-xs font-medium text-gray-400">
          <div className="flex items-center gap-4 w-full justify-center md:justify-start flex-wrap">
            <span className={`pb-1 ${step === 1 ? `text-${currentTheme.accent} border-b-2 border-${currentTheme.accent}` : "text-gray-900 font-semibold"}`}>
              1. Categoria
            </span>
            <span className="text-gray-300">/</span>
            <span className={`pb-1 ${step === 2 ? `text-${currentTheme.accent} border-b-2 border-${currentTheme.accent}` : step > 2 ? "text-gray-900 font-semibold" : ""}`}>
              2. Profissional
            </span>
            <span className="text-gray-300">/</span>
            <span className={`pb-1 ${step === 3 ? `text-${currentTheme.accent} border-b-2 border-${currentTheme.accent}` : step > 3 ? "text-gray-900 font-semibold" : ""}`}>
              3. Serviço
            </span>
            <span className="text-gray-300">/</span>
            <span className={`pb-1 ${step === 4 ? `text-${currentTheme.accent} border-b-2 border-${currentTheme.accent}` : step > 4 ? "text-gray-900 font-semibold" : ""}`}>
              4. Data e Hora
            </span>
            <span className="text-gray-300">/</span>
            <span className={`pb-1 ${step === 5 ? `text-${currentTheme.accent} border-b-2 border-${currentTheme.accent}` : ""}`}>
              5. Seus Dados
            </span>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "new" ? (
            <div key="tab-new">
              {/* STEP 1: SELECT CATEGORY */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Escolha a categoria do serviço</h2>
                    <p className="text-sm text-gray-500 mt-1">Selecione uma especialidade abaixo para listar os profissionais disponíveis.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeCategories.map(cat => {
                      const isSelected = selectedCategory?.id === cat.id;
                      return (
                        <div
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setStep(2);
                          }}
                          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 items-start ${
                            isSelected 
                              ? `border-${currentTheme.accent} ${currentTheme.bg} shadow-md` 
                              : "border-gray-100 hover:border-gray-200 hover:shadow-sm hover:translate-y-[-2px]"
                          }`}
                        >
                          <span className="text-3xl p-3 bg-gray-50 rounded-xl border border-gray-100 shrink-0 select-none shadow-sm">
                            {cat.imageUrl || "🗓️"}
                          </span>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <h3 className="font-bold text-slate-900 text-sm leading-snug truncate mt-2">{cat.name}</h3>
                            <p className="text-xs text-gray-400">Clique para ver profissionais nesta categoria</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* STEP 2: SELECT PROVIDER */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setSelectedCategory(null);
                        setStep(1);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Escolha o Profissional</h2>
                      <p className="text-sm text-gray-500 mt-0.5">Profissionais em <strong className="text-gray-700">{selectedCategory?.name}</strong>.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredProviders.map(provider => {
                      const isSelected = selectedProvider?.id === provider.id;
                      return (
                        <div
                          key={provider.id}
                          onClick={() => {
                            setSelectedProvider(provider);
                            setStep(3);
                          }}
                          className={`p-5 rounded-xl border-2 transition-all cursor-pointer flex gap-4 items-start ${
                            isSelected 
                              ? `border-${currentTheme.accent} ${currentTheme.bg} shadow-md` 
                              : "border-gray-100 hover:border-gray-200 hover:shadow-sm"
                          }`}
                        >
                          {provider.avatarUrl ? (
                            <img 
                              src={provider.avatarUrl} 
                              alt={provider.name} 
                              className="w-12 h-12 rounded-xl border border-gray-200 object-cover shrink-0" 
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-lg border border-gray-200 shrink-0 font-sans">
                              {provider.name.charAt(0)}
                            </div>
                          )}
                          <div className="space-y-1">
                            <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                            <p className="text-xs text-gray-405">{provider.email}</p>
                            <p className="text-xs text-gray-500 leading-relaxed mt-1 line-clamp-3">{provider.bio}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* STEP 3: SELECT SERVICE */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setSelectedProvider(null);
                        setStep(2);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Escolha o Serviço</h2>
                      <p className="text-sm text-gray-500 mt-0.5">Serviços oferecidos por <strong className="text-gray-700">{selectedProvider?.name}</strong>.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredServices.map(service => {
                      const isSelected = selectedService?.id === service.id;
                      const icon = getServiceIcon(service.name);
                      
                      return (
                        <div
                          key={service.id}
                          onClick={() => {
                            setSelectedService(service);
                            setStep(4);
                          }}
                          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 items-start ${
                            isSelected 
                              ? `border-${currentTheme.accent} ${currentTheme.bg} shadow-md` 
                              : "border-gray-100 hover:border-gray-200 hover:shadow-sm hover:translate-y-[-2px]"
                          }`}
                        >
                          <span className="text-3xl p-3 bg-gray-50 rounded-xl border border-gray-100 shrink-0 select-none shadow-sm">
                            {icon}
                          </span>
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">{service.name}</h3>
                              <span className="text-5xs bg-gray-100 text-gray-605 px-2 py-0.5 rounded-full font-mono font-bold shrink-0">
                                {service.durationMinutes} min
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{service.description}</p>
                            <div className="flex justify-between items-center pt-2">
                              <div></div>
                              <span className={`text-xs font-extrabold font-mono text-${currentTheme.accent}`}>
                                {formatPrice(service.price)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* STEP 4: SELECT DATE & TIME */}
              {step === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setSelectedService(null);
                        setStep(3);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Selecione Data e Horário</h2>
                      <p className="text-sm text-gray-500 mt-0.5">Disponibilidades para <strong className="text-gray-700">{selectedService?.name}</strong> com <strong className="text-gray-700">{selectedProvider?.name}</strong>.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Calendar Card */}
                    <div className="lg:col-span-7 bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">
                          {currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                        </h3>
                        <div className="flex gap-1.5">
                          <button
                            onClick={handlePrevMonth}
                            className="p-1.5 hover:bg-gray-100 rounded-lg border border-gray-150 text-gray-600 transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleNextMonth}
                            className="p-1.5 hover:bg-gray-100 rounded-lg border border-gray-150 text-gray-600 transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-gray-50">
                        <span>Dom</span>
                        <span>Seg</span>
                        <span>Ter</span>
                        <span>Qua</span>
                        <span>Qui</span>
                        <span>Sex</span>
                        <span>Sáb</span>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center">
                        {Array.from({ length: firstDayOfMonth(currentMonth) }).map((_, i) => (
                          <div key={`empty-${i}`} className="aspect-square"></div>
                        ))}
                        
                        {Array.from({ length: daysInMonth(currentMonth) }).map((_, i) => {
                          const day = i + 1;
                          const year = currentMonth.getFullYear();
                          const month = (currentMonth.getMonth() + 1).toString().padStart(2, "0");
                          const dayStr = day.toString().padStart(2, "0");
                          const dateStr = `${year}-${month}-${dayStr}`;
                          const isSelected = selectedDate === dateStr;
                          
                          const todayStr = new Date().toISOString().split("T")[0];
                          const isPast = dateStr < todayStr;
                          const isWeekend = new Date(year, currentMonth.getMonth(), day).getDay() === 0;

                          return (
                            <button
                              key={`day-${day}`}
                              disabled={isPast}
                              onClick={() => selectDateHandler(day)}
                              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                                isPast 
                                  ? "text-gray-250 cursor-not-allowed" 
                                  : isSelected
                                    ? `bg-${currentTheme.accent} text-white shadow-md font-bold scale-105`
                                    : isWeekend
                                      ? "text-red-400 hover:bg-red-50/50"
                                      : "text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Time Slots Card */}
                    <div className="lg:col-span-5 bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col justify-start min-h-[300px]">
                      {slotsLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-400">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                          <p className="mt-3 text-xs">Buscando horários disponíveis...</p>
                        </div>
                      ) : !selectedDate ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-gray-400 space-y-2">
                          <CalendarIcon className="w-8 h-8 text-gray-300" />
                          <p className="text-xs font-semibold">Escolha uma data ao lado para listar os horários disponíveis.</p>
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-gray-400 space-y-2">
                          <AlertCircle className="w-8 h-8 text-yellow-500" />
                          <p className="text-xs font-semibold">Nenhum horário disponível para esta data.</p>
                        </div>
                      ) : (
                        <div className="space-y-4 flex-1 flex flex-col justify-between">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2 border-b border-gray-100 pb-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              Horários Disponíveis ({formatDateHuman(selectedDate)})
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                              {slots.map(slot => (
                                <button
                                  key={slot.time}
                                  disabled={!slot.available}
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold font-mono border transition-all ${
                                    !slot.available
                                      ? "bg-gray-50 border-gray-100 text-gray-350 cursor-not-allowed text-left flex flex-col"
                                      : selectedSlot?.time === slot.time
                                        ? `bg-${currentTheme.accent} border-${currentTheme.accent} text-white shadow-sm`
                                        : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                                  }`}
                                >
                                  <span>{slot.time}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {selectedSlot && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="pt-4 border-t border-gray-100"
                            >
                              <button
                                onClick={() => setStep(5)}
                                className={`w-full py-3 px-4 bg-${currentTheme.accent} hover:bg-opacity-95 text-white rounded-xl font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2`}
                              >
                                Prosseguir com Agendamento
                              </button>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: CLIENT INFO FORM */}
              {step === 5 && (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setSelectedSlot(null);
                        setStep(4);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Preencha seus dados</h2>
                      <p className="text-sm text-gray-500 mt-0.5">Insira suas informações para finalizar a reserva.</p>
                    </div>
                  </div>

                  <form onSubmit={handleBookingSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-7 space-y-4">
                      <div className="space-y-1.5">
                        <label htmlFor="client-name" className="text-xs font-semibold text-gray-700 block">Nome Completo</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            id="client-name"
                            type="text"
                            disabled
                            value={clientName}
                            className="w-full py-2.5 pl-10 pr-4 bg-gray-50 border border-gray-150 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label htmlFor="client-email" className="text-xs font-semibold text-gray-700 block">E-mail</label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              id="client-email"
                              type="email"
                              disabled
                              value={clientEmail}
                              className="w-full py-2.5 pl-10 pr-4 bg-gray-50 border border-gray-150 rounded-xl text-sm text-gray-500 font-semibold cursor-not-allowed"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label htmlFor="client-phone" className="text-xs font-semibold text-gray-700 block">Celular / WhatsApp *</label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              id="client-phone"
                              type="tel"
                              required
                              value={clientPhone}
                              onChange={(e) => setClientPhone(e.target.value)}
                              placeholder="(11) 99999-9999"
                              className="w-full py-2.5 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-semibold"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="client-notes" className="text-xs font-semibold text-gray-700 block">Observações (Opcional)</label>
                        <textarea
                          id="client-notes"
                          rows={3}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Alguma recomendação especial?"
                          className="w-full py-2.5 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-semibold"
                        />
                      </div>
                    </div>

                    {/* Booking Summary Box */}
                    <div className="md:col-span-5 bg-gray-50 border border-gray-100 rounded-2xl p-6 self-start space-y-4">
                      <h3 className="font-bold text-gray-900 text-sm border-b border-gray-200 pb-2">Resumo da Reserva</h3>
                      
                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-gray-400">Serviço:</span>
                          <span className="text-gray-900 font-bold text-right">{selectedService?.name}</span>
                        </div>
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-gray-400">Profissional:</span>
                          <span className="text-gray-900 font-semibold text-right">{selectedProvider?.name}</span>
                        </div>
                        <div className="flex justify-between items-start gap-4 border-t border-gray-200 pt-2">
                          <span className="text-gray-400">Horário:</span>
                          <span className={`text-${currentTheme.accent} font-extrabold font-mono text-right`}>
                            {formatDateHuman(selectedDate)} às {selectedSlot?.time}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline gap-4 border-t border-gray-200 pt-3">
                          <span className="text-sm font-bold text-gray-900 font-sans">Valor total:</span>
                          <span className={`text-lg font-extrabold font-mono text-${currentTheme.accent}`}>
                            {selectedService ? formatPrice(selectedService.price) : ""}
                          </span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={bookingLoading}
                        className={`w-full py-3 px-4 bg-${currentTheme.accent} hover:bg-opacity-95 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2`}
                      >
                        {bookingLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Processando agendamento...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            Confirmar Agendamento Agora
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}

              {/* STEP 6: SUCCESS MESSAGE */}
              {step === 6 && successBooking && (
                <motion.div
                  key="step-6"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12 px-4 max-w-lg mx-auto space-y-6"
                >
                  <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto border border-green-200 shadow-inner">
                    <CheckCircle className="w-10 h-10" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold text-gray-900">Agendamento Realizado!</h2>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Tudo certo, <strong>{clientName}</strong>! Seu horário está confirmado com sucesso e já está reservado na agenda de {selectedProvider?.name}.
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-left space-y-3 text-xs">
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="font-semibold text-gray-500 uppercase tracking-wider text-3xs">Código de Reserva</span>
                      <span className="font-mono font-bold text-gray-900">{successBooking.id}</span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <p className="text-gray-800">💅 Serviço: <strong className="text-gray-900">{selectedService?.name}</strong></p>
                      <p className="text-gray-800">👤 Profissional: <strong>{selectedProvider?.name}</strong></p>
                      <p className="text-gray-800">📅 Data: <strong>{formatDateHuman(selectedDate)}</strong></p>
                      <p className="text-gray-800">⏰ Horário: <strong className={`text-${currentTheme.accent} font-mono text-sm`}>{selectedSlot?.time}</strong></p>
                      <p className="text-gray-800">💰 Preço: <strong className="font-mono">{selectedService ? formatPrice(selectedService.price) : ""}</strong></p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedService(null);
                      setSelectedProvider(null);
                      setSelectedDate("");
                      setSelectedSlot(null);
                      setStep(1);
                      setError(null);
                    }}
                    className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-semibold text-xs transition-colors"
                  >
                    Fazer Outro Agendamento
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            // TAB MY BOOKINGS (CLIENT BOOKING HISTORY LIST)
            <div key="tab-my" className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Seus Agendamentos</h2>
                <p className="text-sm text-gray-500 mt-1">Veja seus horários reservados, reagende ou cancele os agendamentos abaixo.</p>
              </div>

              {myBookingsLoading ? (
                <div className="py-20 text-center">
                  <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${currentTheme.accent} mx-auto`}></div>
                  <p className="text-sm text-gray-500 mt-2 font-medium">Buscando seus agendamentos...</p>
                </div>
              ) : myBookings.length === 0 ? (
                <div className="border border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-400 space-y-3">
                  <CalendarIcon className="w-12 h-12 stroke-1 mx-auto" />
                  <p className="text-sm font-semibold">Você ainda não tem nenhum agendamento cadastrado.</p>
                  <button
                    onClick={() => setActiveTab("new")}
                    className={`px-4 py-2 bg-${currentTheme.accent} text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/5`}
                  >
                    Agendar agora
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {myBookings.map((booking) => {
                    const start = new Date(booking.startsAt);
                    const formattedDate = start.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
                    const formattedTime = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
                    
                    const isCancelled = booking.status === "cancelled";
                    const isCompleted = booking.status === "completed";
                    
                    return (
                      <div
                        key={booking.id}
                        className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isCancelled 
                            ? "bg-gray-50/50 border-gray-150 opacity-60" 
                            : "bg-white border-gray-100 shadow-sm"
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-sm">{booking.serviceName}</h3>
                            <span className={`text-4xs font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              isCancelled 
                                ? "bg-red-50 text-red-500 border border-red-100" 
                                : isCompleted 
                                  ? "bg-green-50 text-green-500 border border-green-100"
                                  : "bg-blue-50 text-blue-500 border border-blue-100"
                            }`}>
                              {booking.status === "confirmed" ? "confirmado" : booking.status}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500 space-y-0.5">
                            <p>👤 Profissional: <strong>{booking.providerName}</strong></p>
                            <p className="font-mono">📅 Horário: {formattedDate} às {formattedTime}</p>
                          </div>
                        </div>

                        {!isCancelled && !isCompleted && (
                          <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 shrink-0">
                            <button
                              onClick={() => {
                                setReschedulingBooking(booking);
                                setRescheduleMonth(new Date());
                                setRescheduleDate("");
                                setSelectedRescheduleSlot(null);
                              }}
                              className={`px-3 py-1.5 border border-${currentTheme.accent} text-${currentTheme.accent} hover:bg-${tenant.themeColor}-50 rounded-lg text-2xs font-bold transition-all`}
                            >
                              Reagendar
                            </button>
                            <button
                              onClick={() => handleCancel(booking.id)}
                              className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-2xs font-bold transition-all"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Reschedule Modal (Pop-up) */}
      <AnimatePresence>
        {reschedulingBooking && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-gray-100 shadow-2xl rounded-3xl p-8 max-w-2xl w-full space-y-6 relative"
            >
              <button
                onClick={() => {
                  setReschedulingBooking(null);
                  setRescheduleDate("");
                  setSelectedRescheduleSlot(null);
                }}
                className="absolute right-6 top-6 text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>

              <div>
                <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Reagendar Agendamento</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Selecione um novo horário para o serviço: <strong>{reschedulingBooking.serviceName}</strong>.
                </p>
              </div>

              {rescheduleError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
                  {rescheduleError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Custom calendar for reschedule */}
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 text-xs">
                      {rescheduleMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    </h4>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={handleReschedulePrevMonth}
                        className="p-1 hover:bg-gray-50 rounded text-gray-600 border border-gray-100"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={handleRescheduleNextMonth}
                        className="p-1 hover:bg-gray-50 rounded text-gray-600 border border-gray-100"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 text-center text-4xs font-bold text-gray-400">
                    <div>Dom</div>
                    <div>Seg</div>
                    <div>Ter</div>
                    <div>Qua</div>
                    <div>Qui</div>
                    <div>Sex</div>
                    <div>Sáb</div>
                  </div>

                  <div className="grid grid-cols-7 gap-0.5 text-center">
                    {Array.from({ length: firstDayOfMonth(rescheduleMonth) }).map((_, i) => (
                      <div key={`empty-res-${i}`} className="aspect-square"></div>
                    ))}
                    
                    {Array.from({ length: daysInMonth(rescheduleMonth) }).map((_, i) => {
                      const day = i + 1;
                      const year = rescheduleMonth.getFullYear();
                      const month = (rescheduleMonth.getMonth() + 1).toString().padStart(2, "0");
                      const dayStr = day.toString().padStart(2, "0");
                      const dateStr = `${year}-${month}-${dayStr}`;
                      const isSelected = rescheduleDate === dateStr;
                      
                      const todayStr = new Date().toISOString().split("T")[0];
                      const isPast = dateStr < todayStr;
                      const isWeekend = new Date(year, rescheduleMonth.getMonth(), day).getDay() === 0;

                      return (
                        <button
                          key={`resday-${day}`}
                          disabled={isPast}
                          onClick={() => selectRescheduleDateHandler(day)}
                          className={`aspect-square flex items-center justify-center rounded text-xs font-semibold ${
                            isPast 
                              ? "text-gray-100 cursor-not-allowed" 
                              : isSelected
                                ? `bg-${currentTheme.accent} text-white font-bold`
                                : isWeekend
                                  ? "text-red-400 hover:bg-red-50/50"
                                  : "text-gray-700 hover:bg-gray-150"
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Available Slots */}
                <div className="flex flex-col min-h-[220px]">
                  {!rescheduleDate ? (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl p-4 text-center text-gray-450 text-xs">
                      <CalendarIcon className="w-8 h-8 mb-2 stroke-1" />
                      <p>Escolha uma nova data.</p>
                    </div>
                  ) : rescheduleSlotsLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-${currentTheme.accent}`}></div>
                    </div>
                  ) : rescheduleSlots.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl p-4 text-center text-gray-450 text-xs">
                      <AlertCircle className="w-6 h-6 mb-1 stroke-1" />
                      <p>Nenhum horário disponível.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-gray-800 text-xs border-b border-gray-50 pb-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          Horários Disponíveis ({formatDateHuman(rescheduleDate)})
                        </h4>
                        <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
                          {rescheduleSlots.map(slot => (
                            <button
                              key={slot.time}
                              disabled={!slot.available}
                              onClick={() => setSelectedRescheduleSlot(slot)}
                              className={`py-2 rounded-lg text-xs font-semibold font-mono border transition-all ${
                                !slot.available
                                  ? "bg-gray-50 border-gray-105 text-gray-200 cursor-not-allowed"
                                  : selectedRescheduleSlot?.time === slot.time
                                    ? `bg-${currentTheme.accent} border-${currentTheme.accent} text-white shadow-sm`
                                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                              }`}
                            >
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 border-t border-gray-100 pt-4">
                <button
                  onClick={() => {
                    setReschedulingBooking(null);
                    setRescheduleDate("");
                    setSelectedRescheduleSlot(null);
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={!selectedRescheduleSlot}
                  onClick={handleRescheduleConfirm}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold text-white bg-${currentTheme.accent} hover:bg-opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-600/5`}
                >
                  Confirmar Reagendamento
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
