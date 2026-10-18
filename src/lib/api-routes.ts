import { Router } from 'express';
import { query, pool } from './db.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { authMiddleware, AuthenticatedRequest, getJwtSecret } from './auth-middleware.js';
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

// 2.1 Create New Tenant
router.post('/tenants', tenantRateLimiter, async (req, res) => {
  try {
    // Fail before any database write if JWT issuance cannot be configured.
    const secret = getJwtSecret();
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
    const providerId = `provider-${Date.now()}`;
    const userId = `user-${Date.now()}`;
    const passwordHash = await bcrypt.hash(password, 10);

    const client = await pool.connect();
    let tenant: Tenant;
    try {
      await client.query('BEGIN');

      // 1. Criar Tenant
      const newTenants = await client.query(
        `INSERT INTO tenants (id, name, slug, logo_url, description, theme_color, accent_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, slug, logo_url AS "logoUrl", description, theme_color AS "themeColor", accent_color AS "accentColor"`,
        [tenantId, name.trim(), cleanSlug, logoUrl || "🗓️", description.trim(), themeColor, accentColor]
      );
      tenant = newTenants.rows[0];

      // 2. Criar Provider (Profissional)
      await client.query(
        `INSERT INTO providers (id, tenant_id, category_id, name, email, bio) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [providerId, tenantId, null, ownerName.trim(), email.toLowerCase().trim(), "Administrador / Proprietário"]
      );

      // 3. Criar Usuário (com hash de senha)
      await client.query(
        `INSERT INTO users (id, email, password_hash, name, role, tenant_id, provider_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, email.toLowerCase().trim(), passwordHash, ownerName.trim(), 'provider', tenantId, providerId]
      );

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    // 4. Gerar Token de Acesso JWT
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
    res.status(500).json({ error: "Erro interno ao criar estabelecimento." });
  }
});
// 2.5 Get Categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await query("SELECT id, name, slug, image_url AS \"imageUrl\" FROM categories ORDER BY name ASC");
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Erro interno ao buscar categorias." });
  }
});

// 3. Get Providers for a Tenant
router.get('/providers', async (req, res) => {
  const { tenantId } = req.query;
  try {
    let providers;
    if (tenantId) {
      providers = await query<Provider>(
        `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, bio, avatar_url AS "avatarUrl" 
         FROM providers WHERE tenant_id = $1`,
        [tenantId]
      );
    } else {
      providers = await query<Provider>(
        `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, bio, avatar_url AS "avatarUrl" 
         FROM providers`
      );
    }
    res.json(providers);
  } catch (error) {
    console.error("Error fetching providers:", error);
    res.status(500).json({ error: "Erro interno ao buscar profissionais." });
  }
});

