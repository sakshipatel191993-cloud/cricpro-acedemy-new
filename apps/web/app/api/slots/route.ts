import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';

interface TimeSlot {
  time: string;
  available: boolean;
  availableLanes: number;
  price: string;
  slotId?: string;
  blocked?: boolean;
  blockReason?: string;
  overridePrice?: string | null;
}

interface AvailabilityRule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  buffer_mins: number;
  active: boolean;
}

interface PricingRule {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  days: number[];
  price: string;
  priority: number;
  active: boolean;
}

interface SlotOverride {
  id: string;
  slot_date: string;
  start_at: string;
  end_at: string;
  custom_price: string | null;
  blocked: boolean;
  reason: string | null;
}

interface BlockedSlot {
  id: string;
  start_at: string;
  end_at: string;
  reason: string;
}

// Generate time slots based on availability rules
async function generateSlotsForDate(
  date: Date,
  resourceId: string
): Promise<TimeSlot[]> {
  const dayOfWeek = date.getDay();
  const dateStr = date.toISOString().split('T')[0];

  // Fetch availability rules for this resource and day
  const { data: rules } = await supabaseAdmin
    .from('resource_availability_rules')
    .select('*')
    .eq('resource_id', resourceId)
    .eq('day_of_week', dayOfWeek)
    .eq('active', true);

  // If no rules, return empty
  if (!rules || rules.length === 0) {
    return [];
  }

  // Fetch pricing rules
  const { data: pricingRules } = await supabaseAdmin
    .from('pricing_rules')
    .select('*')
    .eq('resource_id', resourceId)
    .eq('active', true)
    .order('priority', { ascending: true });

  // Fetch slot overrides for this date
  const { data: overrides } = await supabaseAdmin
    .from('slot_overrides')
    .select('*')
    .eq('resource_id', resourceId)
    .eq('slot_date', dateStr);

  // Fetch blocked slots
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const { data: blockedSlots } = await supabaseAdmin
    .from('blocked_slots')
    .select('*')
    .eq('resource_id', resourceId)
    .gte('start_at', startOfDay.toISOString())
    .lte('start_at', endOfDay.toISOString());

  // Fetch existing bookings
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('*')
    .eq('resource_id', resourceId)
    .in('status', ['confirmed', 'pending_payment'])
    .gte('start_at', startOfDay.toISOString())
    .lte('start_at', endOfDay.toISOString());

  const slots: TimeSlot[] = [];

  // Generate slots for each rule
  for (const rule of rules as AvailabilityRule[]) {
    const startTimeParts = rule.start_time.split(':').map(Number);
    const endTimeParts = rule.end_time.split(':').map(Number);
    const slotDuration = rule.slot_duration_mins || 60;

    let currentHour = startTimeParts[0] ?? 0;
    let currentMin = startTimeParts[1] ?? 0;
    const endHour = endTimeParts[0] ?? 22;
    const endMin = endTimeParts[1] ?? 0;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const slotStart = new Date(date);
      slotStart.setUTCHours(currentHour, currentMin, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setUTCMinutes(slotStart.getUTCMinutes() + slotDuration);

      // Check if slot end exceeds rule end time
      if (slotEnd.getUTCHours() > endHour ||
          (slotEnd.getUTCHours() === endHour && slotEnd.getUTCMinutes() > endMin)) {
        break;
      }

      const slotTime = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;

      // Check override
      const override = (overrides as SlotOverride[] || []).find(o =>
        slotStart.toISOString() >= o.start_at && slotStart.toISOString() < o.end_at
      );

      // Check if blocked
      const blockedSlot = (blockedSlots as BlockedSlot[] || []).find(b =>
        slotStart.toISOString() >= b.start_at && slotStart.toISOString() < b.end_at
      );

      // Check if booked (compare as timestamps to avoid timezone string format issues)
      const slotStartMs = slotStart.getTime();
      const slotEndMs = slotEnd.getTime();
      const isBooked = (bookings || []).some(b => {
        const bookingStart = new Date(b.start_at).getTime();
        const bookingEnd = new Date(b.end_at).getTime();
        return slotStartMs < bookingEnd && slotEndMs > bookingStart;
      });

      // Calculate price
      let price = '';
      let overridePrice: string | null = null;

      if (override?.custom_price) {
        price = override.custom_price;
        overridePrice = override.custom_price;
      } else if (override?.blocked) {
        price = '0.00';
      } else {
        // Find applicable pricing rule
        const applicableRule = (pricingRules as PricingRule[] | undefined)?.find(pr =>
          pr.days.includes(dayOfWeek) &&
          slotTime >= pr.start_time.substring(0, 5) &&
          slotTime < pr.end_time.substring(0, 5)
        );

        if (applicableRule) {
          price = applicableRule.price;
        } else {
          // Default pricing: weekends are all peak; weekdays peak from 4 PM.
          const hour = currentHour;
          const isPeak = dayOfWeek === 0 || dayOfWeek === 6 || hour >= 16;
          price = isPeak ? '25.00' : '15.00'; // Default peak/off-peak
        }
      }

      const isAvailable = !isBooked && !blockedSlot && !override?.blocked;
      slots.push({
        time: slotTime,
        available: isAvailable,
        availableLanes: isAvailable ? 1 : 0,
        price,
        blocked: blockedSlot ? true : undefined,
        blockReason: blockedSlot?.reason,
        overridePrice
      });

      // Move to next slot
      currentMin += slotDuration;
      while (currentMin >= 60) {
        currentMin -= 60;
        currentHour++;
      }
    }
  }

  // Sort slots by time
  slots.sort((a, b) => a.time.localeCompare(b.time));

  return slots;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const resourceType = searchParams.get('resourceType');
    const date = searchParams.get('date');
    const days = parseInt(searchParams.get('days') || '1');
    const resourceId = searchParams.get('resourceId');

    if (!resourceType || !date) {
      return NextResponse.json(
        { success: false, error: 'resourceType and date are required' },
        { status: 400 }
      );
    }

    // Fetch resources — optionally filter to a single resource by ID
    let resourceQuery = supabaseAdmin
      .from('resources')
      .select('id, name, type')
      .eq('type', resourceType)
      .eq('active', true);

    if (resourceId) {
      resourceQuery = resourceQuery.eq('id', resourceId);
    }

    const { data: resources, error: resourcesError } = await resourceQuery;

    if (resourcesError || !resources || resources.length === 0) {
      return NextResponse.json(
        { success: false, error: `No active resources found for type ${resourceType}` },
        { status: 404 }
      );
    }

    const allSlots: Record<string, { time: string; availableLanes: number; price: string }> = {};

    const startDate = new Date(date);

    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setUTCDate(startDate.getUTCDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0] ?? '';

      for (const resource of resources) {
        const resourceSlots = await generateSlotsForDate(currentDate, resource.id);

        for (const slot of resourceSlots) {
          const key = `${dateStr}-${slot.time}`;
          if (!allSlots[key]) {
            allSlots[key] = { time: slot.time, availableLanes: 0, price: slot.price };
          }
          if (slot.available) {
            allSlots[key].availableLanes++;
          }
        }
      }
    }

    const aggregatedSlots = Object.values(allSlots).sort((a, b) => a.time.localeCompare(b.time));

    return NextResponse.json({
      success: true,
      resourceType,
      dates: [{ date: date, slots: aggregatedSlots }]
    });
  } catch (error) {
    console.error('Slots fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch slots' },
      { status: 500 }
    );
  }
}