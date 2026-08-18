'use client';

import { useEffect, useState } from 'react';

interface GroupSession {
  id: string;
  title: string;
  age_group: string;
  max_players: number;
  current_players: number;
  coach_name: string | null;
  schedule: string;
  price: string;
  active: boolean;
}

interface GroupSessionBooking {
  id: string;
  session_id: string;
  player_name: string;
  player_age: number | null;
  parent_name: string;
  parent_email: string;
  parent_phone: string;
  created_at: string;
  session?: { title: string; age_group: string };
}

export default function AdminGroupSessionsPage() {
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [bookings, setBookings] = useState<GroupSessionBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    age_group: '',
    max_players: 10,
    coach_name: '',
    schedule: '',
    price: '',
    active: true
  });

  useEffect(() => {
    fetchSessions();
    fetchBookings();
  }, []);

  async function fetchSessions() {
    try {
      const res = await fetch('/api/admin/group-sessions');
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBookings() {
    try {
      const res = await fetch('/api/admin/group-session-bookings');
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId ? { id: editingId, ...formData } : formData;

      const res = await fetch('/api/admin/group-sessions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        if (editingId) {
          setSessions(sessions.map(s => s.id === editingId ? data.session : s));
        } else {
          setSessions([...sessions, data.session]);
        }
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      const res = await fetch('/api/admin/group-sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !active })
      });
      const data = await res.json();
      if (data.success) {
        setSessions(sessions.map(s => s.id === id ? { ...s, active: !active } : s));
      }
    } catch (error) {
      console.error('Failed to toggle active:', error);
    }
  }

  async function deleteSession(id: string) {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      const res = await fetch(`/api/admin/group-sessions?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSessions(sessions.filter(s => s.id !== id));
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }

  async function deleteBooking(id: string) {
    if (!confirm('Remove this player from the session?')) return;
    try {
      const res = await fetch(`/api/admin/group-session-bookings?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setBookings(bookings.filter(b => b.id !== id));
        // Refresh sessions to update player counts
        fetchSessions();
      }
    } catch (error) {
      console.error('Failed to delete booking:', error);
    }
  }

  function editSession(session: GroupSession) {
    setEditingId(session.id);
    setFormData({
      title: session.title,
      age_group: session.age_group,
      max_players: session.max_players,
      coach_name: session.coach_name || '',
      schedule: session.schedule,
      price: session.price,
      active: session.active
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      title: '',
      age_group: '',
      max_players: 10,
      coach_name: '',
      schedule: '',
      price: '',
      active: true
    });
  }

  const filteredBookings = selectedSession
    ? bookings.filter(b => b.session_id === selectedSession)
    : bookings;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Group Sessions</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
        >
          Add Session
        </button>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Session</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Age Group</label>
                <input
                  type="text"
                  value={formData.age_group}
                  onChange={(e) => setFormData({ ...formData, age_group: e.target.value })}
                  placeholder="e.g., 8-12 years"
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Max Players</label>
                  <input
                    type="number"
                    value={formData.max_players}
                    onChange={(e) => setFormData({ ...formData, max_players: parseInt(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2"
                    min="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Price (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Coach Name</label>
                <input
                  type="text"
                  value={formData.coach_name}
                  onChange={(e) => setFormData({ ...formData, coach_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Schedule</label>
                <input
                  type="text"
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  placeholder="e.g., Mon 4-5pm"
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  id="active"
                  className="rounded"
                />
                <label htmlFor="active" className="text-sm text-foreground">Active</label>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border rounded-lg bg-background text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Sessions List */}
          <div className="bg-card rounded-lg shadow mb-8">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Sessions</h2>
            </div>
            {sessions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No sessions found</div>
            ) : (
              <div className="divide-y">
                {sessions.map((session) => (
                  <div key={session.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{session.title}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded ${session.active ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                          {session.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {session.age_group} • {session.schedule} • £{session.price}/session
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {session.current_players}/{session.max_players} players
                        {session.coach_name && ` • Coach: ${session.coach_name}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedSession(session.id)}
                        className="px-3 py-1 text-sm border rounded hover:bg-muted bg-background text-foreground"
                      >
                        View Bookings
                      </button>
                      <button
                        onClick={() => editSession(session)}
                        className="px-3 py-1 text-sm border rounded hover:bg-muted bg-background text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(session.id, session.active)}
                        className="px-3 py-1 text-sm border rounded hover:bg-muted bg-background text-foreground"
                      >
                        {session.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="px-3 py-1 text-sm border border-destructive/30 text-destructive rounded hover:bg-destructive/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bookings List */}
          <div className="bg-card rounded-lg shadow">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">
                {selectedSession ? `Bookings for ${sessions.find(s => s.id === selectedSession)?.title}` : 'All Bookings'}
              </h2>
              {selectedSession && (
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Show All
                </button>
              )}
            </div>
            {filteredBookings.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No bookings found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Player</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Parent</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Contact</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Session</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td className="px-4 py-3">
                          <div className="text-foreground">{booking.player_name}</div>
                          {booking.player_age && (
                            <div className="text-xs text-muted-foreground">Age: {booking.player_age}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{booking.parent_name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          <div>{booking.parent_email}</div>
                          <div className="text-xs">{booking.parent_phone}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {booking.session?.title}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteBooking(booking.id)}
                            className="text-destructive hover:underline text-sm"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}