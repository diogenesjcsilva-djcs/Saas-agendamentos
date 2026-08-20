import { Router } from 'express';
import { query } from './db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authMiddleware, AuthenticatedRequest } from './auth-middleware.js';
import { createRateLimiter } from './rate-limiter.js';
import { 
  Tenant, 
  Provider, 
  Service, 
  AvailabilityRule, 
  AvailabilityException, 
  Booking, 
  TimeSlot 
} from '../types';

const router = Router();

// Rate Limiters for sensitive actions
const authRateLimiter = createRateLimiter(60 * 1000, 20, "Muitas tentativas de autenticação. Por favor, aguarde um minuto.");
const bookingRateLimiter = createRateLimiter(60 * 1000, 30, "Muitas solicitações de agendamento. Por favor, aguarde um momento.");
const tenantRateLimiter = createRateLimiter(60 * 1000, 10, "Muitas tentativas de criação de estabelecimento. Por favor, aguarde.");

// Helper to convert Date object or string to UTC ISO string
const toISOString = (val: any): string => {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  return d.toISOString();
};

// Email validation helper
const isValidEmail = (email: any): boolean => {
  if (typeof email !== 'string') return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
};

// 1. Get all Tenants
router.get('/tenants', async (req, res) => {
  try {
    const tenants = await query<Tenant>(
      `SELECT id, name, slug, logo_url AS "logoUrl", description, theme_color AS "themeColor", accent_color AS "accentColor" 
       FROM tenants`
    );
    res.json(tenants);
  } catch (error) {
    console.error("Error fetching tenants:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 2. Get Single Tenant by Slug
router.get('/tenants/:slug', async (req, res) => {
  try {
    const rows = await query<Tenant>(
      `SELECT id, name, slug, logo_url AS "logoUrl", description, theme_color AS "themeColor", accent_color AS "accentColor" 
       FROM tenants WHERE slug = $1 LIMIT 1`,
      [req.params.slug]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching tenant by slug:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 2.1 Create New Tenant
router.post('/tenants', tenantRateLimiter, async (req, res) => {
  try {
    const { name, slug, description, logoUrl, themeColor, ownerName, email, password } = req.body;

    if (!name || !slug || !description || !themeColor || !ownerName || !email || !password) {
      return res.status(400).json({ error: "Todos os campos obrigatórios devem ser preenchidos." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Formato de e-mail inválido." });
    }

    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
    }

    // Sanitizar slug
    const cleanSlug = slug
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, ""); // remove traços no início e fim

    if (!cleanSlug) {
      return res.status(400).json({ error: "O link do estabelecimento é inválido." });
    }

    // Verificar se slug já existe
    const existing = await query("SELECT id FROM tenants WHERE slug = $1 LIMIT 1", [cleanSlug]);
    if (existing.length > 0) {
      return res.status(400).json({ error: "Este link já está sendo utilizado por outro estabelecimento." });
    }

    // Verificar se usuário com este e-mail já existe
    const existingUser = await query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email.toLowerCase().trim()]);
    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Este e-mail de administrador já está cadastrado no sistema." });
    }

    // Definir accent color com base no theme color
    let accentColor = "bg-indigo-600 text-white";
    if (themeColor === "emerald") {
      accentColor = "bg-emerald-600 text-white";
    } else if (themeColor === "rose") {
      accentColor = "bg-rose-600 text-white";
    } else if (themeColor === "amber") {
      accentColor = "bg-amber-600 text-white";
    }

    const tenantId = `tenant-${Date.now()}`;

    // 1. Criar Tenant
    const newTenants = await query<Tenant>(
      `INSERT INTO tenants (id, name, slug, logo_url, description, theme_color, accent_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, slug, logo_url AS "logoUrl", description, theme_color AS "themeColor", accent_color AS "accentColor"`,
      [tenantId, name.trim(), cleanSlug, logoUrl || "🗓️", description.trim(), themeColor, accentColor]
    );

    const tenant = newTenants[0];

    // 2. Criar Provider (Profissional)
    const providerId = `provider-${Date.now()}`;
    await query(
      `INSERT INTO providers (id, tenant_id, category_id, name, email, bio) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [providerId, tenantId, null, ownerName.trim(), email.toLowerCase().trim(), "Administrador / Proprietário"]
    );

    // 3. Criar Usuário (com hash de senha)
    const userId = `user-${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, tenant_id, provider_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, email.toLowerCase().trim(), passwordHash, ownerName.trim(), 'provider', tenantId, providerId]
    );

    // 4. Gerar Token de Acesso JWT
    const secret = process.env.JWT_SECRET || "pulse-saas-secret-key-12345678";
    const token = jwt.sign(
      { userId, email: email.toLowerCase().trim(), name: ownerName.trim(), role: 'provider', tenantId, providerId },
      secret,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      tenant,
      token,
      user: { id: userId, email: email.toLowerCase().trim(), name: ownerName.trim(), role: 'provider', tenantId, providerId }
    });
  } catch (error) {
    console.error("Error creating tenant and provider:", error);
    res.status(500).json({ error: "Internal server error", details: (error as Error).message });
  }
});


// 2.5 Get Categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await query("SELECT id, name, slug, image_url AS \"imageUrl\" FROM categories ORDER BY name ASC");
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Internal server error", details: (error as Error).message });
  }
});

// 3. Get Providers for a Tenant
router.get('/providers', async (req, res) => {
  const { tenantId } = req.query;
  try {
    let providers;
    if (tenantId) {
      providers = await query<Provider>(
        `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, email, bio, avatar_url AS "avatarUrl", 
                COALESCE(service_location_type, 'own_space') AS "serviceLocationType"
         FROM providers WHERE tenant_id = $1`,
        [tenantId]
      );
    } else {
      providers = await query<Provider>(
        `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, email, bio, avatar_url AS "avatarUrl",
                COALESCE(service_location_type, 'own_space') AS "serviceLocationType"
         FROM providers`
      );
    }
    res.json(providers);
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ error: "Internal server error", details: (error as Error).message });
  }
});

