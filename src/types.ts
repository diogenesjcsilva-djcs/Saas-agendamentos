/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description: string;
  themeColor: string; // Ex: 'emerald', 'amber', 'rose', 'indigo'
  accentColor: string; // Tailwind class
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
}

export interface Provider {
  id: string;
  tenantId: string;
  categoryId?: string;
  name: string;
  email: string;
  bio: string;
  avatarUrl?: string;
}

export interface Service {
  id: string;
  providerId: string;
  name: string;
  description: string;
  durationMinutes: number;
  bufferMinutes: number;
  price: number;
}

export interface AvailabilityRule {
  id: string;
  providerId: string;
  dayOfWeek: number; // 0 (Sunday) to 6 (Saturday)
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

export interface AvailabilityException {
  id: string;
  providerId: string;
  date: string; // "YYYY-MM-DD"
  isBlocked: boolean;
  startTime?: string; // "HH:MM" if not blocked the whole day
  endTime?: string; // "HH:MM" if not blocked the whole day
}

export interface Booking {
  id: string;
  providerId: string;
  serviceId: string;
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
}

export interface TimeSlot {
  time: string; // "HH:MM"
  datetime: string; // ISO String
  available: boolean;
  reason?: string;
}
