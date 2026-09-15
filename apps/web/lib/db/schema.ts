// Database schema types for CricPro Academy

// Users table
export interface DbUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'public' | 'authenticated' | 'admin' | 'super_admin';
  created_at: string;
}

// Resources table
export interface DbResource {
  id: string;
  name: string;
  type: 'lane' | 'bowling_machine' | 'side_arm';
  active: boolean;
  capacity: number;
  peak_price: string;
  offpeak_price: string;
  created_at: string;
}

// Bookings table
export interface DbBooking {
  id: string;
  booking_reference: string;
  user_id: string | null;
  resource_id: string;
  service_type: 'lane_hire' | 'group_session' | 'bowling_machine' | 'side_arm' | 'coaching' | 'birthday_party';
  booking_date: string;
  start_at: string;
  end_at: string;
  status: 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'expired' | 'refunded';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  amount: string;
  stripe_session_id: string | null;
  expires_at: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  player_count: number | null;
  notes: string | null;
  created_at: string;
}

// Blocked slots table
export interface DbBlockedSlot {
  id: string;
  resource_id: string;
  start_at: string;
  end_at: string;
  reason: string;
  created_by: string | null;
  created_at: string;
}

// Group sessions table
export interface DbGroupSession {
  session_kind: 'group' | 'masterclass';
  id: string;
  title: string;
  age_group: string;
  max_players: number;
  current_players: number;
  coach_name: string | null;
  schedule: string;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  price: string;
  active: boolean;
  created_at: string;
}

// Group session bookings table
export interface DbGroupSessionBooking {
  status: 'pending_payment' | 'confirmed' | 'expired' | 'cancelled';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'failed';
  amount: string | null;
  stripe_session_id: string | null;
  expires_at: string | null;
  id: string;
  session_id: string;
  player_name: string;
  player_age: number | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  emergency_contact: string | null;
  medical_notes: string | null;
  skill_level: string | null;
  created_at: string;
}

// Inquiries table
export interface DbInquiry {
  id: string;
  type: 'coaching' | 'birthday_party' | 'contact' | 'general';
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: 'new' | 'contacted' | 'converted' | 'closed';
  metadata: string | null;
  created_at: string;
}

// Email jobs table
export interface DbEmailJob {
  id: string;
  recipient: string;
  subject: string;
  template: string;
  payload: string | null;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  sent_at: string | null;
  error: string | null;
  created_at: string;
}

// Audit logs table
export interface DbAuditLog {
  id: string;
  admin_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: string | null;
  created_at: string;
}