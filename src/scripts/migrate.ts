import fs from 'fs';
import path from 'path';
import { pool } from '../lib/db';

async function runMigration() {
  console.log('Starting migration to Neon PostgreSQL...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Create tables
    console.log('Creating tables if they do not exist...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        logo_url TEXT,
        description TEXT,
        theme_color TEXT,
        accent_color TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        bio TEXT,
        avatar_url TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id TEXT PRIMARY KEY,
        provider_id TEXT REFERENCES providers(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        duration_minutes INTEGER NOT NULL,
        buffer_minutes INTEGER NOT NULL,
        price NUMERIC NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS availability_rules (
        id TEXT PRIMARY KEY,
        provider_id TEXT REFERENCES providers(id) ON DELETE CASCADE,
        day_of_week INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS availability_exceptions (
        id TEXT PRIMARY KEY,
        provider_id TEXT REFERENCES providers(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        is_blocked BOOLEAN NOT NULL,
        start_time TEXT,
        end_time TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        provider_id TEXT REFERENCES providers(id) ON DELETE CASCADE,
        service_id TEXT REFERENCES services(id) ON DELETE CASCADE,
        starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
        ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        status TEXT NOT NULL,
        notes TEXT
      )
    `);

    // 2. Read seed data from db.json
    const dbPath = path.join(process.cwd(), 'data', 'db.json');
    if (fs.existsSync(dbPath)) {
      console.log('Reading seed data from data/db.json...');
      const raw = fs.readFileSync(dbPath, 'utf-8');
      const data = JSON.parse(raw);

      // Seed tenants
      console.log('Seeding tenants...');
      for (const tenant of data.tenants) {
        await client.query(
          `INSERT INTO tenants (id, name, slug, logo_url, description, theme_color, accent_color) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT (id) DO UPDATE SET 
             name = EXCLUDED.name, 
             slug = EXCLUDED.slug, 
             logo_url = EXCLUDED.logo_url, 
             description = EXCLUDED.description, 
             theme_color = EXCLUDED.theme_color, 
             accent_color = EXCLUDED.accent_color`,
          [tenant.id, tenant.name, tenant.slug, tenant.logoUrl, tenant.description, tenant.themeColor, tenant.accentColor]
        );
      }

      // Seed providers
      console.log('Seeding providers...');
      for (const provider of data.providers) {
        await client.query(
          `INSERT INTO providers (id, tenant_id, name, email, bio, avatar_url) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           ON CONFLICT (id) DO UPDATE SET 
             tenant_id = EXCLUDED.tenant_id, 
             name = EXCLUDED.name, 
             email = EXCLUDED.email, 
             bio = EXCLUDED.bio, 
             avatar_url = EXCLUDED.avatar_url`,
          [provider.id, provider.tenantId, provider.name, provider.email, provider.bio, provider.avatarUrl || null]
        );
      }

      // Seed services
      console.log('Seeding services...');
      for (const service of data.services) {
        await client.query(
          `INSERT INTO services (id, provider_id, name, description, duration_minutes, buffer_minutes, price) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT (id) DO UPDATE SET 
             provider_id = EXCLUDED.provider_id, 
             name = EXCLUDED.name, 
             description = EXCLUDED.description, 
             duration_minutes = EXCLUDED.duration_minutes, 
             buffer_minutes = EXCLUDED.buffer_minutes, 
             price = EXCLUDED.price`,
          [service.id, service.providerId, service.name, service.description, service.durationMinutes, service.bufferMinutes, service.price]
        );
      }

      // Seed availability rules
      console.log('Seeding availability rules...');
      for (const rule of data.availabilityRules) {
        await client.query(
          `INSERT INTO availability_rules (id, provider_id, day_of_week, start_time, end_time) 
           VALUES ($1, $2, $3, $4, $5) 
           ON CONFLICT (id) DO UPDATE SET 
             provider_id = EXCLUDED.provider_id, 
             day_of_week = EXCLUDED.day_of_week, 
             start_time = EXCLUDED.start_time, 
             end_time = EXCLUDED.end_time`,
          [rule.id, rule.providerId, rule.dayOfWeek, rule.startTime, rule.endTime]
        );
      }

      // Seed availability exceptions
      console.log('Seeding availability exceptions...');
      for (const exc of data.availabilityExceptions) {
        await client.query(
          `INSERT INTO availability_exceptions (id, provider_id, date, is_blocked, start_time, end_time) 
           VALUES ($1, $2, $3, $4, $5, $6) 
           ON CONFLICT (id) DO UPDATE SET 
             provider_id = EXCLUDED.provider_id, 
             date = EXCLUDED.date, 
             is_blocked = EXCLUDED.is_blocked, 
             start_time = EXCLUDED.start_time, 
             end_time = EXCLUDED.end_time`,
          [exc.id, exc.providerId, exc.date, exc.isBlocked, exc.startTime || null, exc.endTime || null]
        );
      }

      // Seed bookings
      console.log('Seeding bookings...');
      for (const booking of data.bookings) {
        await client.query(
          `INSERT INTO bookings (id, provider_id, service_id, starts_at, ends_at, client_name, client_email, client_phone, status, notes) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
           ON CONFLICT (id) DO UPDATE SET 
             provider_id = EXCLUDED.provider_id, 
             service_id = EXCLUDED.service_id, 
             starts_at = EXCLUDED.starts_at, 
             ends_at = EXCLUDED.ends_at, 
             client_name = EXCLUDED.client_name, 
             client_email = EXCLUDED.client_email, 
             client_phone = EXCLUDED.client_phone, 
             status = EXCLUDED.status, 
             notes = EXCLUDED.notes`,
          [booking.id, booking.providerId, booking.serviceId, booking.startsAt, booking.endsAt, booking.clientName, booking.clientEmail, booking.clientPhone, booking.status, booking.notes || null]
        );
      }
    } else {
      console.log('Warning: No seed data file found at data/db.json. Skipping seeding...');
    }

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
