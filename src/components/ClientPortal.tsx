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
  Booking 
} from "../types";
import { 
  getProviders, 
  getServices, 
  getSlots, 
  createBooking 
} from "../lib/api";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  CheckCircle, 
  ArrowLeft, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  Scissors
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ClientPortalProps {
  tenant: Tenant;
}

export default function ClientPortal({ tenant }: ClientPortalProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
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

  // Month navigation for custom calendar
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Fetch initial services and providers for this tenant
  useEffect(() => {
    async function loadData() {
      try {
        const provs = await getProviders(tenant.id);
        setProviders(provs);
        
        // Load services for the first provider initially, or general
        const servs = await getServices();
        setServices(servs);
      } catch (err) {
        console.error("Error loading portal data", err);
        setError("Não foi possível carregar as informações do agendamento.");
      }
    }
    loadData();
    
    // Reset selection if tenant changes
    setSelectedService(null);
    setSelectedProvider(null);
    setSelectedDate("");
    setSelectedSlot(null);
    setStep(1);
    setError(null);
  }, [tenant]);

  // Filter services based on selected provider or vice versa
  const filteredServices = services.filter(s => {
    if (!selectedProvider) return providers.some(p => p.id === s.providerId);
    return s.providerId === selectedProvider.id;
  });

  const filteredProviders = providers.filter(p => {
    if (!selectedService) return true;
    return selectedService.providerId === p.id;
  });

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

  const selectDateHandler = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = (currentMonth.getMonth() + 1).toString().padStart(2, "0");
    const dayStr = day.toString().padStart(2, "0");
    const dateStr = `${year}-${month}-${dayStr}`;
    
    // Don't allow past dates
    const todayStr = new Date().toISOString().split("T")[0];
    if (dateStr < todayStr) return;

    setSelectedDate(dateStr);
    setSelectedSlot(null);
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
      setStep(5); // Go to success step
    } catch (err: any) {
      setError(err.message || "Ocorreu um erro ao realizar seu agendamento. Tente novamente.");
    } finally {
      setBookingLoading(false);
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

  // Format currency
  const formatPrice = (p: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p);
  };

  // Human date formatting
  const formatDateHuman = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  };

  return (
    <div id="client-portal-root" className="w-full max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Brand Header */}
      <div className={`p-8 bg-gradient-to-r from-gray-900 via-gray-800 to-slate-900 text-white relative`}>
        <div className="absolute top-4 right-4 text-4xl opacity-15">
          {tenant.logoUrl === "✂️" ? <Scissors className="w-16 h-16" /> : <Sparkles className="w-16 h-16" />}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-4xl bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 shadow-inner">
            {tenant.logoUrl || "🗓️"}
          </span>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Portal de Agendamentos</span>
            <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <p className="text-sm text-gray-300 mt-1 max-w-xl">{tenant.description}</p>
          </div>
        </div>
      </div>

      {/* Progress Steps Indicator */}
      {step < 5 && (
        <div className="px-8 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between text-xs font-medium text-gray-400">
          <div className="flex items-center gap-5 w-full justify-center md:justify-start">
            <span className={`pb-1 ${step === 1 ? `text-${currentTheme.accent} border-b-2 border-${currentTheme.accent}` : "text-gray-900"}`}>
              1. Serviço
            </span>
            <span className="text-gray-300">/</span>
            <span className={`pb-1 ${step === 2 ? `text-${currentTheme.accent} border-b-2 border-${currentTheme.accent}` : step > 2 ? "text-gray-900" : ""}`}>
              2. Profissional
            </span>
            <span className="text-gray-300">/</span>
            <span className={`pb-1 ${step === 3 ? `text-${currentTheme.accent} border-b-2 border-${currentTheme.accent}` : step > 3 ? "text-gray-900" : ""}`}>
              3. Data e Hora
            </span>
            <span className="text-gray-300">/</span>
            <span className={`pb-1 ${step === 4 ? `text-${currentTheme.accent} border-b-2 border-${currentTheme.accent}` : ""}`}>
              4. Seus Dados
            </span>
          </div>
        </div>
      )}

      {/* Main Form Content */}
      <div className="p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm font-medium">{error}</div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* STEP 1: SELECT SERVICE */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold text-gray-900">Escolha o serviço desejado</h2>
                <p className="text-sm text-gray-500 mt-1">Selecione uma das opções abaixo para iniciar seu agendamento.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredServices.map(service => {
                  const isSelected = selectedService?.id === service.id;
                  const serviceProvider = providers.find(p => p.id === service.providerId);
                  
                  return (
                    <div
                      key={service.id}
                      onClick={() => {
                        setSelectedService(service);
                        // Auto-select provider for this service to streamline the flow
                        if (serviceProvider) setSelectedProvider(serviceProvider);
                        setStep(2);
                      }}
                      className={`p-5 rounded-xl border-2 transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isSelected 
                          ? `border-${currentTheme.accent} ${currentTheme.bg} shadow-md` 
                          : "border-gray-100 hover:border-gray-200 hover:shadow-sm"
                      }`}
                    >
                      <div className="space-y-1 max-w-xl">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-base">{service.name}</h3>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                            {service.durationMinutes} min
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed">{service.description}</p>
                        {serviceProvider && (
                          <p className="text-xs text-gray-400 flex items-center gap-1.5 pt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            Realizado por: <strong>{serviceProvider.name}</strong>
                          </p>
                        )}
                      </div>
                      <div className="flex md:flex-col items-baseline md:items-end justify-between md:justify-center shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
                        <span className="text-xs text-gray-400 md:hidden">Preço:</span>
                        <span className="text-lg font-bold text-gray-900 font-mono">{formatPrice(service.price)}</span>
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
                  onClick={() => setStep(1)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Escolha o Profissional</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Selecione o prestador para realizar o seu serviço de <strong className="text-gray-700">{selectedService?.name}</strong>.</p>
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
                      <div className="w-12 h-12 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-lg border border-gray-200 shrink-0 font-sans">
                        {provider.name.charAt(0)}
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                        <p className="text-xs text-gray-400">{provider.email}</p>
                        <p className="text-xs text-gray-500 leading-relaxed mt-1 line-clamp-3">{provider.bio}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* STEP 3: SELECT DATE & TIME */}
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
                  onClick={() => setStep(2)}
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
                {/* Custom Calendar Card (7 cols) */}
                <div className="lg:col-span-7 bg-white border border-gray-100 rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      {currentMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    </h3>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={handlePrevMonth}
                        className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-600 border border-gray-100"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={handleNextMonth}
                        className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-600 border border-gray-100"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-400">
                    <div>Dom</div>
                    <div>Seg</div>
                    <div>Ter</div>
                    <div>Qua</div>
                    <div>Qui</div>
                    <div>Sex</div>
                    <div>Sáb</div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center">
                    {/* Padding empty days */}
                    {Array.from({ length: firstDayOfMonth(currentMonth) }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square"></div>
                    ))}
                    
                    {/* Month Days */}
                    {Array.from({ length: daysInMonth(currentMonth) }).map((_, i) => {
                      const day = i + 1;
                      const year = currentMonth.getFullYear();
                      const month = (currentMonth.getMonth() + 1).toString().padStart(2, "0");
                      const dayStr = day.toString().padStart(2, "0");
                      const dateStr = `${year}-${month}-${dayStr}`;
                      const isSelected = selectedDate === dateStr;
                      
                      // Highlight past days
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
                              ? "text-gray-200 cursor-not-allowed" 
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

                  <div className="text-2xs text-gray-400 border-t border-gray-50 pt-3 flex items-center gap-3 justify-center">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-gray-100 rounded-md inline-block"></span> Livre
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={`w-2.5 h-2.5 bg-${currentTheme.accent} rounded-md inline-block`}></span> Selecionado
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 bg-transparent border border-dashed border-gray-200 text-gray-200 rounded-md inline-block text-center text-xs leading-none"></span> Fechado
                    </span>
                  </div>
                </div>

                {/* Time Slots Card (5 cols) */}
                <div className="lg:col-span-5 flex flex-col min-h-[300px]">
                  {!selectedDate ? (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400">
                      <CalendarIcon className="w-10 h-10 mb-2 stroke-1" />
                      <p className="text-sm">Selecione uma data para visualizar os horários disponíveis.</p>
                    </div>
                  ) : slotsLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6">
                      <div className={`animate-spin rounded-full h-8 w-8 border-b-2 border-${currentTheme.accent}`}></div>
                      <p className="text-sm text-gray-500 mt-2 font-medium">Buscando horários...</p>
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400">
                      <AlertCircle className="w-8 h-8 mb-2 stroke-1" />
                      <p className="text-sm font-medium">Nenhum horário de atendimento disponível para este dia.</p>
                      <p className="text-xs text-gray-300 mt-1">Experimente outra data ou entre em contato.</p>
                    </div>
                  ) : (
                    <div className="space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            Horários de Atendimento
                          </h4>
                          <span className="text-xs text-gray-400 font-medium">
                            {formatDateHuman(selectedDate)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 max-h-[250px] overflow-y-auto pr-1">
                          {slots.map(slot => (
                            <button
                              key={slot.time}
                              disabled={!slot.available}
                              onClick={() => setSelectedSlot(slot)}
                              className={`py-2.5 px-3 rounded-lg text-xs font-semibold font-mono border transition-all ${
                                !slot.available
                                  ? "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed text-left flex flex-col"
                                  : selectedSlot?.time === slot.time
                                    ? `bg-${currentTheme.accent} border-${currentTheme.accent} text-white shadow-sm`
                                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-400"
                              }`}
                              title={slot.reason}
                            >
                              <span>{slot.time}</span>
                              {!slot.available && slot.reason && (
                                <span className="text-4xs text-gray-300 font-sans font-normal truncate max-w-full block">
                                  Ocupado
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Submit / Proceed Button */}
                      {selectedSlot && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="pt-4 border-t border-gray-100"
                        >
                          <div className={`p-3 rounded-xl ${currentTheme.bg} ${currentTheme.border} mb-3 text-xs flex justify-between`}>
                            <span className="text-gray-600 font-medium">Horário Escolhido:</span>
                            <span className={`text-${currentTheme.accent} font-bold font-mono`}>
                              {formatDateHuman(selectedDate)} às {selectedSlot.time}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => setStep(4)}
                            className={`w-full py-3 px-4 bg-${currentTheme.accent} hover:bg-opacity-90 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2`}
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

          {/* STEP 4: CLIENT INFO FORM */}
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
                  onClick={() => setStep(3)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Preencha seus dados</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Quase pronto! Insira as suas informações para finalizar a reserva.</p>
                </div>
              </div>

              <form onSubmit={handleBookingSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Form inputs (7 cols) */}
                <div className="md:col-span-7 space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="client-name" className="text-xs font-semibold text-gray-700 block">Nome Completo *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="client-name"
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Ex: Diógenes Silva"
                        className="w-full py-2.5 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="client-email" className="text-xs font-semibold text-gray-700 block">E-mail de Contato *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          id="client-email"
                          type="email"
                          required
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          placeholder="Ex: diogenes@gmail.com"
                          className="w-full py-2.5 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all text-gray-800"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="client-phone" className="text-xs font-semibold text-gray-700 block">Telefone / WhatsApp *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          id="client-phone"
                          type="tel"
                          required
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          placeholder="Ex: (11) 99999-9999"
                          className="w-full py-2.5 pl-10 pr-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all text-gray-800"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="client-notes" className="text-xs font-semibold text-gray-700 block">Observações / Observações especiais (Opcional)</label>
                    <textarea
                      id="client-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Gostaria de um corte mais baixo nas laterais / Tenho alergia a pomada capilar..."
                      className="w-full py-2.5 px-4 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all text-gray-800"
                    />
                  </div>
                </div>

                {/* Booking Summary Box (5 cols) */}
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

                    <div className="flex justify-between items-start gap-4">
                      <span className="text-gray-400">Duração:</span>
                      <span className="text-gray-900 font-mono text-right">{selectedService?.durationMinutes} minutos (+ {selectedService?.bufferMinutes} min de preparo)</span>
                    </div>

                    <div className="flex justify-between items-start gap-4 border-t border-gray-200 pt-2">
                      <span className="text-gray-400">Data:</span>
                      <span className="text-gray-900 font-bold text-right">{formatDateHuman(selectedDate)}</span>
                    </div>

                    <div className="flex justify-between items-start gap-4">
                      <span className="text-gray-400">Horário:</span>
                      <span className={`text-${currentTheme.accent} font-extrabold font-mono text-right`}>{selectedSlot?.time}</span>
                    </div>

                    <div className="flex justify-between items-baseline gap-4 border-t border-gray-200 pt-3">
                      <span className="text-sm font-bold text-gray-900">Total a pagar:</span>
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
                  <p className="text-4xs text-center text-gray-400 leading-relaxed pt-1">
                    Ao confirmar, você receberá a confirmação imediatamente em nosso painel de controle.
                  </p>
                </div>
              </form>
            </motion.div>
          )}

          {/* STEP 5: SUCCESS MESSAGE */}
          {step === 5 && successBooking && (
            <motion.div
              key="step-5"
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

              {/* Booking Voucher Card */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 text-left space-y-3 text-xs">
                <div className="flex justify-between border-b border-gray-200 pb-2">
                  <span className="font-semibold text-gray-500 uppercase tracking-wider text-3xs">Código de Reserva</span>
                  <span className="font-mono font-bold text-gray-900">{successBooking.id}</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <p className="text-gray-800">
                    💅 Serviço: <strong className="text-gray-900">{selectedService?.name}</strong>
                  </p>
                  <p className="text-gray-800">
                    👤 Profissional: <strong>{selectedProvider?.name}</strong>
                  </p>
                  <p className="text-gray-800">
                    📅 Data: <strong>{formatDateHuman(selectedDate)}</strong>
                  </p>
                  <p className="text-gray-800">
                    ⏰ Horário: <strong className={`text-${currentTheme.accent} font-mono text-sm`}>{selectedSlot?.time}</strong>
                  </p>
                  <p className="text-gray-800">
                    💰 Preço: <strong className="font-mono">{selectedService ? formatPrice(selectedService.price) : ""}</strong>
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    // Reset all states and go to step 1
                    setSelectedService(null);
                    setSelectedProvider(null);
                    setSelectedDate("");
                    setSelectedSlot(null);
                    setStep(1);
                    setError(null);
                  }}
                  className="flex-1 py-2.5 px-4 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-xl font-semibold text-xs transition-colors"
                >
                  Fazer Outro Agendamento
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