// Update Provider and Tenant Settings
router.put('/provider/settings', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'provider' || !user.providerId) {
    return res.status(403).json({ error: "Apenas profissionais autenticados podem alterar configurações de perfil." });
  }

  const { 
    name, 
    email, 
    password, 
    bio, 
    avatarUrl, 
    serviceLocationType, 
    slug, 
    themeColor,
    tenantName,
    tenantDescription 
  } = req.body;

  try {
    // 1. Validate Email if provided
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: "E-mail inválido." });
    }

    const userId = user.userId || (user as any).id;

    // Check if new email already belongs to another user
    if (email && email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
      const existingUser = await query(`SELECT id FROM users WHERE email = $1 AND id != $2`, [email.toLowerCase().trim(), userId]);
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "Este e-mail já está sendo utilizado por outro usuário." });
      }
    }

    // 2. Validate Password if provided
    let passwordHash: string | null = null;
    if (password) {
      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
      }
      passwordHash = await bcrypt.hash(password, 10);
    }

    // 3. Validate serviceLocationType
    const validLocations = ['own_space', 'at_client', 'both'];
    const locationType = serviceLocationType && validLocations.includes(serviceLocationType)
      ? serviceLocationType
      : 'both';

    // 4. Update Database within Transaction
    const targetEmail = email ? email.toLowerCase().trim() : user.email;
    const targetName = name ? name.trim() : user.name;

    const client = await pool.connect();
    let updatedTenant: any = null;
    let updatedProvider: any = null;

    try {
      await client.query('BEGIN');

      // Update Users Table
      if (passwordHash) {
        await client.query(
          `UPDATE users SET name = $1, email = $2, password_hash = $3, avatar_url = $4 WHERE id = $5`,
          [targetName, targetEmail, passwordHash, avatarUrl || null, userId]
        );
      } else {
        await client.query(
          `UPDATE users SET name = $1, email = $2, avatar_url = $3 WHERE id = $4`,
          [targetName, targetEmail, avatarUrl || null, userId]
        );
      }

      // Update Providers Table
      await client.query(
        `UPDATE providers 
         SET name = $1, email = $2, bio = $3, avatar_url = $4, service_location_type = $5 
         WHERE id = $6`,
        [targetName, targetEmail, bio || '', avatarUrl || null, locationType, user.providerId]
      );

      // Update Tenant Table (if tenantId is associated)
      if (user.tenantId) {
        let cleanSlug = slug ? slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-') : null;
        if (cleanSlug) {
          const existingTenantSlug = await client.query(`SELECT id FROM tenants WHERE slug = $1 AND id != $2`, [cleanSlug, user.tenantId]);
          if (existingTenantSlug.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Esta URL/Slug já está em uso por outro estabelecimento." });
          }
        }

        await client.query(
          `UPDATE tenants 
           SET name = COALESCE($1, name), 
               slug = COALESCE($2, slug), 
               description = COALESCE($3, description), 
               theme_color = COALESCE($4, theme_color),
               logo_url = COALESCE($5, logo_url)
           WHERE id = $6`,
          [tenantName || targetName, cleanSlug, tenantDescription || bio, themeColor || null, avatarUrl || null, user.tenantId]
        );

        const tRes = await client.query(
          `SELECT id, name, slug, logo_url AS "logoUrl", description, theme_color AS "themeColor", accent_color AS "accentColor" 
           FROM tenants WHERE id = $1`,
          [user.tenantId]
        );
        if (tRes.rows.length > 0) updatedTenant = tRes.rows[0];
      }

      // Fetch updated provider
      const provRes = await client.query(
        `SELECT id, tenant_id AS "tenantId", category_id AS "categoryId", name, email, bio, avatar_url AS "avatarUrl",
                COALESCE(service_location_type, 'own_space') AS "serviceLocationType"
         FROM providers WHERE id = $1`,
        [user.providerId]
      );
      updatedProvider = provRes.rows[0];

      await client.query('COMMIT');
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      provider: updatedProvider,
      tenant: updatedTenant,
      user: {
        id: userId,
        email: targetEmail,
        name: targetName,
        role: user.role,
        tenantId: user.tenantId,
        providerId: user.providerId,
        avatarUrl: avatarUrl || null
      }
    });
  } catch (error) {
    console.error("Error updating provider settings:", error);
    res.status(500).json({ error: "Erro interno ao atualizar configurações." });
  }
});

