import { 
  Tenant, 
  Provider, 
  Service, 
  AvailabilityRule, 
  AvailabilityException, 
  Booking, 
  TimeSlot 
} from "../types";

const API_BASE = "/api";

const getToken = () => localStorage.getItem("token");

const getHeaders = (headers: HeadersInit = {}): HeadersInit => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...headers,
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
};

export async function getTenants(): Promise<Tenant[]> {
  const res = await fetch(`${API_BASE}/tenants`);
  if (!res.ok) throw new Error("Failed to fetch tenants");
  return res.json();
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const res = await fetch(`${API_BASE}/tenants/${slug}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch tenant");
  return res.json();
}

export async function getProviders(tenantId?: string): Promise<Provider[]> {
  const url = tenantId ? `${API_BASE}/providers?tenantId=${tenantId}` : `${API_BASE}/providers`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch providers");
  return res.json();
}

export async function getServices(providerId?: string): Promise<Service[]> {
  const url = providerId ? `${API_BASE}/services?providerId=${providerId}` : `${API_BASE}/services`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch services");
  return res.json();
}

export async function createService(data: Omit<Service, "id">): Promise<Service> {
  const res = await fetch(`${API_BASE}/services`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create service");
  return res.json();
}

export async function updateService(id: string, data: Partial<Service>): Promise<Service> {
  const res = await fetch(`${API_BASE}/services/${id}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update service");
  return res.json();
}

export async function deleteService(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/services/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete service");
}

export async function getAvailabilityRules(providerId: string): Promise<AvailabilityRule[]> {
  const res = await fetch(`${API_BASE}/availability-rules?providerId=${providerId}`);
  if (!res.ok) throw new Error("Failed to fetch availability rules");
  return res.json();
}

export async function updateAvailabilityRules(providerId: string, rules: Omit<AvailabilityRule, "id">[]): Promise<AvailabilityRule[]> {
  const res = await fetch(`${API_BASE}/availability-rules`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ providerId, rules }),
  });
  if (!res.ok) throw new Error("Failed to update availability rules");
  return res.json();
}

export async function getExceptions(providerId: string): Promise<AvailabilityException[]> {
  const res = await fetch(`${API_BASE}/exceptions?providerId=${providerId}`);
  if (!res.ok) throw new Error("Failed to fetch exceptions");
  return res.json();
}

export async function createException(data: Omit<AvailabilityException, "id">): Promise<AvailabilityException> {
  const res = await fetch(`${API_BASE}/exceptions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create exception");
  return res.json();
}

export async function deleteException(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/exceptions/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete exception");
}

export async function getSlots(serviceId: string, date: string): Promise<TimeSlot[]> {
  const res = await fetch(`${API_BASE}/slots?serviceId=${serviceId}&date=${date}`);
  if (!res.ok) throw new Error("Failed to fetch slots");
  return res.json();
}

export async function getBookings(providerId?: string): Promise<Booking[]> {
  const url = providerId ? `${API_BASE}/bookings?providerId=${providerId}` : `${API_BASE}/bookings`;
  const res = await fetch(url, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error("Failed to fetch bookings");
  return res.json();
}

export async function createBooking(data: {
  providerId: string;
  serviceId: string;
  startsAt: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  notes?: string;
}): Promise<Booking> {
  const res = await fetch(`${API_BASE}/bookings`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  if (res.status === 409) {
    const errData = await res.json();
    throw new Error(errData.message || "slot_unavailable");
  }
  
  if (!res.ok) {
    throw new Error("Não foi possível processar o agendamento. Verifique se os dados estão corretos.");
  }
  
  return res.json();
}

export async function updateBookingStatus(id: string, status: Booking["status"]): Promise<Booking> {
  const res = await fetch(`${API_BASE}/bookings/${id}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update booking status");
  return res.json();
}

export async function deleteBooking(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/bookings/${id}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete booking");
}

// --- NEW AUTHENTICATION API METHODS ---

export async function login(email: string, password: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Credenciais inválidas");
  }
  return res.json();
}

export async function register(email: string, password: string, name: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Erro no cadastro");
  }
  return res.json();
}

export async function getMe(): Promise<{ user: any }> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export async function getMyBookings(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/bookings/my`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error("Failed to fetch my bookings");
  return res.json();
}

export async function rescheduleBooking(id: string, startsAt: string): Promise<Booking> {
  const res = await fetch(`${API_BASE}/bookings/${id}/reschedule`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ startsAt }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || err.error || "Não foi possível reagendar.");
  }
  return res.json();
}
