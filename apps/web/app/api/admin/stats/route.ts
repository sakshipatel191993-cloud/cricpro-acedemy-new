import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/services/supabase';
import { isAdminRequest } from '@/lib/security/admin-auth';

function londonDate(value: Date | string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export async function GET(request: NextRequest) {
  if (!await isAdminRequest(request)) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  try {
    const period = '30';

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    const startDateStr = startDate.toISOString();

    // Get counts
    const [
      { count: totalBookings },
      { count: confirmedBookings },
      { count: pendingBookings },
      { count: totalInquiries },
      { count: newInquiries },
      { count: totalGroupBookings }
    ] = await Promise.all([
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabaseAdmin.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending_payment'),
      supabaseAdmin.from('inquiries').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabaseAdmin.from('group_session_bookings').select('id', { count: 'exact', head: true }).eq('status', 'confirmed')
    ]);

    // Get revenue (confirmed bookings in period)
    const { data: revenueData, error: revenueError } = await supabaseAdmin
      .from('bookings')
      .select('amount, created_at')
      .eq('status', 'confirmed')
      .eq('payment_status', 'paid')
      .gte('created_at', startDateStr);

    const { data: groupRevenueData, error: groupRevenueError } = await supabaseAdmin
      .from('group_session_bookings')
      .select('amount, created_at')
      .eq('status', 'confirmed')
      .eq('payment_status', 'paid')
      .gte('created_at', startDateStr);

    if (revenueError || groupRevenueError) throw new Error('Revenue data unavailable');
    const dailyActivity = Array.from({ length: 7 }, (_, index) => ({
      date: londonDate(new Date(Date.now() - (6 - index) * 86400000)), bookings: 0, revenue: 0,
    }));
    const dailyMap = new Map(dailyActivity.map(day => [day.date, day]));
    for (const row of [...(revenueData ?? []), ...(groupRevenueData ?? [])]) {
      const day = dailyMap.get(londonDate(row.created_at));
      if (day) { day.bookings++; day.revenue += Number(row.amount || 0); }
    }

    const bookingRevenue = revenueData?.reduce((sum, b) => sum + parseFloat(b.amount || '0'), 0) || 0;
    const groupRevenue = groupRevenueData?.reduce((sum, b) => sum + Number(b.amount || 0), 0) || 0;

    const totalRevenue = bookingRevenue + groupRevenue;

    // Get today's bookings
    const { data: todaysBookings } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_reference, customer_name, start_at, end_at, status, amount, resource:resources!bookings_resource_id_fkey(name)')
      .eq('booking_date', londonDate(new Date()))
      .eq('status', 'confirmed')
      .order('start_at');

    // Get upcoming bookings (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const { data: upcomingBookings } = await supabaseAdmin
      .from('bookings')
      .select('id, booking_reference, customer_name, start_at, end_at, status, amount, resource:resources!bookings_resource_id_fkey(name)')
      .gte('start_at', new Date().toISOString())
      .lt('start_at', nextWeek.toISOString())
      .eq('status', 'confirmed')
      .order('start_at')
      .limit(10);

    // Resource utilization
    const { data: resources } = await supabaseAdmin
      .from('resources')
      .select('id, name, type, active');

    // Count bookings per resource
    const { data: resourceBookings } = await supabaseAdmin
      .from('bookings')
      .select('resource_id, id')
      .eq('status', 'confirmed')
      .gte('start_at', startDateStr);

    const resourceUtilization = resources?.map(r => ({
      ...r,
      bookings: resourceBookings?.filter(b => b.resource_id === r.id).length || 0
    })) || [];

    return NextResponse.json({
      success: true,
      stats: {
        totalBookings: totalBookings || 0,
        confirmedBookings: confirmedBookings || 0,
        pendingBookings: pendingBookings || 0,
        totalInquiries: totalInquiries || 0,
        newInquiries: newInquiries || 0,
        totalGroupBookings: totalGroupBookings || 0,
        totalRevenue: totalRevenue.toFixed(2),
        period
      },
      dailyActivity,
      todaysBookings: todaysBookings || [],
      upcomingBookings: upcomingBookings || [],
      resourceUtilization
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
