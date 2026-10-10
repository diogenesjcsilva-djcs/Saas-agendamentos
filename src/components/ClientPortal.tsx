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
  CalendarDays,
  FileText,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Alert from "./ui/Alert.js";
import Badge from "./ui/Badge.js";
import Button from "./ui/Button.js";
import Card from "./ui/Card.js";
import EmptyState from "./ui/EmptyState.js";
import Field from "./ui/Field.js";
import IconButton from "./ui/IconButton.js";
import Input from "./ui/Input.js";
import Modal from "./ui/Modal.js";
import Select from "./ui/Select.js";
import Spinner from "./ui/Spinner.js";
import Textarea from "./ui/Textarea.js";

interface ClientPortalProps {
  tenant: Tenant;
  selectedProvider?: Provider | null;
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
  onNavigateHome?: () => void;
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
  selectedProvider: initialSelectedProvider,
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
  setSocialAuthOpen,
  onNavigateHome
}: ClientPortalProps) {
  // Invalid Provider / Service Link State
  const [invalidLinkError, setInvalidLinkError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(4);

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);

  const [registerRole, setRegisterRole] = useState<"client" | "provider">("client");
  const [registerCategoryId, setRegisterCategoryId] = useState<string>("");
  const [registerBio, setRegisterBio] = useState<string>("");

  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  // Tab State
  const [activeTab, setActiveTab] = useState<"new" | "my">("new");

  // Selection States
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(initialSelectedProvider || null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
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
  // 1: Service Selection (Filtered by Provider), 2: Date/Time Selection, 3: Client Info, 4: Success
  const [step, setStep] = useState<number>(1);
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

  // Sync initialSelectedProvider if updated from App.tsx
  useEffect(() => {
    if (initialSelectedProvider) {
      setSelectedProvider(initialSelectedProvider);
    }
  }, [initialSelectedProvider]);

  // Auto-redirect to home when link is invalid
  useEffect(() => {
    if (!invalidLinkError) return;

    setCountdown(4);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onNavigateHome) {
            onNavigateHome();
          } else {
            window.history.pushState(null, "", "/");
            window.location.href = "/";
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [invalidLinkError, onNavigateHome]);

  // Fetch initial services, providers, and categories for this tenant
  useEffect(() => {
    async function loadData() {
      try {
        const provs = await getProviders(tenant.id);
        setProviders(provs);

        const servs = await getServices(undefined, tenant.id);
        setServices(servs);

        const cats = await getCategories();
        setCategories(cats);
        if (cats.length > 0) {
          setRegisterCategoryId(cats[0].id);
        }

        // Determine default provider for Step 1
        const urlParams = new URLSearchParams(window.location.search);
        const directProviderId = urlParams.get("providerId") || urlParams.get("provider");
        let targetProv: Provider | null = null;

        if (directProviderId) {
          if (provs.length > 0) {
            targetProv = provs.find(p => p.id === directProviderId || p.name.toLowerCase().includes(directProviderId.toLowerCase())) || null;
          }
          // Direct provider requested: check if exists and has registered services
          if (!targetProv) {
            setInvalidLinkError("O link de prestador acessado é inválido ou não foi encontrado.");
            return;
          }
          const providerServices = servs.filter(s => s.providerId === targetProv!.id);
          if (providerServices.length === 0) {
            setInvalidLinkError(`O link informado para o prestador "${targetProv.name}" é inválido pois ele ainda não cadastrou nenhum serviço.`);
            return;
          }
        }

        if (!targetProv && initialSelectedProvider) {
          targetProv = initialSelectedProvider;
        }

        // If target provider has 0 services, check if another provider has services or if whole tenant is empty
        if (targetProv) {
          const targetProvServices = servs.filter(s => s.providerId === targetProv!.id);
          if (targetProvServices.length === 0) {
            const provWithServices = provs.find(p => servs.some(s => s.providerId === p.id));
            if (provWithServices) {
              targetProv = provWithServices;
            } else {
              setInvalidLinkError("Este estabelecimento ainda não possui nenhum serviço cadastrado para agendamento.");
              return;
            }
          }
        } else if (provs.length > 0) {
          const provWithServices = provs.find(p => servs.some(s => s.providerId === p.id));
          if (provWithServices) {
            targetProv = provWithServices;
          } else {
            setInvalidLinkError("Este estabelecimento ainda não possui nenhum serviço cadastrado para agendamento.");
            return;
          }
        } else {
          setInvalidLinkError("Nenhum profissional encontrado para este estabelecimento.");
          return;
        }

        if (targetProv) {
          setSelectedProvider(targetProv);
          setInvalidLinkError(null);
        }
      } catch (err) {
        console.error("Error loading portal data", err);
        setError("Não foi possível carregar as informações do agendamento.");
      }
    }
    loadData();

    // Reset selection if tenant changes
    setSelectedService(null);
    setSelectedDate("");
    setSelectedSlot(null);
    setStep(1);
    setError(null);
    setActiveTab("new");
  }, [tenant]);

  // Filter services STRICTLY for the selected provider & tenant
  const filteredServices = services.filter(s => {
    // 1) Must belong to a provider of this tenant
    const provider = providers.find(p => p.id === s.providerId);
    if (!provider) {
      return false;
    }

    // 2) Must match the selected provider if one is active
    if (selectedProvider && s.providerId !== selectedProvider.id) {
      return false;
    }

    return true;
  });

  // Select service and proceed to Step 2 (Data e Hora)
  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    // Ensure provider is assigned to match service
    const matchingProvider = providers.find(p => p.id === service.providerId) || selectedProvider;
    setSelectedProvider(matchingProvider);
    setStep(2);
  };

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

  // Format today's local date string in YYYY-MM-DD
  const getTodayLocalDateString = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, "0");
    const d = now.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const selectDateHandler = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = (currentMonth.getMonth() + 1).toString().padStart(2, "0");
    const dayStr = day.toString().padStart(2, "0");
    const dateStr = `${year}-${month}-${dayStr}`;

    const todayStr = getTodayLocalDateString();
    if (dateStr < todayStr) return;

    setSelectedDate(dateStr);
    setSelectedSlot(null);
  };

  const selectRescheduleDateHandler = (day: number) => {
    const year = rescheduleMonth.getFullYear();
    const month = (rescheduleMonth.getMonth() + 1).toString().padStart(2, "0");
    const dayStr = day.toString().padStart(2, "0");
    const dateStr = `${year}-${month}-${dayStr}`;

    const todayStr = getTodayLocalDateString();
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
      setStep(4); // Step 4 is Success / Confirmation
    } catch (err: any) {
      if (err.message === "slot_unavailable" || err.message.includes("já foi reservado")) {
        setError("O horário selecionado não está mais disponível. Por favor, volte ao passo de horários e escolha outra vaga.");
      } else {
        setError(err.message || "Ocorreu um erro ao realizar seu agendamento. Tente novamente.");
      }
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

  const closeReschedule = () => {
    setReschedulingBooking(null);
    setRescheduleDate("");
    setSelectedRescheduleSlot(null);
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

  if (invalidLinkError) {
    return (
      <Card
        id="client-portal-root"
        radius="3xl"
        border="light"
        elevation="xl"
        padding="xl"
        className="w-full max-w-md mx-auto text-center space-y-6 my-10"
      >
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto text-3xl select-none font-bold shadow-inner">
          ⚠️
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-gray-900">Link Inválido ou Indisponível</h2>
          <p className="text-xs text-gray-600 leading-relaxed font-medium">
            {invalidLinkError}
          </p>
        </div>

        <Alert variant="info" size="sm">
          <Spinner size="xs" tone="accentRing" />
          <span>Redirecionando para a página principal em <strong>{countdown}s</strong>...</span>
        </Alert>

        <Button
          variant="neutral"
          size="md"
          fullWidth
          onClick={() => {
            if (onNavigateHome) {
              onNavigateHome();
            } else {
              window.history.pushState(null, "", "/");
              window.location.href = "/";
            }
          }}
        >
          Ir para a Página Principal Agora
        </Button>
      </Card>
    );
  }

  if (!currentUser) {
    return (
      <Card
        id="client-portal-root"
        radius="2xl"
        border="light"
        elevation="xl"
        padding="none"
        className="w-full max-w-4xl mx-auto overflow-hidden"
      >
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
                <span className="w-8 h-8 rounded-xl bg-[var(--tenant-accent-soft)] text-[var(--tenant-accent)] flex items-center justify-center font-bold">⚡</span>
                <span>Agendamento rápido em menos de 1 minuto</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[var(--tenant-accent-soft)] text-[var(--tenant-accent)] flex items-center justify-center font-bold">🔄</span>
                <span>Reagende ou cancele de forma 100% online</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-[var(--tenant-accent-soft)] text-[var(--tenant-accent)] flex items-center justify-center font-bold">🔔</span>
                <span>Histórico completo de visitas no seu portal</span>
              </div>
            </div>
          </div>

          <Card radius="2xl" border="default" elevation="sm" padding="lg" className="md:col-span-6 md:p-8 space-y-5">
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-slate-900 text-base">
                {authMode === "login" ? "Entrar na sua Conta" : "Criar sua Conta"}
              </h3>
              <p className="text-3xs text-gray-500">
                {authMode === "login"
                  ? "Entre para ver seus agendamentos e agendar mais rápido."
                  : "Cadastre-se para acompanhar seu histórico de reservas."
                }
              </p>
            </div>

            <form onSubmit={authMode === "login" ? handleLogin : onRegisterSubmit} className="space-y-3.5">
              {authError && <Alert variant="error">{authError}</Alert>}

              {authMode === "register" && (
                <>
                  {/* Account Type Selection */}
                  <Field label="Tipo de Conta">
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200">
                      <Button
                        type="button"
                        variant="none"
                        size="none"
                        onClick={() => setRegisterRole("client")}
                        className={`py-1.5 rounded-lg text-3xs ${registerRole === "client"
                          ? "bg-white text-[var(--tenant-accent)] shadow-sm border border-gray-200"
                          : "text-gray-400 hover:text-gray-600"
                          }`}
                      >
                        Sou Cliente
                      </Button>
                      <Button
                        type="button"
                        variant="none"
                        size="none"
                        onClick={() => setRegisterRole("provider")}
                        className={`py-1.5 rounded-lg text-3xs ${registerRole === "provider"
                          ? "bg-white text-[var(--tenant-accent)] shadow-sm border border-gray-200"
                          : "text-gray-400 hover:text-gray-600"
                          }`}
                      >
                        Sou Profissional
                      </Button>
                    </div>
                  </Field>

                  {/* Name field */}
                  <Field label="Nome Completo">
                    <Input
                      icon={User}
                      size="sm"
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder={registerRole === "provider" ? "Nome do Profissional" : "Seu nome"}
                    />
                  </Field>

                  {/* Provider custom fields */}
                  {registerRole === "provider" && (
                    <>
                      <Field label="Especialidade / Categoria">
                        <Select
                          value={registerCategoryId}
                          onChange={(e) => setRegisterCategoryId(e.target.value)}
                        >
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.imageUrl} {cat.name}
                            </option>
                          ))}
                        </Select>
                      </Field>

                      <Field label="Biografia / Apresentação">
                        <Textarea
                          value={registerBio}
                          onChange={(e) => setRegisterBio(e.target.value)}
                          placeholder="Fale um pouco sobre sua experiência e serviços..."
                          rows={2}
                        />
                      </Field>
                    </>
                  )}
                </>
              )}

              <Field label="E-mail">
                <Input
                  icon={Mail}
                  size="sm"
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="seuemail@provedor.com"
                />
              </Field>

              <Field label="Senha">
                <Input
                  icon={Lock}
                  size="sm"
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </Field>

              <Button
                type="submit"
                size="sm"
                fullWidth
                loading={authLoading}
                className="shadow-[color:var(--tenant-accent)]/10"
              >
                {authMode === "login" ? "Entrar" : "Criar Conta"}
              </Button>
            </form>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-gray-200 w-full"></div>
              <span className="absolute bg-white px-2 text-3xs text-gray-400 font-bold uppercase tracking-wider">ou</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                size="none"
                className="py-2 text-xs rounded-xl gap-1.5"
                onClick={() => setSocialAuthOpen("google")}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.57h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.48C21.68,11.75 21.56,11.4 21.35,11.1z" fill="#4285F4" />
                  <path d="M12,20.62c2.6,0 4.78,-0.86 6.37,-2.33l-3.3,-2.57c-0.91,0.61 -2.07,0.98 -3.07,0.98 -2.37,0 -4.38,-1.6 -5.1,-3.75H3.5v2.66C5.09,18.88 8.35,20.62 12,20.62z" fill="#34A853" />
                  <path d="M6.9,13.06c-0.18,-0.54 -0.28,-1.11 -0.28,-1.7s0.1,-1.16 0.28,-1.7V7H3.5c-0.6,1.19 -0.94,2.53 -0.94,3.96S2.9,13.7 3.5,14.88L6.9,13.06z" fill="#FBBC05" />
                  <path d="M12,6.08c1.41,0 2.69,0.49 3.69,1.44l2.76,-2.76C16.78,3.2 14.6,2.38 12,2.38c-3.65,0 -6.91,1.74 -8.5,4.62l3.4,2.66C7.62,7.68 9.63,6.08 12,6.08z" fill="#EA4335" />
                </svg>
                Google
              </Button>

              <Button
                type="button"
                variant="none"
                size="none"
                onClick={() => setSocialAuthOpen("instagram")}
                className="py-2 text-xs rounded-xl gap-1.5 bg-gradient-to-r from-purple-600 via-pink-500 to-yellow-500 hover:opacity-90 text-white shadow-md"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
                Instagram
              </Button>
            </div>

            <div className="text-center text-xs border-t border-gray-100 pt-3">
              {authMode === "login" ? (
                <p className="text-gray-500">
                  Ainda não tem conta?{" "}
                  <Button
                    variant="link"
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
                    variant="link"
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
          </Card>
        </div>
      </Card>
    );
  }

  return (
    <Card
      id="client-portal-root"
      radius="2xl"
      border="light"
      elevation="xl"
      padding="none"
      className="w-full max-w-4xl mx-auto overflow-hidden"
    >

      {/* Tabs Switcher for Authenticated Clients */}
      {currentUser && currentUser.role === "client" && (
        <div className="flex border-b border-gray-100 bg-gray-50/50">
          <Button
            variant="none"
            size="none"
            onClick={() => setActiveTab("new")}
            className={`flex-1 py-4 text-xs border-b-2 gap-2 ${activeTab === "new"
              ? "border-[var(--tenant-accent)] text-[var(--tenant-accent)] bg-white"
              : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
          >
            <CalendarDays className="w-4 h-4" />
            Novo Agendamento
          </Button>
          <Button
            variant="none"
            size="none"
            onClick={() => setActiveTab("my")}
            className={`flex-1 py-4 text-xs border-b-2 gap-2 ${activeTab === "my"
              ? "border-[var(--tenant-accent)] text-[var(--tenant-accent)] bg-white"
              : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
          >
            <FileText className="w-4 h-4" />
            Meus Agendamentos
          </Button>
        </div>
      )}

      {/* Progress Steps Indicator (4-Step Streamlined Flow) */}
      {activeTab === "new" && step < 4 && (
        <div className="px-8 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between text-xs font-medium text-gray-400">
          <div className="flex items-center gap-4 w-full justify-center md:justify-start flex-wrap">
            <span className={`pb-1 flex items-center gap-1.5 ${step === 1 ? "text-[var(--tenant-accent)] font-bold border-b-2 border-[var(--tenant-accent)]" : step > 1 ? "text-gray-900 font-semibold" : ""}`}>
              {step > 1 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
              1. Serviço
            </span>
            <span className="text-gray-300">/</span>
            <span className={`pb-1 flex items-center gap-1.5 ${step === 2 ? "text-[var(--tenant-accent)] font-bold border-b-2 border-[var(--tenant-accent)]" : step > 2 ? "text-gray-900 font-semibold" : ""}`}>
              {step > 2 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : null}
              2. Data e Hora
            </span>
            <span className="text-gray-300">/</span>
            <span className={`pb-1 flex items-center gap-1.5 ${step === 3 ? "text-[var(--tenant-accent)] font-bold border-b-2 border-[var(--tenant-accent)]" : ""}`}>
              3. Seus Dados
            </span>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="p-8">
        {error && (
          <Alert variant="error" size="md" icon={AlertCircle} className="mb-6">
            {error}
          </Alert>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "new" ? (
            <div key="tab-new">

              {/* STEP 1: SERVICES OF THE SELECTED PROVIDER ONLY */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="border-b border-gray-100 pb-4">
                    <h2 className="text-xl font-bold text-gray-900">Escolha o Serviço</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      Serviços disponíveis com <strong className="text-slate-900 font-bold">{selectedProvider ? selectedProvider.name : "o profissional"}</strong>.
                    </p>
                  </div>

                  {/* Services Grid (Strictly filtered by selected provider) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredServices.length === 0 ? (
                      <EmptyState size="sm" className="col-span-full">
                        <AlertCircle className="w-10 h-10 stroke-1 mx-auto text-amber-500" />
                        <p className="text-xs font-semibold">Nenhum serviço encontrado para este prestador.</p>
                      </EmptyState>
                    ) : (
                      filteredServices.map(service => {
                        const isSelected = selectedService?.id === service.id;
                        const icon = getServiceIcon(service.name);

                        return (
                          <div
                            key={service.id}
                            onClick={() => handleSelectService(service)}
                            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex gap-4 items-start ${isSelected
                                ? "border-[var(--tenant-accent)] bg-[var(--tenant-accent-soft)] shadow-md"
                                : "border-gray-200 hover:border-[var(--tenant-accent)] hover:shadow-md hover:translate-y-[-2px] bg-white group"
                              }`}
                          >
                            <span className="text-3xl p-3 bg-gray-50 rounded-xl border border-gray-100 shrink-0 select-none shadow-sm group-hover:scale-105 transition-transform">
                              {icon}
                            </span>
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap justify-between">
                                <h3 className="font-bold text-slate-900 text-sm leading-snug truncate group-hover:text-[var(--tenant-accent)] transition-colors">{service.name}</h3>
                                <Badge tone="neutral" className="shrink-0">
                                  {service.durationMinutes} min
                                </Badge>
                              </div>

                              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{service.description || "Atendimento especializado com horário reservado."}</p>

                              <div className="flex justify-between items-center pt-2">
                                <span className="text-xs font-bold text-[var(--tenant-accent)] group-hover:translate-x-1 transition-transform">
                                  Agendar Horário &rarr;
                                </span>
                                <span className="text-xs font-extrabold font-mono text-[var(--tenant-accent)]">
                                  {formatPrice(service.price)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP 2: SELECT DATE & TIME */}
              {step === 2 && selectedService && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <IconButton
                      label="Voltar para a escolha do serviço"
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        setSelectedService(null);
                        setStep(1);
                      }}
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </IconButton>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Selecione Data e Horário</h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Disponibilidades para <strong className="text-slate-900 font-bold">{selectedService.name}</strong>
                        {selectedProvider ? <> com <strong className="text-slate-900 font-bold">{selectedProvider.name}</strong></> : null}.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Calendar Card */}
                    <Card radius="2xl" border="default" elevation="sm" padding="md" className="lg:col-span-7 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 capitalize text-sm">
                          {currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                        </h3>
                        <div className="flex gap-1.5">
                          <IconButton
                            label="Mês anterior"
                            variant="outline"
                            size="md"
                            onClick={handlePrevMonth}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </IconButton>
                          <IconButton
                            label="Próximo mês"
                            variant="outline"
                            size="md"
                            onClick={handleNextMonth}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </IconButton>
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

                          const todayStr = getTodayLocalDateString();
                          const isPast = dateStr < todayStr;
                          const isWeekend = new Date(year, currentMonth.getMonth(), day).getDay() === 0;

                          return (
                            <button
                              key={`day-${day}`}
                              disabled={isPast}
                              onClick={() => selectDateHandler(day)}
                              className={`aspect-square flex items-center justify-center rounded-xl text-xs font-medium transition-all cursor-pointer ${isPast
                                  ? "text-gray-300 cursor-not-allowed"
                                  : isSelected
                                    ? "bg-[var(--tenant-accent)] text-white shadow-md font-bold scale-105"
                                    : isWeekend
                                      ? "text-red-500 hover:bg-red-50 font-bold"
                                      : "text-gray-700 hover:bg-gray-100 font-semibold"
                                }`}
                            >
                              {day}
                            </button>
                          );
                        })}
                      </div>
                    </Card>

                    {/* Time Slots Card */}
                    <Card radius="2xl" border="default" elevation="sm" padding="md" className="lg:col-span-5 flex flex-col justify-start min-h-[300px]">
                      {slotsLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 text-gray-400">
                          <Spinner size="lg" tone="accent" />
                          <p className="mt-3 text-xs">Buscando horários disponíveis...</p>
                        </div>
                      ) : !selectedDate ? (
                        <EmptyState size="sm" bordered={false} className="flex-1">
                          <CalendarIcon className="w-8 h-8 text-gray-300" />
                          <p className="text-xs font-semibold">Escolha uma data ao lado para listar os horários disponíveis.</p>
                        </EmptyState>
                      ) : slots.length === 0 ? (
                        <EmptyState size="sm" bordered={false} className="flex-1">
                          <AlertCircle className="w-8 h-8 text-amber-500" />
                          <p className="text-xs font-semibold">Nenhum horário disponível para esta data.</p>
                        </EmptyState>
                      ) : (
                        <div className="space-y-4 flex-1 flex flex-col justify-between">
                          <div className="space-y-3">
                            <h4 className="font-bold text-gray-900 text-xs flex items-center gap-2 border-b border-gray-100 pb-2">
                              <Clock className="w-4 h-4 text-gray-400" />
                              Horários em {formatDateHuman(selectedDate)}
                            </h4>

                            <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                              {slots.map(slot => (
                                <button
                                  key={slot.time}
                                  disabled={!slot.available}
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`py-2.5 px-3 rounded-xl text-xs font-bold font-mono border transition-all cursor-pointer ${!slot.available
                                      ? "bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed text-left flex flex-col opacity-60"
                                      : selectedSlot?.time === slot.time
                                        ? "bg-[var(--tenant-accent)] border-[var(--tenant-accent)] text-white shadow-sm"
                                        : "bg-white border-gray-200 text-gray-700 hover:border-[var(--tenant-accent)]"
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
                              <Button fullWidth size="lg" onClick={() => setStep(3)}>
                                Avançar para Seus Dados &rarr;
                              </Button>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </Card>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: CLIENT INFO FORM */}
              {step === 3 && selectedService && selectedSlot && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3">
                    <IconButton
                      label="Voltar para a escolha de data e horário"
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        setStep(2);
                      }}
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </IconButton>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Preencha seus dados de contato</h2>
                      <p className="text-sm text-gray-500 mt-0.5">Informe os dados para confirmar a reserva.</p>
                    </div>
                  </div>

                  <form onSubmit={handleBookingSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-8">
                    <div className="md:col-span-7 space-y-4">
                      <Field label="Nome Completo *" htmlFor="client-name" variant="default">
                        <Input
                          id="client-name"
                          icon={User}
                          size="lg"
                          surface="plain"
                          type="text"
                          required
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          placeholder="Seu nome completo"
                        />
                      </Field>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="E-mail *" htmlFor="client-email" variant="default">
                          <Input
                            id="client-email"
                            icon={Mail}
                            size="lg"
                            surface="plain"
                            type="email"
                            required
                            value={clientEmail}
                            onChange={(e) => setClientEmail(e.target.value)}
                            placeholder="seu@email.com"
                          />
                        </Field>

                        <Field label="Celular / WhatsApp *" htmlFor="client-phone" variant="default">
                          <Input
                            id="client-phone"
                            icon={Phone}
                            size="lg"
                            surface="plain"
                            type="tel"
                            required
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                            placeholder="(11) 99999-9999"
                          />
                        </Field>
                      </div>

                      <Field label="Observações (Opcional)" htmlFor="client-notes" variant="default">
                        <Textarea
                          id="client-notes"
                          size="lg"
                          surface="plain"
                          rows={3}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Alguma recomendação especial?"
                        />
                      </Field>
                    </div>

                    {/* Booking Summary Box */}
                    <Card tone="muted" radius="2xl" border="default" elevation="none" padding="lg" className="md:col-span-5 self-start space-y-4">
                      <h3 className="font-bold text-slate-900 text-sm border-b border-gray-200 pb-2">Resumo da Reserva</h3>

                      <div className="space-y-3 text-xs">
                        <div className="flex justify-between items-start gap-4">
                          <span className="text-gray-400">Serviço:</span>
                          <span className="text-gray-900 font-bold text-right">{selectedService.name}</span>
                        </div>
                        {selectedProvider && (
                          <div className="flex justify-between items-start gap-4">
                            <span className="text-gray-400">Profissional:</span>
                            <span className="text-gray-900 font-semibold text-right">{selectedProvider.name}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-start gap-4 border-t border-gray-200 pt-2">
                          <span className="text-gray-400">Data e Hora:</span>
                          <span className="text-[var(--tenant-accent)] font-extrabold font-mono text-right">
                            {formatDateHuman(selectedDate)} às {selectedSlot.time}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline gap-4 border-t border-gray-200 pt-3">
                          <span className="text-sm font-bold text-gray-900 font-sans">Valor total:</span>
                          <span className="text-lg font-extrabold font-mono text-[var(--tenant-accent)]">
                            {formatPrice(selectedService.price)}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        size="lg"
                        fullWidth
                        loading={bookingLoading}
                        loadingTone="white"
                        loadingLabel="Confirmando agendamento..."
                        leftIcon={<CheckCircle className="w-4 h-4" />}
                      >
                        Finalizar e Confirmar Reserva
                      </Button>
                    </Card>
                  </form>
                </motion.div>
              )}

              {/* STEP 4: SUCCESS & SUMMARY SCREEN */}
              {step === 4 && successBooking && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-10 px-4 max-w-lg mx-auto space-y-6"
                >
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-inner">
                    <CheckCircle className="w-10 h-10 text-emerald-600" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold text-slate-900">Agendamento Realizado!</h2>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Seu horário está confirmado e reservado com sucesso.
                    </p>
                  </div>

                  <Card tone="muted" radius="2xl" border="default" elevation="none" padding="md" className="text-left space-y-3 text-xs">
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                      <span className="font-semibold text-gray-500 uppercase tracking-wider text-3xs">Código de Reserva</span>
                      <span className="font-mono font-bold text-gray-900">{successBooking.id}</span>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <p className="text-gray-800">💅 Serviço: <strong>{selectedService?.name}</strong></p>
                      {selectedProvider && <p className="text-gray-800">👤 Profissional: <strong>{selectedProvider.name}</strong></p>}
                      <p className="text-gray-800">📅 Data: <strong>{formatDateHuman(selectedDate)}</strong></p>
                      <p className="text-gray-800">⏰ Horário: <strong className="text-[var(--tenant-accent)] font-mono text-sm">{selectedSlot?.time}</strong></p>
                      <p className="text-gray-800">💰 Valor: <strong className="font-mono">{selectedService ? formatPrice(selectedService.price) : ""}</strong></p>
                    </div>
                  </Card>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      variant="outline"
                      size="md"
                      className="flex-1"
                      onClick={() => {
                        setSelectedService(null);
                        setSelectedDate("");
                        setSelectedSlot(null);
                        setStep(1);
                        setError(null);
                      }}
                    >
                      Novo Agendamento
                    </Button>
                    {currentUser && (
                      <Button
                        size="md"
                        className="flex-1"
                        onClick={() => {
                          setActiveTab("my");
                          fetchBookings();
                        }}
                      >
                        Ver Meus Agendamentos
                      </Button>
                    )}
                  </div>
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
                  <Spinner size="lg" tone="accent" className="mx-auto" />
                  <p className="text-sm text-gray-500 mt-2 font-medium">Buscando seus agendamentos...</p>
                </div>
              ) : myBookings.length === 0 ? (
                <EmptyState size="md">
                  <CalendarIcon className="w-12 h-12 stroke-1 mx-auto text-gray-300" />
                  <p className="text-sm font-semibold">Você ainda não tem nenhum agendamento cadastrado.</p>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab("new")}
                  >
                    Agendar agora
                  </Button>
                </EmptyState>
              ) : (
                <div className="space-y-4">
                  {myBookings.map((booking) => {
                    const start = new Date(booking.startsAt);
                    const formattedDate = start.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
                    const formattedTime = start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

                    const isCancelled = booking.status === "cancelled";
                    const isCompleted = booking.status === "completed";

                    return (
                      <Card
                        key={booking.id}
                        tone={isCancelled ? "mutedSoft" : "white"}
                        radius="2xl"
                        border="default"
                        elevation={isCancelled ? "none" : "sm"}
                        padding="md"
                        className={`transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${isCancelled ? "opacity-60" : ""}`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-sm">{booking.serviceName}</h3>
                            <Badge tone={isCancelled ? "danger" : isCompleted ? "success" : "info"}>
                              {booking.status === "confirmed" ? "confirmado" : booking.status}
                            </Badge>
                          </div>

                          <div className="text-xs text-gray-500 space-y-0.5">
                            {booking.providerName && <p>👤 Profissional: <strong>{booking.providerName}</strong></p>}
                            <p className="font-mono">📅 Horário: {formattedDate} às {formattedTime}</p>
                          </div>
                        </div>

                        {!isCancelled && !isCompleted && (
                          <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100 shrink-0">
                            <Button
                              variant="accent"
                              size="none"
                              className="px-3 py-1.5 rounded-lg text-2xs"
                              onClick={() => {
                                setReschedulingBooking(booking);
                                setRescheduleMonth(new Date());
                                setRescheduleDate("");
                                setSelectedRescheduleSlot(null);
                              }}
                            >
                              Reagendar
                            </Button>
                            <Button
                              variant="danger"
                              size="none"
                              className="px-3 py-1.5 rounded-lg text-2xs"
                              onClick={() => handleCancel(booking.id)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Reschedule Modal (Pop-up) */}
      <Modal
        open={!!reschedulingBooking}
        onClose={closeReschedule}
        size="lg"
        showClose
      >
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">Reagendar Agendamento</h3>
          <p className="text-xs text-gray-500 mt-1">
            Selecione um novo horário para o serviço: <strong>{reschedulingBooking?.serviceName}</strong>.
          </p>
        </div>

        {rescheduleError && <Alert variant="error">{rescheduleError}</Alert>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Custom calendar for reschedule */}
          <Card radius="xl" border="light" elevation="sm" padding="sm" className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-gray-900 text-xs">
                {rescheduleMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </h4>
              <div className="flex items-center gap-1">
                <IconButton
                  label="Mês anterior"
                  variant="outline"
                  size="sm"
                  onClick={handleReschedulePrevMonth}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </IconButton>
                <IconButton
                  label="Próximo mês"
                  variant="outline"
                  size="sm"
                  onClick={handleRescheduleNextMonth}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </IconButton>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0.5 text-center text-3xs font-bold text-gray-400">
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

                const todayStr = getTodayLocalDateString();
                const isPast = dateStr < todayStr;
                const isWeekend = new Date(year, rescheduleMonth.getMonth(), day).getDay() === 0;

                return (
                  <button
                    key={`resday-${day}`}
                    disabled={isPast}
                    onClick={() => selectRescheduleDateHandler(day)}
                    className={`aspect-square flex items-center justify-center rounded text-xs font-semibold cursor-pointer ${isPast
                        ? "text-gray-100 cursor-not-allowed"
                        : isSelected
                          ? "bg-[var(--tenant-accent)] text-white font-bold"
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
          </Card>

          {/* Available Slots */}
          <div className="flex flex-col min-h-[220px]">
            {!rescheduleDate ? (
              <EmptyState size="xs" className="flex-1">
                <CalendarIcon className="w-8 h-8 mb-2 stroke-1" />
                <p>Escolha uma nova data.</p>
              </EmptyState>
            ) : rescheduleSlotsLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <Spinner size="md" tone="accent" />
              </div>
            ) : rescheduleSlots.length === 0 ? (
              <EmptyState size="xs" className="flex-1">
                <AlertCircle className="w-6 h-6 mb-1 stroke-1" />
                <p>Nenhum horário disponível.</p>
              </EmptyState>
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
                        className={`py-2 rounded-lg text-xs font-semibold font-mono border transition-all cursor-pointer ${!slot.available
                            ? "bg-gray-50 border-gray-100 text-gray-200 cursor-not-allowed"
                            : selectedRescheduleSlot?.time === slot.time
                              ? "bg-[var(--tenant-accent)] border-[var(--tenant-accent)] text-white shadow-sm"
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
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={closeReschedule}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="flex-1"
            disabled={!selectedRescheduleSlot}
            onClick={handleRescheduleConfirm}
          >
            Confirmar Reagendamento
          </Button>
        </div>
      </Modal>
    </Card>
  );
}
