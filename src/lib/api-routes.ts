import { Router } from 'express';
import { query } from './db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authMiddleware, AuthenticatedRequest } from './auth-middleware.js';
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

// Helper to convert Date object or string to UTC ISO string
const toISOString = (val: any): string => {
  if (!val) return '';
  const d = val instanceof Date ? val : new Date(val);
  return d.toISOString();
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
    res.status(500).json({ error: "Internal server error", details: (error as Error).message });
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

// 3. Get Providers for a Tenant
router.get('/providers', async (req, res) => {
  const { tenantId } = req.query;
  try {
    let providers;
    if (tenantId) {
      providers = await query<Provider>(
        `SELECT id, tenant_id AS "tenantId", name, email, bio, avatar_url AS "avatarUrl" 
         FROM providers WHERE tenant_id = $1`,
        [tenantId]
      );
    } else {
      providers = await query<Provider>(
        `SELECT id, tenant_id AS "tenantId", name, email, bio, avatar_url AS "avatarUrl" 
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
router.post('/services', async (req, res) => {
  const newServiceId = "service-" + Date.now();
  const { providerId, name, description, durationMinutes, bufferMinutes, price } = req.body;
  try {
    const rows = await query<Service>(
      `INSERT INTO services (id, provider_id, name, description, duration_minutes, buffer_minutes, price) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, provider_id AS "providerId", name, description, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price`,
      [
        newServiceId,
        providerId,
        name,
        description || "",
        Number(durationMinutes) || 30,
        Number(bufferMinutes) || 0,
        Number(price) || 0
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
router.put('/services/:id', async (req, res) => {
  const { name, description, durationMinutes, bufferMinutes, price } = req.body;
  try {
    // Get existing service to handle fallback values
    const serviceRows = await query<Service>(`SELECT * FROM services WHERE id = $1`, [req.params.id]);
    if (serviceRows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    const current = serviceRows[0];

    const rows = await query<Service>(
      `UPDATE services 
       SET name = $1, description = $2, duration_minutes = $3, buffer_minutes = $4, price = $5 
       WHERE id = $6 
       RETURNING id, provider_id AS "providerId", name, description, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price`,
      [
        name || current.name,
        description !== undefined ? description : current.description,
        durationMinutes !== undefined ? Number(durationMinutes) : current.durationMinutes,
        bufferMinutes !== undefined ? Number(bufferMinutes) : current.bufferMinutes,
        price !== undefined ? Number(price) : Number(current.price),
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
router.delete('/services/:id', async (req, res) => {
  try {
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
router.put('/availability-rules', async (req, res) => {
  const { providerId, rules } = req.body;
  if (!providerId || !Array.isArray(rules)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    // We execute inside a transaction if we want, or just delete and insert
    await query(`DELETE FROM availability_rules WHERE provider_id = $1`, [providerId]);

    const rulesToInsert: AvailabilityRule[] = [];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const newId = `rule-${providerId}-${Date.now()}-${i}`;
      const rows = await query<AvailabilityRule>(
        `INSERT INTO availability_rules (id, provider_id, day_of_week, start_time, end_time) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, provider_id AS "providerId", day_of_week AS "dayOfWeek", start_time AS "startTime", end_time AS "endTime"`,
        [newId, providerId, r.dayOfWeek, r.startTime, r.endTime]
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
router.post('/exceptions', async (req, res) => {
  const { providerId, date, isBlocked, startTime, endTime } = req.body;
  if (!providerId || !date) {
    return res.status(400).json({ error: "providerId and date are required" });
  }

  try {
    // Clear duplicate date/provider exception first
    await query(
      `DELETE FROM availability_exceptions WHERE provider_id = $1 AND date = $2`,
      [providerId, date]
    );

    const newId = "except-" + Date.now();
    const rows = await query<AvailabilityException>(
      `INSERT INTO availability_exceptions (id, provider_id, date, is_blocked, start_time, end_time) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, provider_id AS "providerId", date, is_blocked AS "isBlocked", start_time AS "startTime", end_time AS "endTime"`,
      [newId, providerId, date, !!isBlocked, startTime || null, endTime || null]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Error creating exception:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete Availability Exception
router.delete('/exceptions/:id', async (req, res) => {
  try {
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
        `SELECT id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes 
         FROM bookings WHERE provider_id = $1`,
        [providerId]
      );
    } else {
      bookings = await query<any>(
        `SELECT id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes 
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
router.post('/bookings', async (req, res) => {
  const { providerId, serviceId, startsAt, clientName, clientEmail, clientPhone, notes } = req.body;
  
  if (!providerId || !serviceId || !startsAt || !clientName || !clientEmail || !clientPhone) {
    return res.status(400).json({ error: "Missing required fields" });
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

    // Calculate endsAt
    const startObj = new Date(startsAt);
    const endObj = new Date(startObj.getTime() + service.durationMinutes * 60 * 1000);
    const endsAt = endObj.toISOString();

    const requestedStartMin = startObj.getUTCHours() * 60 + startObj.getUTCMinutes();
    const requestedEndMin = requestedStartMin + service.durationMinutes;
    const dateStr = startsAt.substring(0, 10);

    // 2. Fetch existing active bookings on the same day to prevent overlaps
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

    // 3. Insert new booking
    const newId = "booking-" + Date.now();
    const rows = await query<Booking>(
      `INSERT INTO bookings (id, provider_id, service_id, starts_at, ends_at, client_name, client_email, client_phone, status, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes`,
      [
        newId,
        providerId,
        serviceId,
        startsAt,
        endsAt,
        clientName,
        clientEmail,
        clientPhone,
        'confirmed', // confirmed automatically
        notes || null
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
router.delete('/bookings/:id', async (req, res) => {
  try {
    await query(`DELETE FROM bookings WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Authentication Endpoints ---

// Auth: Register Client
router.post('/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "E-mail, senha e nome são obrigatórios." });
  }

  try {
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Este e-mail já está cadastrado." });
    }

    const id = "user-" + Date.now();
    const passwordHash = await bcrypt.hash(password, 10);
    
    await query(
      `INSERT INTO users (id, email, password_hash, name, role) VALUES ($1, $2, $3, $4, $5)`,
      [id, email.toLowerCase(), passwordHash, name, 'client']
    );

    const secret = process.env.JWT_SECRET || "pulse-saas-secret-key-12345678";
    
    const token = jwt.sign(
      { userId: id, email: email.toLowerCase(), name, role: 'client' },
      secret,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: { id, email: email.toLowerCase(), name, role: 'client' }
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

// Auth: Login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }

  try {
    const users = await query(
      `SELECT id, email, password_hash AS "passwordHash", name, role, tenant_id AS "tenantId", provider_id AS "providerId" 
       FROM users WHERE email = $1 LIMIT 1`,
      [email.toLowerCase()]
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
