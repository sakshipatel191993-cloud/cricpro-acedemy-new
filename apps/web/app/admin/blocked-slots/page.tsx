'use client';

import { useEffect, useState } from 'react';

interface BlockedSlot {
  id: string;
  resource_id: string;
  start_at: string;
  end_at: string;
  reason: string;
  created_by?: string;
  resource?: { name: string; type: string };
}

interface Resource {
  id: string;
  name: string;
}

export default function AdminBlockedSlotsPage() {
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    resource_id: '',
    start_at: '',
    end_at: '',
    reason: ''
  });

  useEffect(() => {
    fetchBlockedSlots();
    fetchResources();
  }, []);

  async function fetchBlockedSlots() {
    try {
      const res = await fetch('/api/admin/blocked-slots');
      const data = await res.json();
      if (data.success) {
        setBlockedSlots(data.blockedSlots);
      }
    } catch (error) {
      console.error('Failed to fetch blocked slots:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchResources() {
    try {
      const res = await fetch('/api/admin/resources');
      const data = await res.json();
      if (data.success) {
        setResources(data.resources);
      }
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/blocked-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (data.success) {
        setBlockedSlots([...blockedSlots, data.blockedSlot]);
        resetForm();
      } else {
        alert(data.error || 'Failed to create blocked slot');
      }
    } catch (error) {
      console.error('Failed to save blocked slot:', error);
    }
  }

  async function deleteBlockedSlot(id: string) {
    if (!confirm('Are you sure you want to unblock this slot?')) return;
    try {
      const res = await fetch(`/api/admin/blocked-slots?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setBlockedSlots(blockedSlots.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete blocked slot:', error);
    }
  }

  function resetForm() {
    setShowForm(false);
    setFormData({
      resource_id: '',
      start_at: '',
      end_at: '',
      reason: ''
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Blocked Slots</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
        >
          Block Slot
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Block a Slot</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Resource</label>
                <select
                  value={formData.resource_id}
                  onChange={(e) => setFormData({ ...formData, resource_id: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                  required
                >
                  <option value="">Select a resource</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Start Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.start_at}
                  onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={formData.end_at}
                  onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Reason</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                  placeholder="Maintenance, event, etc."
                  required
                />
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
                  Block Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Resource</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Start</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">End</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Reason</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {blockedSlots.map((slot) => (
                <tr key={slot.id}>
                  <td className="px-4 py-4 text-sm text-foreground">{slot.resource?.name || slot.resource_id}</td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {new Date(slot.start_at).toLocaleString([], { timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-4 text-sm text-muted-foreground">
                    {new Date(slot.end_at).toLocaleString([], { timeZone: 'UTC' })}
                  </td>
                  <td className="px-4 py-4 text-sm text-foreground">{slot.reason}</td>
                  <td className="px-4 py-4 text-right text-sm">
                    <button
                      onClick={() => deleteBlockedSlot(slot.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Unblock
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {blockedSlots.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">No blocked slots configured.</div>
        )}
      </div>
    </div>
  );
}