// 4. Get Services (optionally filtered by providerId or tenantId)
router.get('/services', async (req, res) => {
  const { providerId, tenantId } = req.query;
  try {
    let services;
    if (providerId) {
      services = await query<Service>(
        `SELECT id, provider_id AS "providerId", name, description, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price 
         FROM services WHERE provider_id = $1`,
        [providerId]
      );
    } else if (tenantId) {
      services = await query<Service>(
        `SELECT s.id, s.provider_id AS "providerId", s.name, s.description, s.duration_minutes AS "durationMinutes", s.buffer_minutes AS "bufferMinutes", s.price 
         FROM services s
         INNER JOIN providers p ON s.provider_id = p.id
         WHERE p.tenant_id = $1`,
        [tenantId]
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
  if (!user || user.role !== 'provider' || !user.providerId) return res.status(403).json({ error: "Apenas o profissional responsável pode criar serviços." });
  const newServiceId = "service-" + Date.now();
  const { name, description, durationMinutes, bufferMinutes, price } = req.body;
  const providerId = user.providerId;
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
router.put('/services/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'provider' || !user.providerId) return res.status(403).json({ error: "Apenas o profissional responsável pode editar serviços." });
  const { name, description, durationMinutes, bufferMinutes, price } = req.body;
  try {
    // Get existing service to handle fallback values
    const serviceRows = await query<Service>(`SELECT * FROM services WHERE id = $1 AND provider_id = $2`, [req.params.id, user.providerId]);
    if (serviceRows.length === 0) {
      return res.status(404).json({ error: "Service not found" });
    }
    const current = serviceRows[0];

    const rows = await query<Service>(
      `UPDATE services 
       SET name = $1, description = $2, duration_minutes = $3, buffer_minutes = $4, price = $5 
       WHERE id = $6 AND provider_id = $7
       RETURNING id, provider_id AS "providerId", name, description, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price`,
      [
        name || current.name,
        description !== undefined ? description : current.description,
        durationMinutes !== undefined ? Number(durationMinutes) : current.durationMinutes,
        bufferMinutes !== undefined ? Number(bufferMinutes) : current.bufferMinutes,
        price !== undefined ? Number(price) : Number(current.price),
        req.params.id,
        user.providerId
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Service not found" });
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
  if (!user || user.role !== 'provider' || !user.providerId) return res.status(403).json({ error: "Apenas o profissional responsável pode excluir serviços." });
  try {
    const deleted = await query(`DELETE FROM services WHERE id = $1 AND provider_id = $2 RETURNING id`, [req.params.id, user.providerId]);
    if (deleted.length === 0) return res.status(404).json({ error: "Serviço não encontrado." });
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
  if (!user || user.role !== 'provider' || !user.providerId) {
    return res.status(403).json({ error: "Apenas profissionais autenticados podem alterar horários." });
  }

  const { providerId, rules } = req.body;
  const targetProviderId = providerId || user.providerId;

  if (user.providerId !== targetProviderId) {
    return res.status(403).json({ error: "Você não tem permissão para alterar a grade de outro profissional." });
  }

  if (!targetProviderId || !Array.isArray(rules)) {
    return res.status(400).json({ error: "Payload inválido. providerId e lista de rules são obrigatórios." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM availability_rules WHERE provider_id = $1`, [targetProviderId]);

    const rulesToInsert: AvailabilityRule[] = [];
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      const newId = `rule-${targetProviderId}-${Date.now()}-${i}`;
      const rows = await client.query(
        `INSERT INTO availability_rules (id, provider_id, day_of_week, start_time, end_time) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING id, provider_id AS "providerId", day_of_week AS "dayOfWeek", start_time AS "startTime", end_time AS "endTime"`,
        [newId, targetProviderId, r.dayOfWeek, r.startTime, r.endTime]
      );
      rulesToInsert.push(rows.rows[0]);
    }
    await client.query('COMMIT');
    res.json(rulesToInsert);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error setting availability rules:", error);
    res.status(500).json({ error: "Erro interno ao atualizar horários de disponibilidade." });
  } finally {
    client.release();
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
    res.status(500).json({ error: "Erro interno ao buscar exceções." });
  }
});

// Add Availability Exception
router.post('/exceptions', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user || user.role !== 'provider' || !user.providerId) {
    return res.status(403).json({ error: "Apenas profissionais autenticados podem gerenciar exceções." });
  }

  const { providerId, date, isBlocked, startTime, endTime } = req.body;
  const targetProviderId = providerId || user.providerId;

  if (user.providerId !== targetProviderId) {
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
    res.status(500).json({ error: "Erro interno ao criar exceção." });
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

    if (!user.providerId || user.providerId !== expRows[0].provider_id) {
      return res.status(403).json({ error: "Você não tem permissão para remover exceções de outro profissional." });
    }

    await query(`DELETE FROM availability_exceptions WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting exception:", error);
    res.status(500).json({ error: "Erro interno ao excluir exceção." });
  }
});

// 8. Get Bookings (Protected - Only Providers can list their bookings or Clients their own)
router.get('/bookings', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Acesso não autorizado." });
  }

  const { providerId } = req.query;

  try {
    let bookings;
    if (user.role === 'provider') {
      const targetProviderId = (providerId as string) || user.providerId;
      if (user.providerId && user.providerId !== targetProviderId) {
        return res.status(403).json({ error: "Você não tem permissão para visualizar agendamentos de outro profissional." });
      }

      bookings = await query<any>(
        `SELECT id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", 
                client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes,
                client_address AS "clientAddress", service_location_type AS "serviceLocationType"
         FROM bookings WHERE provider_id = $1
         ORDER BY starts_at ASC`,
        [targetProviderId]
      );
    } else if (user.role === 'client') {
      bookings = await query<any>(
        `SELECT id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", 
                client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes,
                client_address AS "clientAddress", service_location_type AS "serviceLocationType"
         FROM bookings WHERE client_email = $1
         ORDER BY starts_at DESC`,
        [user.email]
      );
    } else {
      return res.status(403).json({ error: "Acesso não permitido." });
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
    res.status(500).json({ error: "Erro interno ao buscar agendamentos." });
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
      `SELECT b.id, b.starts_at AS "startsAt", b.ends_at AS "endsAt", s.buffer_minutes AS "bufferMinutes" 
       FROM bookings b 
       LEFT JOIN services s ON b.service_id = s.id 
       WHERE b.provider_id = $1 AND b.status != 'cancelled' AND b.starts_at::date = $2::date`,
      [provider.id, date]
    );

    const slots: TimeSlot[] = [];

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

// 10. POST a booking (includes concurrency prevention constraint check with SQL transaction)
router.post('/bookings', bookingRateLimiter, async (req, res) => {
  const { providerId, serviceId, startsAt, clientName, clientEmail, clientPhone, notes } = req.body;
  
  if (!providerId || !serviceId || !startsAt || !clientName || !clientEmail || !clientPhone) {
    return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
  }
  if (typeof startsAt !== 'string' || Number.isNaN(Date.parse(startsAt))) {
    return res.status(400).json({ error: "Data/hora do agendamento inválida." });
  }
  if (typeof clientName !== 'string' || !clientName.trim() || clientName.length > 120) {
    return res.status(400).json({ error: "Nome do cliente inválido." });
  }
  if (!isValidEmail(clientEmail)) return res.status(400).json({ error: "E-mail do cliente inválido." });
  if (typeof clientPhone !== 'string' || !clientPhone.trim() || clientPhone.length > 40) {
    return res.status(400).json({ error: "Telefone do cliente inválido." });
  }
  if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 2000)) {
    return res.status(400).json({ error: "Observações inválidas." });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch Service
    const serviceRes = await client.query(
      `SELECT id, provider_id AS "providerId", name, duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes", price 
       FROM services WHERE id = $1 LIMIT 1`,
      [serviceId]
    );
    if (serviceRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Serviço não encontrado." });
    }
    const service = serviceRes.rows[0];
    // The requested provider must be the actual owner of the selected service.
    if (service.providerId !== providerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "O serviço não pertence ao profissional informado." });
    }

    // Calculate endsAt
    const startObj = new Date(startsAt);
    const endObj = new Date(startObj.getTime() + service.durationMinutes * 60 * 1000);
    const endsAt = endObj.toISOString();

    const dateStr = startsAt.substring(0, 10);

    // Serialize booking creation for this provider/day. Row locks alone do not
    // protect an empty result set, so simultaneous first bookings could both pass.
    // This transaction-scoped advisory lock is acquired even when no booking exists.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`,
      [String(providerId), dateStr]
    );

    // 2. Fetch existing active bookings on the same day for this provider
    const existingRes = await client.query(
      `SELECT b.id, b.starts_at AS "startsAt", b.ends_at AS "endsAt", s.buffer_minutes AS "bufferMinutes" 
       FROM bookings b 
       LEFT JOIN services s ON b.service_id = s.id 
       WHERE b.provider_id = $1 AND b.status != 'cancelled' AND b.starts_at::date = $2::date
       FOR UPDATE OF b`,
      [providerId, dateStr]
    );
    const existingBookings = existingRes.rows;

    const reqStartMs = startObj.getTime();
    const reqEndMs = endObj.getTime();
    const reqBufferMs = (service.bufferMinutes || 0) * 60 * 1000;

    // Concurrency overlap & buffer validation
    for (const b of existingBookings) {
      const bStartMs = new Date(b.startsAt).getTime();
      const bEndMs = new Date(b.endsAt).getTime();
      const bBufferMs = (Number(b.bufferMinutes) || 0) * 60 * 1000;

      // Core overlap checking: Math.max(reqStartMs, bStartMs) < Math.min(reqEndMs, bEndMs)
      const coreOverlap = Math.max(reqStartMs, bStartMs) < Math.min(reqEndMs, bEndMs);
      if (coreOverlap) {
        await client.query('ROLLBACK');
        return res.status(409).json({ 
          error: "slot_unavailable", 
          message: "O horário selecionado já foi reservado por outro cliente." 
        });
      }

      // Existing booking buffer check after appointment
      if (reqStartMs >= bStartMs && reqStartMs < (bEndMs + bBufferMs)) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: "slot_unavailable",
          message: "Conflito com o período de preparação/intervalo do agendamento anterior."
        });
      }

      // New service buffer check before next appointment
      if (reqEndMs > (bStartMs - reqBufferMs) && reqStartMs < bStartMs) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: "slot_unavailable",
          message: "Este horário não oferece o intervalo necessário antes da próxima reserva."
        });
      }
    }

    // 3. Insert new booking
    const newId = "booking-" + Date.now();
    const insertRes = await client.query(
      `INSERT INTO bookings (id, provider_id, service_id, starts_at, ends_at, client_name, client_email, client_phone, status, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       RETURNING id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes`,
      [
        newId,
        providerId,
        serviceId,
        startsAt,
        endsAt,
        clientName.trim(),
        clientEmail.toLowerCase().trim(),
        clientPhone.trim(),
        'confirmed',
        notes || null
      ]
    );

    await client.query('COMMIT');

    const created = {
      ...insertRes.rows[0],
      startsAt: toISOString(insertRes.rows[0].startsAt),
      endsAt: toISOString(insertRes.rows[0].endsAt)
    };
    res.status(201).json(created);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});

// 11. Update booking status
router.patch('/bookings/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
  const { status } = req.body;
  const allowedStatuses = new Set(['pending', 'confirmed', 'completed', 'cancelled']);
  if (typeof status !== 'string' || !allowedStatuses.has(status)) {
    return res.status(400).json({ error: "Status de agendamento inválido." });
  }

  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Não autorizado." });
  }

  try {
    const bookingRows = await query<any>(
      `SELECT provider_id AS "providerId", client_email AS "clientEmail", status FROM bookings WHERE id = $1`,
      [req.params.id]
    );
    if (bookingRows.length === 0) {
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }
    const booking = bookingRows[0];

    // Authorization is based on both ownership and an explicit state machine.
    // Terminal states (completed/cancelled) cannot be reopened or changed.
    const currentStatus = booking.status;
    let transitionAllowed = false;

    if (user.role === 'client') {
      transitionAllowed =
        user.email === booking.clientEmail &&
        status === 'cancelled' &&
        ['pending', 'confirmed'].includes(currentStatus);
    } else if (user.role === 'provider') {
      if (!user.providerId || user.providerId !== booking.providerId) {
        return res.status(403).json({ error: "Não autorizado a alterar este agendamento." });
      }
      transitionAllowed =
        (currentStatus === 'pending' && ['confirmed', 'cancelled'].includes(status)) ||
        (currentStatus === 'confirmed' && ['completed', 'cancelled'].includes(status));
    } else {
      return res.status(403).json({ error: "Papel sem permissão para alterar agendamentos." });
    }

    if (!transitionAllowed) {
      return res.status(409).json({ error: "Transição de status não permitida para o estado atual do agendamento." });
    }

    const rows = await query<Booking>(
      `UPDATE bookings SET status = $1
       WHERE id = $2 AND status = $6
         AND (($3 = 'client' AND client_email = $4 AND $1 = 'cancelled')
           OR ($3 = 'provider' AND provider_id = $5
             AND (($6 = 'pending' AND $1 IN ('confirmed', 'cancelled'))
               OR ($6 = 'confirmed' AND $1 IN ('completed', 'cancelled')))))
       RETURNING id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes`,
      [status, req.params.id, user.role, user.email, user.providerId || null, currentStatus]
    );
    if (rows.length === 0) {
      return res.status(409).json({ error: "O agendamento foi alterado por outra solicitação ou a transição não é permitida." });
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
  if (!user) return res.status(401).json({ error: "Não autorizado." });
  if (user.role !== 'provider' || !user.providerId) return res.status(403).json({ error: "Somente o profissional responsável pode excluir agendamentos. Clientes devem cancelar o agendamento." });
  try {
    const deleted = await query(`DELETE FROM bookings WHERE id = $1 AND provider_id = $2 RETURNING id`, [req.params.id, user.providerId]);
    if (deleted.length === 0) return res.status(404).json({ error: "Agendamento não encontrado." });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --- Authentication Endpoints ---

// Auth: Register Client / Provider
router.post('/auth/register', authRateLimiter, async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: "E-mail, senha e nome são obrigatórios." });
  }
  if (!isValidEmail(email)) return res.status(400).json({ error: "Formato de e-mail inválido." });
  if (typeof password !== 'string' || password.length < 12) return res.status(400).json({ error: "A senha deve ter no mínimo 12 caracteres." });
  if (typeof name !== 'string' || !name.trim() || name.length > 120) return res.status(400).json({ error: "Nome inválido." });

  try {
    const secret = getJwtSecret();
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Este e-mail já está cadastrado." });
    }

    const id = "user-" + Date.now();
    const passwordHash = await bcrypt.hash(password, 10);
    // Public self-registration creates clients only. Provider accounts must be
    // created through tenant onboarding, which binds tenant/provider IDs server-side.
    const userRole = 'client';
    const providerId: string | null = null;
    const userTenantId: string | null = null;
    await query(
      `INSERT INTO users (id, email, password_hash, name, role, tenant_id, provider_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, normalizedEmail, passwordHash, name.trim(), userRole, userTenantId, providerId]
    );

    const token = jwt.sign(
      { userId: id, email: normalizedEmail, name: name.trim(), role: userRole, tenantId: userTenantId, providerId },
      secret,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: { id, email: normalizedEmail, name: name.trim(), role: userRole, tenantId: userTenantId, providerId }
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

    const secret = getJwtSecret();

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
router.post('/auth/social-login', authRateLimiter, (_req, res) => {
  // Do not accept client-supplied email/name as proof of identity.
  // Re-enable only after server-side OAuth token verification is implemented.
  return res.status(501).json({ error: "Login social temporariamente indisponível; use e-mail e senha." });
});

// // Auth: Get Profile
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

  if (typeof startsAt !== 'string' || !startsAt.trim() || Number.isNaN(Date.parse(startsAt))) {
    return res.status(400).json({ error: "Data/hora de início inválida." });
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
    if (user.role === 'client') {
      if (user.email !== booking.clientEmail) return res.status(403).json({ error: "Você não tem permissão para alterar este agendamento." });
    } else if (user.role === 'provider') {
      if (!user.providerId || user.providerId !== booking.providerId) return res.status(403).json({ error: "Você não tem permissão para alterar este agendamento." });
    } else {
      return res.status(403).json({ error: "Papel sem permissão para reagendar." });
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
       WHERE id = $3 AND (($4 = 'client' AND client_email = $5) OR ($4 = 'provider' AND provider_id = $6))
       RETURNING id, provider_id AS "providerId", service_id AS "serviceId", starts_at AS "startsAt", ends_at AS "endsAt", client_name AS "clientName", client_email AS "clientEmail", client_phone AS "clientPhone", status, notes`,
      [startsAt, endsAt, bookingId, user.role, user.email, user.providerId || null]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Agendamento não encontrado ou sem autorização." });
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
