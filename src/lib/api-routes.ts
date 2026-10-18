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
  if (!user) return res.status(401).json({ error: "Não autorizado." });

  const startObj = new Date(startsAt);
  if (!Number.isFinite(startObj.getTime())) {
    return res.status(400).json({ error: "Data/hora de início inválida." });
  }

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;

    // Read the provider without locking the booking row first. Creation acquires
    // the provider advisory lock before inspecting bookings, so taking the row
    // lock first here could deadlock with a concurrent creation request.
    const initialResult = await client.query(
      `SELECT id, provider_id AS "providerId"
       FROM bookings WHERE id = $1`,
      [bookingId]
    );
    if (initialResult.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }

    const initialProviderId = String(initialResult.rows[0].providerId);
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1), 0)`,
      [initialProviderId]
    );

    // All writers must acquire the provider lock before booking row locks.
    const bookingResult = await client.query(
      `SELECT id, provider_id AS "providerId", service_id AS "serviceId",
              client_email AS "clientEmail", status
       FROM bookings WHERE id = $1 FOR UPDATE`,
      [bookingId]
    );
    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ error: "Agendamento não encontrado." });
    }
    const booking = bookingResult.rows[0];
    if (String(booking.providerId) !== initialProviderId) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: "O agendamento mudou durante a operação; tente novamente." });
    }

    if (user.role === 'client') {
      if (user.email !== booking.clientEmail) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return res.status(403).json({ error: "Você não tem permissão para alterar este agendamento." });
      }
    } else if (user.role === 'provider') {
      if (!user.providerId || user.providerId !== booking.providerId) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return res.status(403).json({ error: "Você não tem permissão para alterar este agendamento." });
      }
    } else {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(403).json({ error: "Papel sem permissão para reagendar." });
    }

    if (!['pending', 'confirmed'].includes(booking.status)) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: "Agendamentos concluídos ou cancelados não podem ser reagendados." });
    }

    const serviceResult = await client.query(
      `SELECT id, provider_id AS "providerId",
              duration_minutes AS "durationMinutes", buffer_minutes AS "bufferMinutes"
       FROM services WHERE id = $1 LIMIT 1`,
      [booking.serviceId]
    );
    if (serviceResult.rows.length === 0 || serviceResult.rows[0].providerId !== booking.providerId) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: "O serviço associado ao agendamento é inválido." });
    }
    const service = serviceResult.rows[0];
    const durationMinutes = Number(service.durationMinutes);
    const serviceBufferMinutes = Number(service.bufferMinutes) || 0;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440 || !Number.isFinite(serviceBufferMinutes) || serviceBufferMinutes < 0 || serviceBufferMinutes > 1440) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: "A duração ou o intervalo do serviço é inválido." });
    }

    const endsAt = new Date(startObj.getTime() + durationMinutes * 60 * 1000).toISOString();
    const dayStart = new Date(Date.UTC(startObj.getUTCFullYear(), startObj.getUTCMonth(), startObj.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    // The provider-wide transaction lock was acquired before the booking row lock.

    // Include adjacent UTC days so appointments near midnight and buffers are checked.
    const existingResult = await client.query(
      `SELECT b.id, b.starts_at AS "startsAt", b.ends_at AS "endsAt",
              COALESCE(s.buffer_minutes, 0) AS "bufferMinutes"
       FROM bookings b
       LEFT JOIN services s ON b.service_id = s.id
       WHERE b.provider_id = $1 AND b.status <> 'cancelled'
         AND b.starts_at >= $2::timestamptz - INTERVAL '1 day'
         AND b.starts_at < $3::timestamptz + INTERVAL '1 day'
         AND b.id <> $4
       FOR UPDATE OF b`,
      [booking.providerId, dayStart.toISOString(), dayEnd.toISOString(), bookingId]
    );

    const requestedStartMs = startObj.getTime();
    const requestedEndMs = new Date(endsAt).getTime();
    const requestedBufferMs = serviceBufferMinutes * 60 * 1000;

    for (const existing of existingResult.rows) {
      const existingStartMs = new Date(existing.startsAt).getTime();
      const existingEndMs = new Date(existing.endsAt).getTime();
      const existingBufferMs = (Number(existing.bufferMinutes) || 0) * 60 * 1000;

      const overlaps = requestedStartMs < existingEndMs && requestedEndMs > existingStartMs;
      const overlapsExistingBuffer = requestedStartMs < existingEndMs + existingBufferMs && requestedEndMs > existingStartMs;
      const violatesRequestedBuffer = requestedEndMs + requestedBufferMs > existingStartMs && requestedStartMs < existingStartMs;

      if (overlaps || overlapsExistingBuffer || violatesRequestedBuffer) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return res.status(409).json({
          error: "slot_unavailable",
          message: "O horário selecionado conflita com outra reserva ou com o intervalo de segurança."
        });
      }
    }

    const updateResult = await client.query(
      `UPDATE bookings
       SET starts_at = $1, ends_at = $2
       WHERE id = $3 AND status = $7
         AND (($4 = 'client' AND client_email = $5)
           OR ($4 = 'provider' AND provider_id = $6))
       RETURNING id, provider_id AS "providerId", service_id AS "serviceId",
                 starts_at AS "startsAt", ends_at AS "endsAt",
                 client_name AS "clientName", client_email AS "clientEmail",
                 client_phone AS "clientPhone", status, notes`,
      [startObj.toISOString(), endsAt, bookingId, user.role, user.email, user.providerId || null, booking.status]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: "O agendamento mudou durante a operação; atualize e tente novamente." });
    }

    await client.query('COMMIT');
    transactionOpen = false;
    const updated = {
      ...updateResult.rows[0],
      startsAt: toISOString(updateResult.rows[0].startsAt),
      endsAt: toISOString(updateResult.rows[0].endsAt)
    };
    return res.json(updated);
  } catch (error) {
    if (transactionOpen) {
      try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
    }
    console.error("Reschedule booking error:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  } finally {
    client.release();
  }
});
export default router;