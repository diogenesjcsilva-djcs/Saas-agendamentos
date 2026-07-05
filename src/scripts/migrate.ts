import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
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
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        image_url TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS providers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        bio TEXT,
        avatar_url TEXT
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        tenant_id TEXT REFERENCES tenants(id) ON DELETE SET NULL,
        provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL
      )
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT
    `);

    await client.query(`
      ALTER TABLE providers ADD COLUMN IF NOT EXISTS category_id TEXT REFERENCES categories(id) ON DELETE SET NULL
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

      // Seed categories
      console.log('Seeding categories...');
      const categories = [
        { id: 'category-1', name: 'Barbearia & Cabelo', slug: 'barba-cabelo', imageUrl: '✂️' },
        { id: 'category-2', name: 'Estética & Beleza', slug: 'estetica-beleza', imageUrl: '✨' },
        { id: 'category-3', name: 'Massagem & Relax', slug: 'massagem-relax', imageUrl: '💆‍♀️' },
        { id: 'category-4', name: 'Unhas & Manicure', slug: 'unhas-manicure', imageUrl: '💅' }
      ];
      for (const cat of categories) {
        await client.query(
          `INSERT INTO categories (id, name, slug, image_url)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             slug = EXCLUDED.slug,
             image_url = EXCLUDED.image_url`,
          [cat.id, cat.name, cat.slug, cat.imageUrl]
        );
      }

      // Seed providers
      console.log('Seeding providers...');
      for (const provider of data.providers) {
        const categoryId = provider.id === 'provider-1' ? 'category-1' : 'category-2';
        await client.query(
          `INSERT INTO providers (id, tenant_id, category_id, name, email, bio, avatar_url) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT (id) DO UPDATE SET 
             tenant_id = EXCLUDED.tenant_id, 
             category_id = EXCLUDED.category_id, 
             name = EXCLUDED.name, 
             email = EXCLUDED.email, 
             bio = EXCLUDED.bio, 
             avatar_url = EXCLUDED.avatar_url`,
          [provider.id, provider.tenantId, categoryId, provider.name, provider.email, provider.bio, provider.avatarUrl || null]
        );
      }

      // Seed users
      console.log('Seeding users...');
      const passwordHash = await bcrypt.hash('12345678', 10);
      const defaultUsers = [
        {
          id: 'user-1',
          email: 'carlos@imperial.com',
          name: 'Carlos Barber',
          role: 'provider',
          tenantId: 'tenant-1',
          providerId: 'provider-1'
        },
        {
          id: 'user-2',
          email: 'lucas@imperial.com',
          name: 'Lucas Faccini',
          role: 'provider',
          tenantId: 'tenant-1',
          providerId: 'provider-2'
        },
        {
          id: 'user-3',
          email: 'heloisa@aura.com',
          name: 'Dra. Heloísa Barros',
          role: 'provider',
          tenantId: 'tenant-2',
          providerId: 'provider-3'
        }
      ];

      for (const u of defaultUsers) {
        await client.query(
          `INSERT INTO users (id, email, password_hash, name, role, tenant_id, provider_id) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT (id) DO UPDATE SET 
             email = EXCLUDED.email, 
             password_hash = EXCLUDED.password_hash, 
             name = EXCLUDED.name, 
             role = EXCLUDED.role, 
             tenant_id = EXCLUDED.tenant_id, 
             provider_id = EXCLUDED.provider_id`,
          [u.id, u.email, passwordHash, u.name, u.role, u.tenantId, u.providerId]
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
