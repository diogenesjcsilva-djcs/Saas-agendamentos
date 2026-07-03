import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { 
  Tenant, 
  Provider, 
  Service, 
  AvailabilityRule, 
  AvailabilityException, 
  Booking, 
  TimeSlot 
} from "./src/types";

// Setup ports and paths
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "data", "db.json");

// Dynamic Database Access Helper
interface Database {
  tenants: Tenant[];
  providers: Provider[];
  services: Service[];
  availabilityRules: AvailabilityRule[];
  availabilityExceptions: AvailabilityException[];
  bookings: Booking[];
}

function readDb(): Database {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      return JSON.parse(raw);
    }
  } catch (error) {
    console.error("Error reading database file, using fallback:", error);
  }
  
  // Return fallback default structure if read fails
  return {
    tenants: [],
    providers: [],
    services: [],
    availabilityRules: [],
    availabilityExceptions: [],
    bookings: []
  };
}

function writeDb(data: Database) {
  try {
    // Ensure parent directory exists
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database:", error);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  
  // 1. Get all Tenants
  app.get("/api/tenants", (req, res) => {
    const db = readDb();
    res.json(db.tenants);
  });

  // 2. Get Single Tenant by Slug
  app.get("/api/tenants/:slug", (req, res) => {
    const db = readDb();
    const tenant = db.tenants.find(t => t.slug === req.params.slug);
    if (!tenant) {
      return res.status(404).json({ error: "Tenant not found" });
    }
    res.json(tenant);
  });

  // 3. Get Providers for a Tenant
  app.get("/api/providers", (req, res) => {
    const { tenantId } = req.query;
    const db = readDb();
    let providers = db.providers;
    if (tenantId) {
      providers = providers.filter(p => p.tenantId === tenantId);
    }
    res.json(providers);
  });

  // 4. Get Services (optionally filtered by providerId)
  app.get("/api/services", (req, res) => {
    const { providerId } = req.query;
    const db = readDb();
    let services = db.services;
    if (providerId) {
      services = services.filter(s => s.providerId === providerId);
    }
    res.json(services);
  });

  // 5. Add / Edit / Delete Services
  app.post("/api/services", (req, res) => {
    const db = readDb();
    const newService: Service = {
      id: "service-" + Date.now(),
      providerId: req.body.providerId,
      name: req.body.name,
      description: req.body.description || "",
      durationMinutes: Number(req.body.durationMinutes) || 30,
      bufferMinutes: Number(req.body.bufferMinutes) || 0,
      price: Number(req.body.price) || 0,
    };
    db.services.push(newService);
    writeDb(db);
    res.status(201).json(newService);
  });

  app.put("/api/services/:id", (req, res) => {
    const db = readDb();
    const index = db.services.findIndex(s => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Service not found" });
    }
    const updated = {
      ...db.services[index],
      name: req.body.name,
      description: req.body.description,
      durationMinutes: Number(req.body.durationMinutes) || db.services[index].durationMinutes,
      bufferMinutes: Number(req.body.bufferMinutes) || db.services[index].bufferMinutes,
      price: Number(req.body.price) || db.services[index].price,
    };
    db.services[index] = updated;
    writeDb(db);
    res.json(updated);
  });

  app.delete("/api/services/:id", (req, res) => {
    const db = readDb();
    db.services = db.services.filter(s => s.id !== req.params.id);
    // Also cleanup bookings for this deleted service if appropriate, or keep for records.
    writeDb(db);
    res.json({ success: true });
  });

  // 6. Get/Set Availability Rules
  app.get("/api/availability-rules", (req, res) => {
    const { providerId } = req.query;
    const db = readDb();
    let rules = db.availabilityRules;
    if (providerId) {
      rules = rules.filter(r => r.providerId === providerId);
    }
    res.json(rules);
  });

  app.put("/api/availability-rules", (req, res) => {
    const { providerId, rules } = req.body; // rules should be array of availability rules
    if (!providerId || !Array.isArray(rules)) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    
    const db = readDb();
    // Clear old rules for this provider
    db.availabilityRules = db.availabilityRules.filter(r => r.providerId !== providerId);
    
    // Add new rules
    const rulesToInsert: AvailabilityRule[] = rules.map((r, i) => ({
      id: `rule-${providerId}-${Date.now()}-${i}`,
      providerId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime
    }));
    
    db.availabilityRules.push(...rulesToInsert);
    writeDb(db);
    res.json(rulesToInsert);
  });

  // 7. Get/Add Availability Exceptions
  app.get("/api/exceptions", (req, res) => {
    const { providerId } = req.query;
    const db = readDb();
    let exceptions = db.availabilityExceptions;
    if (providerId) {
      exceptions = exceptions.filter(e => e.providerId === providerId);
    }
    res.json(exceptions);
  });

  app.post("/api/exceptions", (req, res) => {
    const { providerId, date, isBlocked, startTime, endTime } = req.body;
    if (!providerId || !date) {
      return res.status(400).json({ error: "providerId and date are required" });
    }
    
    const db = readDb();
    // Remove existing exception for the same date and provider to avoid duplicate
    db.availabilityExceptions = db.availabilityExceptions.filter(
      e => !(e.providerId === providerId && e.date === date)
    );
    
    const newException: AvailabilityException = {
      id: "except-" + Date.now(),
      providerId,
      date,
      isBlocked: !!isBlocked,
      startTime,
      endTime
    };
    
    db.availabilityExceptions.push(newException);
    writeDb(db);
    res.status(201).json(newException);
  });

  app.delete("/api/exceptions/:id", (req, res) => {
    const db = readDb();
    db.availabilityExceptions = db.availabilityExceptions.filter(e => e.id !== req.params.id);
    writeDb(db);
    res.json({ success: true });
  });

  // 8. Get Bookings
  app.get("/api/bookings", (req, res) => {
    const { providerId } = req.query;
    const db = readDb();
    let bookings = db.bookings;
    if (providerId) {
      bookings = bookings.filter(b => b.providerId === providerId);
    }
    res.json(bookings);
  });

  // 9. CRITICAL ENDPOINT: Calculate Available Slots
  app.get("/api/slots", (req, res) => {
    const { serviceId, date } = req.query; // date: "YYYY-MM-DD"
    if (!serviceId || !date) {
      return res.status(400).json({ error: "serviceId and date are required" });
    }

    const db = readDb();
    const service = db.services.find(s => s.id === serviceId);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const provider = db.providers.find(p => p.id === service.providerId);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    // Determine Day of Week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    // Parse the date local context to avoid UTC timezone offset issues on simple strings
    const dateObj = new Date(`${date}T00:00:00`);
    const dayOfWeek = dateObj.getDay();

    // 1. Resolve active availability windows for this provider/day
    // First, check exceptions for this specific date
    const exception = db.availabilityExceptions.find(
      e => e.providerId === provider.id && e.date === date
    );

    let activeWindows: { start: string; end: string }[] = [];

    if (exception) {
      if (exception.isBlocked) {
        // Entire day is blocked! Return empty slots
        return res.json([]);
      } else if (exception.startTime && exception.endTime) {
        // Exception defines specific custom times for this date
        activeWindows.push({ start: exception.startTime, end: exception.endTime });
      }
    } else {
      // No exceptions, check normal weekly rules
      const rules = db.availabilityRules.filter(
        r => r.providerId === provider.id && r.dayOfWeek === dayOfWeek
      );
      for (const rule of rules) {
        activeWindows.push({ start: rule.startTime, end: rule.endTime });
      }
    }

    if (activeWindows.length === 0) {
      // No working hours defined for this day
      return res.json([]);
    }

    // Fetch active bookings for this provider on this specific date (excluding cancelled ones)
    const bookingsOnDate = db.bookings.filter(b => {
      if (b.providerId !== provider.id || b.status === "cancelled") return false;
      // Extract date part from booking ISO string (format: YYYY-MM-DDThh:mm...)
      const bDate = b.startsAt.substring(0, 10);
      return bDate === date;
    });

    const slots: TimeSlot[] = [];

    // Auxiliary helper to convert "HH:MM" to minutes from midnight
    const timeToMinutes = (t: string): number => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    // Helper to convert minutes to "HH:MM"
    const minutesToTime = (min: number): string => {
      const h = Math.floor(min / 60).toString().padStart(2, "0");
      const m = (min % 60).toString().padStart(2, "0");
      return `${h}:${m}`;
    };

    const duration = service.durationMinutes;
    // We increment slot generation in steps of 15 or 30 minutes to make calendar smooth
    const stepMinutes = duration <= 30 ? 15 : 30;

    // Map existing bookings to active block ranges (minutes from midnight)
    // We include the existing service buffer time as part of the blocking to enforce buffer space!
    const blockedRanges = bookingsOnDate.map(b => {
      const bStartMin = timeToMinutes(b.startsAt.substring(11, 16));
      const bEndMin = timeToMinutes(b.endsAt.substring(11, 16));
      
      // Look up buffer of the booked service
      const bService = db.services.find(s => s.id === b.serviceId);
      const bBuffer = bService ? bService.bufferMinutes : 0;

      return {
        start: bStartMin,
        // The block is effective from start to end + the buffer!
        end: bEndMin + bBuffer,
        realEnd: bEndMin,
        bookingId: b.id,
        client: b.clientName
      };
    });

    // Generate possible slots across all available windows
    for (const window of activeWindows) {
      const windowStart = timeToMinutes(window.start);
      const windowEnd = timeToMinutes(window.end);

      for (let startMin = windowStart; startMin <= windowEnd - duration; startMin += stepMinutes) {
        const endMin = startMin + duration;
        
        // Slot boundary checks
        if (endMin > windowEnd) continue;

        // Check for overlaps with booked ranges
        // A potential slot starts at startMin and effectively blocks up to (startMin + duration + currentService.bufferMinutes)
        // No overlap condition: For each blocked range [bStart, bEnd_with_buffer], there is overlap if:
        // Max(startMin, bStart) < Min(startMin + duration + service.bufferMinutes, bEnd_with_buffer)
        // Wait, to be perfectly fair:
        // A booking overlap occurs simply if candidate interval [startMin, endMin] overlaps [b.start, b.realEnd]
        // AND ALSO we check that the buffer is preserved:
        // 1. Candidate start cannot be inside an existing booking's duration + its buffer:
        //    i.e., startMin must be >= existing_booking.end + its buffer (or <= existing_booking.start - current_service.buffer).
        // Let's implement the complete buffer validation precisely:
        let isAvailable = true;
        let conflictReason = "";

        for (const block of blockedRanges) {
          // Overlap of core service durations:
          const coreOverlap = Math.max(startMin, block.start) < Math.min(endMin, block.realEnd);
          if (coreOverlap) {
            isAvailable = false;
            conflictReason = "Sobreposição com outro agendamento";
            break;
          }

          // Buffer violation checks:
          // Check if candidate starts too early after previous booking (violating previous booking's buffer)
          if (startMin >= block.start && startMin < block.end) {
            isAvailable = false;
            conflictReason = `Período de intervalo (buffer) do agendamento de ${block.client}`;
            break;
          }

          // Check if candidate ends too late, violating buffer before the next booking starts
          // Next booking starts at block.start. Candidate ends at endMin. 
          // The buffer required between candidate and next booking is service.bufferMinutes.
          // Therefore, if candidate is before the block, it must finish at least service.bufferMinutes before block.start.
          if (endMin > block.start - service.bufferMinutes && startMin < block.start) {
            isAvailable = false;
            conflictReason = `Intervalo de segurança necessário antes do agendamento de ${block.client}`;
            break;
          }
        }

        // Format times and construct slot
        const timeStr = minutesToTime(startMin);
        
        // We output ISO dates for convenience
        const datetimeStr = `${date}T${timeStr}:00.000Z`;

        slots.push({
          time: timeStr,
          datetime: datetimeStr,
          available: isAvailable,
          reason: isAvailable ? undefined : conflictReason
        });
      }
    }

    // Sort slots chronologically
    slots.sort((a, b) => a.time.localeCompare(b.time));
    res.json(slots);
  });

  // 10. POST a booking (includes concurrency prevention constraint check)
  app.post("/api/bookings", (req, res) => {
    const { providerId, serviceId, startsAt, clientName, clientEmail, clientPhone, notes } = req.body;
    
    if (!providerId || !serviceId || !startsAt || !clientName || !clientEmail || !clientPhone) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const db = readDb();
    
    // Validate service exists
    const service = db.services.find(s => s.id === serviceId);
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    // Calculate end time
    const startObj = new Date(startsAt);
    const endObj = new Date(startObj.getTime() + service.durationMinutes * 60 * 1000);
    const endsAt = endObj.toISOString();

    // CRITICAL CONCURRENCY AND OVERLAP CHECK (Like EXCLUDE USING GIST in Postgres!)
    // Ensure this slot is actually available
    const requestedStartMin = startObj.getUTCHours() * 60 + startObj.getUTCMinutes();
    const requestedEndMin = requestedStartMin + service.durationMinutes;
    const dateStr = startsAt.substring(0, 10);

    // Active bookings on the same day for this provider
    const existingBookings = db.bookings.filter(b => {
      return b.providerId === providerId && 
             b.status !== "cancelled" && 
             b.startsAt.substring(0, 10) === dateStr;
    });

    // Check overlap with any existing bookings including safety buffers
    for (const b of existingBookings) {
      const bStartObj = new Date(b.startsAt);
      const bEndObj = new Date(b.endsAt);
      const bStartMin = bStartObj.getUTCHours() * 60 + bStartObj.getUTCMinutes();
      const bEndMin = bStartObj.getUTCHours() * 60 + bStartObj.getUTCMinutes() + (bEndObj.getTime() - bStartObj.getTime()) / (60 * 1000);

      const bService = db.services.find(s => s.id === b.serviceId);
      const bBuffer = bService ? bService.bufferMinutes : 0;

      // Primary overlap of core times:
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

      // Check current service buffer violation before the next booking starts
      if (requestedEndMin > (bStartMin - service.bufferMinutes) && requestedStartMin < bStartMin) {
        return res.status(409).json({
          error: "slot_unavailable",
          message: "Este horário não oferece o intervalo necessário antes da próxima reserva."
        });
      }
    }

    const newBooking: Booking = {
      id: "booking-" + Date.now(),
      providerId,
      serviceId,
      startsAt,
      endsAt,
      clientName,
      clientEmail,
      clientPhone,
      status: "confirmed", // auto confirm for demo ease
      notes
    };

    db.bookings.push(newBooking);
    writeDb(db);
    res.status(201).json(newBooking);
  });

  // 11. Update booking status
  app.patch("/api/bookings/:id", (req, res) => {
    const { status } = req.body; // 'confirmed', 'cancelled', 'completed'
    if (!status) {
      return res.status(400).json({ error: "status is required" });
    }

    const db = readDb();
    const index = db.bookings.findIndex(b => b.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: "Booking not found" });
    }

    db.bookings[index].status = status;
    writeDb(db);
    res.json(db.bookings[index]);
  });

  // 12. Delete booking
  app.delete("/api/bookings/:id", (req, res) => {
    const db = readDb();
    db.bookings = db.bookings.filter(b => b.id !== req.params.id);
    writeDb(db);
    res.json({ success: true });
  });

  // Vite Integration for Serving Frontend
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Scheduler SaaS server running on port ${PORT}`);
  });
}

startServer();