// 4. Get Services (optionally filtered by providerId)
router.get('/services', async (req, res) => {
  const { providerId } = req.query;
  try {
    let services;
    if (providerId) {
      services = await query<Service>(
        `SELECT id, provider_id AS "providerId", name, description, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price 
         FROM services WHERE provider_id = $1`,
        [providerId]
      );
    } else {
      services = await query<Service>(
        `SELECT id, provider_id AS "providerId", name, description, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price 
         FROM services`
      );
    }
    // Convert price from string (Postgres numeric) to number
    const mapped = services.map(s => ({ ...s, price: Number(s.price) }));
    res.json(mapped);
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 5. Add Service
router.post('/services', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'provider') {
    return res.status(403).json({ error: "Apenas profissionais autenticados podem cadastrar serviços." });
  }

  const { providerId, name, description, durationMinutes, bufferMinutes, price } = req.body;
  const targetProviderId = providerId || user.providerId;

  if (user.providerId && user.providerId !== targetProviderId) {
    return res.status(403).json({ error: "Você não tem permissão para cadastrar serviços para outro profissional." });
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: "O nome do serviço é obrigatório." });
  }

  const duration = Number(durationMinutes);
  if (isNaN(duration) || duration <= 0 || duration > 720) {
    return res.status(400).json({ error: "A duração do serviço deve ser entre 1 e 720 minutos." });
  }

  const buffer = Number(bufferMinutes);
  if (isNaN(buffer) || buffer < 0 || buffer > 120) {
    return res.status(400).json({ error: "O tempo de intervalo deve ser entre 0 e 120 minutos." });
  }

  const servicePrice = Number(price);
  if (isNaN(servicePrice) || servicePrice < 0) {
    return res.status(400).json({ error: "O preço do serviço deve ser um valor numérico positivo." });
  }

  const newServiceId = "service-" + Date.now();
  try {
    const rows = await query<Service>(
      `INSERT INTO services (id, provider_id, name, description, duration_minutes, buffer_minutes, price) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, provider_id AS "providerId", name, description, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price`,
      [
        newServiceId,
        targetProviderId,
        name.trim(),
        description ? description.trim() : "",
        duration,
        buffer,
        servicePrice
      ]
    );
    const created = { ...rows[0], price: Number(rows[0].price) };
    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Edit Service
router.put('/services/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'provider') {
    return res.status(403).json({ error: "Apenas profissionais autenticados podem editar serviços." });
  }

  const { name, description, durationMinutes, bufferMinutes, price } = req.body;
  try {
    // Get existing service to verify ownership
    const serviceRows = await query<any>(`SELECT * FROM services WHERE id = $1`, [req.params.id]);
    if (serviceRows.length === 0) {
      return res.status(404).json({ error: "Serviço não encontrado." });
    }
    const current = serviceRows[0];

    if (user.providerId && user.providerId !== current.provider_id) {
      return res.status(403).json({ error: "Você não tem permissão para alterar serviços de outro profissional." });
    }

    const duration = durationMinutes !== undefined ? Number(durationMinutes) : current.duration_minutes;
    const buffer = bufferMinutes !== undefined ? Number(bufferMinutes) : current.buffer_minutes;
    const servicePrice = price !== undefined ? Number(price) : Number(current.price);

    const rows = await query<Service>(
      `UPDATE services 
       SET name = $1, description = $2, duration_minutes = $3, buffer_minutes = $4, price = $5 
       WHERE id = $6 
       RETURNING id, provider_id AS "providerId", name, description, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price`,
      [
        name ? name.trim() : current.name,
        description !== undefined ? description.trim() : current.description,
        duration,
        buffer,
        servicePrice,
        req.params.id
      ]
    );
    const updated = { ...rows[0], price: Number(rows[0].price) };
    res.json(updated);
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete Service
router.delete('/services/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'provider') {
    return res.status(403).json({ error: "Apenas profissionais autenticados podem excluir serviços." });
  }

  try {
    const serviceRows = await query<any>(`SELECT provider_id FROM services WHERE id = $1`, [req.params.id]);
    if (serviceRows.length === 0) {
      return res.status(404).json({ error: "Serviço não encontrado." });
    }

    if (user.providerId && user.providerId !== serviceRows[0].provider_id) {
      return res.status(403).json({ error: "Você não tem permissão para excluir serviços de outro profissional." });
    }

    await query(`DELETE FROM services WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting service:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 6. Get Availability Rules
router.get('/availability-rules', async (req, res) => {
  const { providerId } = req.query;
  try {
    let rules;
    if (providerId) {
      rules = await query<AvailabilityRule>(
        `SELECT id, provider_id AS "providerId", day_of_week AS "dayOfWeek", start_time AS "startTime", end_time AS "endTime" 
         FROM availability_rules WHERE provider_id = $1`,
        [providerId]
      );
    } else {
      rules = await query<AvailabilityRule>(
        `SELECT id, provider_id AS "providerId", day_of_week AS "dayOfWeek", start_time AS "startTime", end_time AS "endTime" 
         FROM availability_rules`
      );
    }
    res.json(rules);
  } catch (error) {
    console.error("Error fetching rules:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Set Availability Rules
router.put('/availability-rules', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'provider') {
    return res.status(403).json({ error: "Apenas profissionais autenticados podem alterar horários." });
  }

  const { providerId, rules } = req.body;
  const targetProviderId = providerId || user.providerId;

  if (user.providerId && user.providerId !== targetProviderId) {
    return res.status(403).json({ error: "Você não tem permissão para alterar a grade de outro profissional." });
  }

  if (!targetProviderId || !Array.isArray(rules)) {
    return res.status(400).json({ error: "Payload inválido. providerId e lista de rules são obrigatórios." });
  }

  try {
    await query(`DELETE FROM availability_rules WHERE provider_id = $1`, [targetProviderId]);

    const rulesToInsert: AvailabilityRule[] = [];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const newId = `rule-${targetProviderId}-${Date.now()}-${i}`;
      const rows = await query<AvailabilityRule>(
        `INSERT INTO availability_rules (id, provider_id, day_of_week, start_time, end_time) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, provider_id AS "providerId", day_of_week AS "dayOfWeek", start_time AS "startTime", end_time AS "endTime"`,
        [newId, targetProviderId, r.dayOfWeek, r.startTime, r.endTime]
      );
      rulesToInsert.push(rows[0]);
    }
    res.json(rulesToInsert);
  } catch (error) {
    console.error("Error setting availability rules:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 7. Get Availability Exceptions
router.get('/exceptions', async (req, res) => {
  const { providerId } = req.query;
  try {
    let exceptions;
    if (providerId) {
      exceptions = await query<AvailabilityException>(
        `SELECT id, provider_id AS "providerId", date, is_blocked AS "isBlocked", start_time AS "startTime", end_time AS "endTime" 
         FROM availability_exceptions WHERE provider_id = $1`,
        [providerId]
      );
    } else {
      exceptions = await query<AvailabilityException>(
        `SELECT id, provider_id AS "providerId", date, is_blocked AS "isBlocked", start_time AS "startTime", end_time AS "endTime" 
         FROM availability_exceptions`
      );
    }
    res.json(exceptions);
  } catch (error) {
    console.error("Error fetching exceptions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add Availability Exception
router.post('/exceptions', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'provider') {
    return res.status(403).json({ error: "Apenas profissionais autenticados podem gerenciar exceções." });
  }

  const { providerId, date, isBlocked, startTime, endTime } = req.body;
  const targetProviderId = providerId || user.providerId;

  if (user.providerId && user.providerId !== targetProviderId) {
    return res.status(403).json({ error: "Você não tem permissão para alterar a agenda de outro profissional." });
  }

  if (!targetProviderId || !date) {
    return res.status(400).json({ error: "providerId e date são obrigatórios." });
  }

  try {
    // Clear duplicate date/provider exception first
    await query(
      `DELETE FROM availability_exceptions WHERE provider_id = $1 AND date = $2`,
      [targetProviderId, date]
    );

    const newId = "except-" + Date.now();
    const rows = await query<AvailabilityException>(
      `INSERT INTO availability_exceptions (id, provider_id, date, is_blocked, start_time, end_time) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, provider_id AS "providerId", date, is_blocked AS "isBlocked", start_time AS "startTime", end_time AS "endTime"`,
      [newId, targetProviderId, date, !!isBlocked, startTime || null, endTime || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating exception:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete Availability Exception
router.delete('/exceptions/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'provider') {
    return res.status(403).json({ error: "Apenas profissionais autenticados podem remover exceções." });
  }

  try {
    const expRows = await query<any>(`SELECT provider_id FROM availability_exceptions WHERE id = $1`, [req.params.id]);
    if (expRows.length === 0) {
      return res.status(404).json({ error: "Exceção não encontrada." });
    }

    if (user.providerId && user.providerId !== expRows[0].provider_id) {
      return res.status(403).json({ error: "Você não tem permissão para remover exceções de outro profissional." });
    }

    await query(`DELETE FROM availability_exceptions WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting exception:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 8. Get Bookings
router.get('/bookings', async (req, res) => {
  const { providerId } = req.query;
  try {
    let bookings;
    if (providerId) {
      bookings = await query<any>(
        `SELECT id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", 
                client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes,
                client_address AS "clientAddress", service_location_type AS "serviceLocationType"
         FROM bookings WHERE provider_id = $1`,
        [providerId]
      );
    } else {
      bookings = await query<any>(
        `SELECT id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", 
                client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes,
                client_address AS "clientAddress", service_location_type AS "serviceLocationType"
         FROM bookings`
      );
    }
    
    // Map Date objects to ISO strings
    const mapped = bookings.map(b => ({
      ...b,
      startsAt: toISOString(b.startsAt),
      endsAt: toISOString(b.endsAt)
    }));
    res.json(mapped);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 9. Calculate Available Slots
router.get('/slots', async (req, res) => {
  const { serviceId, date } = req.query; // date: "YYYY-MM-DD"
  if (!serviceId || !date) {
    return res.status(400).json({ error: "serviceId and date are required" });
  }

  try {
    // 1. Fetch Service
    const services = await query<Service>(
      `SELECT id, provider_id AS "providerId", name, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price 
       FROM services WHERE id = $1 LIMIT 1`,
      [serviceId]
    );
    if (services.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    const service = services[0];

    // 2. Fetch Provider
    const providers = await query<Provider>(
      `SELECT id, tenant_id AS "tenantId", name, email, bio 
       FROM providers WHERE id = $1 LIMIT 1`,
      [service.providerId]
    );
    if (providers.length === 0) {
      return res.status(404).json({ error: "Provider not found" });
    }
    const provider = providers[0];

    // Determine Day of Week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dateObj = new Date(`${date}T00:00:00`);
    const dayOfWeek = dateObj.getDay();

    // 3. Resolve active availability windows for this provider/day
    // Check exceptions first
    const exceptions = await query<AvailabilityException>(
      `SELECT id, provider_id AS "providerId", date, is_blocked AS "isBlocked", start_time AS "startTime", end_time AS "endTime" 
       FROM availability_exceptions 
       WHERE provider_id = $1 AND date = $2 LIMIT 1`,
      [provider.id, date]
    );
    const exception = exceptions[0];

    let activeWindows: { start: string; end: string }[] = [];

    if (exception) {
      if (exception.isBlocked) {
        return res.json([]);
      } else if (exception.startTime && exception.endTime) {
        activeWindows.push({ start: exception.startTime, end: exception.endTime });
      }
    } else {
      // No exception, check weekly rules
      const rules = await query<AvailabilityRule>(
        `SELECT id, provider_id AS "providerId", day_of_week AS "dayOfWeek", start_time AS "startTime", end_time AS "endTime" 
         FROM availability_rules 
         WHERE provider_id = $1 AND day_of_week = $2`,
        [provider.id, dayOfWeek]
      );
      for (const rule of rules) {
        activeWindows.push({ start: rule.startTime, end: rule.endTime });
      }
    }

    if (activeWindows.length === 0) {
      return res.json([]);
    }

    // 4. Fetch bookings on date, with the corresponding service buffer joined
    const bookings = await query<any>(
      `SELECT b.id, b.starts_at AS "startsAt", b.ends_at AS "endsAt", b.client_name AS "clientName", s.buffer_minutes AS "bufferMinutes" 
       FROM bookings b 
       LEFT JOIN services s ON b.service_id = s.id 
       WHERE b.provider_id = $1 AND b.status != 'cancelled' AND b.starts_at::date = $2::date`,
      [provider.id, date]
    );

    const slots: TimeSlot[] = [];

    // Helper functions
    const timeToMinutes = (t: string): number => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const minutesToTime = (min: number): string => {
      const h = Math.floor(min / 60).toString().padStart(2, "0");
      const m = (min % 60).toString().padStart(2, "0");
      return `${h}:${m}`;
    };

    const duration = service.durationMinutes;
    const stepMinutes = duration <= 30 ? 15 : 30;

    // Map database date values to minutes from midnight
    const blockedRanges = bookings.map(b => {
      const startsAtStr = toISOString(b.startsAt);
      const endsAtStr = toISOString(b.endsAt);
      
      const bStartMin = timeToMinutes(startsAtStr.substring(11, 16));
      const bEndMin = timeToMinutes(endsAtStr.substring(11, 16));
      const bBuffer = Number(b.bufferMinutes) || 0;

      return {
        start: bStartMin,
        end: bEndMin + bBuffer,
        realEnd: bEndMin,
        bookingId: b.id,
        client: b.clientName
      };
    });

    // Generate slots
    for (const window of activeWindows) {
      const windowStart = timeToMinutes(window.start);
      const windowEnd = timeToMinutes(window.end);

      for (let startMin = windowStart; startMin <= windowEnd - duration; startMin += stepMinutes) {
        const endMin = startMin + duration;
        
        if (endMin > windowEnd) continue;

        let isAvailable = true;
        let conflictReason = "";

        for (const block of blockedRanges) {
          const coreOverlap = Math.max(startMin, block.start) < Math.min(endMin, block.realEnd);
          if (coreOverlap) {
            isAvailable = false;
            conflictReason = "Sobreposição com outro agendamento";
            break;
          }

          if (startMin >= block.start && startMin < block.end) {
            isAvailable = false;
            conflictReason = `Período de intervalo (buffer) do agendamento de ${block.client}`;
            break;
          }

          if (endMin > block.start - service.bufferMinutes && startMin < block.start) {
            isAvailable = false;
            conflictReason = `Intervalo de segurança necessário antes do agendamento de ${block.client}`;
            break;
          }
        }

        const timeStr = minutesToTime(startMin);
        const datetimeStr = `${date}T${timeStr}:00.000Z`;

        slots.push({
          time: timeStr,
          datetime: datetimeStr,
          available: isAvailable,
          reason: isAvailable ? undefined : conflictReason
        });
      }
    }

    slots.sort((a, b) => a.time.localeCompare(b.time));
    res.json(slots);
  } catch (error) {
    console.error("Error calculating slots:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 10. POST a booking (includes concurrency prevention constraint check)
router.post('/bookings', bookingRateLimiter, async (req, res) => {
  const { providerId, serviceId, startsAt, clientName, clientEmail, clientPhone, notes, clientAddress, serviceLocationType } = req.body;
  
  if (!providerId || !serviceId || !startsAt || !clientName || !clientEmail || !clientPhone) {
    return res.status(400).json({ error: "Todos os campos obrigatórios devem ser preenchidos." });
  }

  if (!isValidEmail(clientEmail)) {
    return res.status(400).json({ error: "Formato de e-mail inválido." });
  }

  const trimmedName = String(clientName).trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    return res.status(400).json({ error: "O nome deve ter entre 2 e 100 caracteres." });
  }

  const trimmedPhone = String(clientPhone).trim();
  if (trimmedPhone.length < 8 || trimmedPhone.length > 25) {
    return res.status(400).json({ error: "Número de telefone/WhatsApp inválido." });
  }

  try {
    // 1. Fetch Provider to check serviceLocationType
    const providerRows = await query<any>(
      `SELECT id, COALESCE(service_location_type, 'own_space') AS "serviceLocationType" FROM providers WHERE id = $1 LIMIT 1`,
      [providerId]
    );
    const provider = providerRows.length > 0 ? providerRows[0] : null;
    
    // If provider only attends at client, clientAddress is mandatory
    if (provider?.serviceLocationType === 'at_client' && (!clientAddress || String(clientAddress).trim().length < 5)) {
      return res.status(400).json({ error: "O endereço completo de atendimento é obrigatório para este profissional." });
    }

    // 2. Fetch Service
    const services = await query<Service>(
      `SELECT id, provider_id AS "providerId", name, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price 
       FROM services WHERE id = $1 LIMIT 1`,
      [serviceId]
    );
    if (services.length === 0) {
      return res.status(404).json({ error: "Serviço não encontrado." });
    }
    const service = services[0];

    // Calculate endsAt
    const startObj = new Date(startsAt);
    if (isNaN(startObj.getTime())) {
      return res.status(400).json({ error: "Data ou horário de início inválido." });
    }

    const endObj = new Date(startObj.getTime() + service.durationMinutes * 60 * 1000);
    const endsAt = endObj.toISOString();

    const requestedStartMin = startObj.getUTCHours() * 60 + startObj.getUTCMinutes();
    const requestedEndMin = requestedStartMin + service.durationMinutes;
    const dateStr = startsAt.substring(0, 10);

    // 3. Fetch existing active bookings on the same day to prevent overlaps
    const existingBookings = await query<any>(
      `SELECT b.id, b.starts_at AS "startsAt", b.ends_at AS "endsAt", s.buffer_minutes AS "bufferMinutes" 
       FROM bookings b 
       LEFT JOIN services s ON b.service_id = s.id 
       WHERE b.provider_id = $1 AND b.status != 'cancelled' AND b.starts_at::date = $2::date`,
      [providerId, dateStr]
    );

    // Concurrency overlap validation
    for (const b of existingBookings) {
      const bStartObj = new Date(b.startsAt);
      const bEndObj = new Date(b.endsAt);
      
      const bStartMin = bStartObj.getUTCHours() * 60 + bStartObj.getUTCMinutes();
      const bEndMin = bStartMin + (bEndObj.getTime() - bStartObj.getTime()) / (60 * 1000);
      const bBuffer = Number(b.bufferMinutes) || 0;

      // Core overlap checking
      const coreOverlap = Math.max(requestedStartMin, bStartMin) < Math.min(requestedEndMin, bEndMin);
      if (coreOverlap) {
        return res.status(409).json({ 
          error: "slot_unavailable", 
          message: "O horário selecionado já foi reservado por outro cliente." 
        });
      }

      // Check existing booking buffer violation
      if (requestedStartMin >= bStartMin && requestedStartMin < (bEndMin + bBuffer)) {
        return res.status(409).json({
          error: "slot_unavailable",
          message: "Conflito com o período de preparação/intervalo do agendamento anterior."
        });
      }

      // Check current service buffer violation before next booking
      if (requestedEndMin > (bStartMin - service.bufferMinutes) && requestedStartMin < bStartMin) {
        return res.status(409).json({
          error: "slot_unavailable",
          message: "Este horário não oferece o intervalo necessário antes da próxima reserva."
        });
      }
    }

    // 4. Insert new booking
    const newId = "booking-" + Date.now();
    const rows = await query<Booking>(
      `INSERT INTO bookings (id, provider_id, service_id, starts_at, ends_at, client_name, client_email, client_phone, status, notes, client_address, service_location_type) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       RETURNING id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", 
                 client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes,
                 client_address AS "clientAddress", service_location_type AS "serviceLocationType"`,
      [
        newId,
        providerId,
        serviceId,
        startsAt,
        endsAt,
        trimmedName,
        clientEmail.toLowerCase().trim(),
        trimmedPhone,
        'confirmed', // confirmed automatically
        notes ? String(notes).trim().slice(0, 500) : null,
        clientAddress ? String(clientAddress).trim().slice(0, 300) : null,
        serviceLocationType || provider?.serviceLocationType || 'own_space'
      ]
    );

    const created = {
      ...rows[0],
      startsAt: toISOString(rows[0].startsAt),
      endsAt: toISOString(rows[0].endsAt)
    };
    res.status(201).json(created);
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 11. Update booking status
router.patch('/bookings/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: "status is required" });
  }

  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  try {
    const bookingRows = await query<any>(
      `SELECT provider_id AS "providerId", client_email AS "clientEmail" FROM bookings WHERE id = $1`,
      [req.params.id]
    );
    if (bookingRows.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }
    const booking = bookingRows[0];

    // Authorization checks
    if (user.role === 'client') {
      if (user.email !== booking.clientEmail || status !== 'cancelled') {
        return res.status(403).json({ error: "Não autorizado a alterar este agendamento." });
      }
    } else if (user.role === 'provider') {
      if (user.providerId !== booking.providerId) {
        return res.status(403).json({ error: "Não autorizado a alterar este agendamento." });
      }
    }

    const rows = await query<Booking>(
      `UPDATE bookings SET status = $1 WHERE id = $2 
       RETURNING id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes`,
      [status, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }
    const updated = {
      ...rows[0],
      startsAt: toISOString(rows[0].startsAt),
      endsAt: toISOString(rows[0].endsAt)
    };
    res.json(updated);
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 12. Delete booking
router.delete('/bookings/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  try {
    const bookingRows = await query<any>(
      `SELECT provider_id AS "providerId", client_email AS "clientEmail" FROM bookings WHERE id = $1`,
      [req.params.id]
    );
    if (bookingRows.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }
    const booking = bookingRows[0];

    // Ownership authorization verification
    const isOwnerProvider = user.role === 'provider' && user.providerId === booking.providerId;
    const isOwnerClient = user.role === 'client' && user.email === booking.clientEmail;

    if (!isOwnerProvider && !isOwnerClient) {
      return res.status(403).json({ error: "Você não tem permissão para excluir este agendamento." });
    }

    await query(`DELETE FROM bookings WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Authentication Endpoints ---

// Auth: Register Client / Provider
router.post('/auth/register', authRateLimiter, async (req, res) => {
  const { email, password, name, role, tenantId, categoryId, bio, serviceLocationType } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "E-mail, senha e nome são obrigatórios." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Formato de e-mail inválido." });
  }

  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres." });
  }

  const validLocationType = ['own_space', 'at_client', 'both'].includes(serviceLocationType) 
    ? serviceLocationType 
    : 'own_space';

  try {
    const cleanEmail = email.toLowerCase().trim();
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Este e-mail já está cadastrado." });
    }

    const id = "user-" + Date.now();
    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role === 'provider' ? 'provider' : 'client';
    let providerId: string | null = null;

    if (userRole === 'provider') {
      providerId = "provider-" + Date.now();
      await query(
        `INSERT INTO providers (id, tenant_id, category_id, name, email, bio, service_location_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [providerId, tenantId || 'tenant-1', categoryId || null, String(name).trim(), cleanEmail, bio ? String(bio).trim() : '', validLocationType]
      );
    }
    
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, tenant_id, provider_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, cleanEmail, passwordHash, String(name).trim(), userRole, tenantId || null, providerId]
    );

    const secret = process.env.JWT_SECRET || "pulse-saas-secret-key-12345678";
    
    const token = jwt.sign(
      { userId: id, email: cleanEmail, name: String(name).trim(), role: userRole, tenantId: tenantId || null, providerId },
      secret,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: { id, email: email.toLowerCase(), name, role: userRole, tenantId: tenantId || null, providerId }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Auth: Login
router.post('/auth/login', authRateLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Formato de e-mail inválido." });
  }

  try {
    const cleanEmail = email.toLowerCase().trim();
    const users = await query(
      `SELECT id, email, password_hash AS "passwordHash", name, role, tenant_id AS "tenantId", provider_id AS "providerId" 
       FROM users WHERE email = $1 LIMIT 1`,
      [cleanEmail]
    );
    if (users.length === 0) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: "Credenciais inválidas." });
    }

    const secret = process.env.JWT_SECRET || "pulse-saas-secret-key-12345678";

    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      providerId: user.providerId
    };

    const token = jwt.sign(payload, secret, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        providerId: user.providerId
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Auth: Social Login
router.post('/auth/social-login', authRateLimiter, async (req, res) => {
  const { email, name, provider } = req.body;
  if (!email || !name || !provider) {
    return res.status(400).json({ error: "E-mail, nome e provedor são obrigatórios." });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Formato de e-mail inválido." });
  }

  try {
    const emailLower = email.toLowerCase().trim();
    let users = await query<any>(
      `SELECT id, email, name, role, tenant_id AS "tenantId", provider_id AS "providerId", avatar_url AS "avatarUrl" 
       FROM users WHERE email = $1 LIMIT 1`,
      [emailLower]
    );

    let user;
    if (users.length === 0) {
      const id = "user-" + Date.now();
      const passwordHash = await bcrypt.hash("social-oauth-token-" + Date.now(), 10);
      
      const avatarUrl = provider === 'instagram' 
        ? "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=80&h=80&q=80" 
        : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80&q=80";

      await query(
        `INSERT INTO users (id, email, password_hash, name, role, avatar_url) VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, emailLower, passwordHash, name, 'client', avatarUrl]
      );

      user = {
        id,
        email: emailLower,
        name,
        role: 'client',
        avatarUrl
      };
    } else {
      user = users[0];
    }

    const secret = process.env.JWT_SECRET || "pulse-saas-secret-key-12345678";
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      providerId: user.providerId,
      avatarUrl: user.avatarUrl
    };

    const token = jwt.sign(payload, secret, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        providerId: user.providerId,
        avatarUrl: user.avatarUrl
      }
    });
  } catch (error) {
    console.error("Social login error:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Auth: Get Profile
router.get('/auth/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// --- Protected Booking Management Endpoints ---

// Get My Bookings (for Client or Provider)
router.get('/bookings/my', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  try {
    let bookings;
    if (user.role === 'client') {
      bookings = await query<any>(
        `SELECT b.id, b.provider_id AS "providerId", b.service_id AS "serviceId", b.starts_at AS "startsAt", b.ends_at AS "endsAt", 
                b.client_name AS "clientName", b.client_email AS "clientEmail", b.client_phone AS "clientPhone", b.status, b.notes,
                b.client_address AS "clientAddress", b.service_location_type AS "serviceLocationType",
                s.name AS "serviceName", p.name AS "providerName"
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         LEFT JOIN providers p ON b.provider_id = p.id
         WHERE b.client_email = $1
         ORDER BY b.starts_at DESC`,
        [user.email]
      );
    } else {
      bookings = await query<any>(
        `SELECT b.id, b.provider_id AS "providerId", b.service_id AS "serviceId", b.starts_at AS "startsAt", b.ends_at AS "endsAt", 
                b.client_name AS "clientName", b.client_email AS "clientEmail", b.client_phone AS "clientPhone", b.status, b.notes,
                b.client_address AS "clientAddress", b.service_location_type AS "serviceLocationType",
                s.name AS "serviceName", p.name AS "providerName"
         FROM bookings b
         LEFT JOIN services s ON b.service_id = s.id
         LEFT JOIN providers p ON b.provider_id = p.id
         WHERE b.provider_id = $1
         ORDER BY b.starts_at DESC`,
        [user.providerId]
      );
    }

    const mapped = bookings.map(b => ({
      ...b,
      startsAt: toISOString(b.startsAt),
      endsAt: toISOString(b.endsAt)
    }));
    res.json(mapped);
  } catch (error) {
    console.error("Error fetching my bookings:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Reschedule Booking
router.patch('/bookings/:id/reschedule', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { startsAt } = req.body;
  const bookingId = req.params.id;
  const user = req.user;

  if (!startsAt) {
    return res.status(400).json({ error: "Data/hora de início é obrigatória." });
  }
  if (!user) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  try {
    // Fetch booking
    const bookings = await query<any>(
      `SELECT id, provider_id AS "providerId", service_id AS "serviceId", client_email AS "clientEmail" 
       FROM bookings WHERE id = $1 LIMIT 1`,
      [bookingId]
    );
    if (bookings.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }
    const booking = bookings[0];

    // Auth validation
    if (user.role === 'client' && user.email !== booking.clientEmail) {
      return res.status(403).json({ error: "Você não tem permissão para alterar este agendamento." });
    }
    if (user.role === 'provider' && user.providerId !== booking.providerId) {
      return res.status(403).json({ error: "Você não tem permissão para alterar este agendamento." });
    }

    // Fetch Service
    const services = await query<Service>(
      `SELECT id, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes" 
       FROM services WHERE id = $1 LIMIT 1`,
      [booking.serviceId]
    );
    if (services.length === 0) {
      return res.status(404).json({ error: "Serviço não encontrado." });
    }
    const service = services[0];

    const startObj = new Date(startsAt);
    const endObj = new Date(startObj.getTime() + service.durationMinutes * 60 * 1000);
    const endsAt = endObj.toISOString();

    const requestedStartMin = startObj.getUTCHours() * 60 + startObj.getUTCMinutes();
    const requestedEndMin = requestedStartMin + service.durationMinutes;
    const dateStr = startsAt.substring(0, 10);

    // Fetch bookings (excluding current)
    const existingBookings = await query<any>(
      `SELECT b.id, b.starts_at AS "startsAt", b.ends_at AS "endsAt", s.buffer_minutes AS "bufferMinutes" 
       FROM bookings b 
       LEFT JOIN services s ON b.service_id = s.id 
       WHERE b.provider_id = $1 AND b.status != 'cancelled' AND b.starts_at::date = $2::date AND b.id != $3`,
      [booking.providerId, dateStr, bookingId]
    );

    // Check overlap
    for (const b of existingBookings) {
      const bStartObj = new Date(b.startsAt);
      const bEndObj = new Date(b.endsAt);
      
      const bStartMin = bStartObj.getUTCHours() * 60 + bStartObj.getUTCMinutes();
      const bEndMin = bStartMin + (bEndObj.getTime() - bStartObj.getTime()) / (60 * 1000);
      const bBuffer = Number(b.bufferMinutes) || 0;

      const coreOverlap = Math.max(requestedStartMin, bStartMin) < Math.min(requestedEndMin, bEndMin);
      if (coreOverlap) {
        return res.status(409).json({ 
          error: "slot_unavailable", 
          message: "O horário selecionado já foi reservado por outro cliente." 
        });
      }

      if (requestedStartMin >= bStartMin && requestedStartMin < (bEndMin + bBuffer)) {
        return res.status(409).json({
          error: "slot_unavailable",
          message: "Conflito com o período de preparação/intervalo do agendamento anterior."
        });
      }

      if (requestedEndMin > (bStartMin - service.bufferMinutes) && requestedStartMin < bStartMin) {
        return res.status(409).json({
          error: "slot_unavailable",
          message: "Este horário não oferece o intervalo necessário antes da próxima reserva."
        });
      }
    }

    // Update
    const rows = await query<Booking>(
      `UPDATE bookings 
       SET starts_at = $1, ends_at = $2 
       WHERE id = $3 
       RETURNING id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes`,
      [startsAt, endsAt, bookingId]
    );

    const updated = {
      ...rows[0],
      startsAt: toISOString(rows[0].startsAt),
      endsAt: toISOString(rows[0].endsAt)
    };
    res.json(updated);
  } catch (error) {
    console.error("Reschedule booking error:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

export default router;
