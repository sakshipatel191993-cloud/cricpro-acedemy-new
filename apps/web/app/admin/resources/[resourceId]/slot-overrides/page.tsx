'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface SlotOverride {
  id: string;
  slot_date: string;
  start_at: string;
  end_at: string;
  custom_price: string | null;
  blocked: boolean;
  reason: string | null;
}

export default function SlotOverridesPage() {
  const { resourceId } = useParams();
  const [overrides, setOverrides] = useState<SlotOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    slot_date: '',
    start_at: '',
    end_at: '',
    custom_price: '',
    blocked: false,
    reason: ''
  });

  useEffect(() => {
    fetchOverrides();
  }, [resourceId]);

  async function fetchOverrides() {
    try {
      const res = await fetch(`/api/admin/resources/${resourceId}/slot-overrides`);
      const data = await res.json();
      if (data.success) {
        setOverrides(data.overrides);
      }
    } catch (error) {
      console.error('Failed to fetch overrides:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = `/api/admin/resources/${resourceId}/slot-overrides`;
      const method = editingId ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = { ...formData };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        if (editingId) {
          setOverrides(overrides.map(o => o.id === editingId ? data.override : o));
        } else {
          setOverrides([...overrides, data.override]);
        }
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save override:', error);
    }
  }

  async function deleteOverride(id: string) {
    if (!confirm('Are you sure?')) return;
    try {
      const res = await fetch(`/api/admin/resources/${resourceId}/slot-overrides?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setOverrides(overrides.filter(o => o.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete override:', error);
    }
  }

  function editOverride(override: SlotOverride) {
    setEditingId(override.id);
    setFormData({
      slot_date: override.slot_date,
      start_at: override.start_at,
      end_at: override.end_at,
      custom_price: override.custom_price || '',
      blocked: override.blocked,
      reason: override.reason || ''
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      slot_date: '',
      start_at: '',
      end_at: '',
      custom_price: '',
      blocked: false,
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
        <h1 className="text-2xl font-bold text-foreground">Slot Overrides</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
        >
          Add Override
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Slot Override</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Date</label>
                <input
                  type="date"
                  value={formData.slot_date}
                  onChange={(e) => setFormData({ ...formData, slot_date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Start Time</label>
                  <input
                    type="datetime-local"
                    value={formData.start_at}
                    onChange={(e) => setFormData({ ...formData, start_at: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">End Time</label>
                  <input
                    type="datetime-local"
                    value={formData.end_at}
                    onChange={(e) => setFormData({ ...formData, end_at: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Custom Price (£) {formData.blocked && '(ignored if blocked)'}</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.custom_price}
                  onChange={(e) => setFormData({ ...formData, custom_price: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  disabled={formData.blocked}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.blocked}
                  onChange={(e) => setFormData({ ...formData, blocked: e.target.checked })}
                  id="blocked"
                  className="rounded"
                />
                <label htmlFor="blocked" className="text-sm text-foreground">Block this slot</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Reason</label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Special event, maintenance, etc."
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
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Time Range</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {overrides.map((override) => (
              <tr key={override.id}>
                <td className="px-6 py-4 text-sm text-foreground">{override.slot_date}</td>
                <td className="px-6 py-4 text-sm text-foreground">
                  {new Date(override.start_at).toLocaleTimeString()} - {new Date(override.end_at).toLocaleTimeString()}
                </td>
                <td className="px-6 py-4 text-sm text-foreground">
                  {override.blocked ? 'Blocked' : override.custom_price ? `£${override.custom_price}` : 'Default'}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded ${override.blocked ? 'bg-red-100 text-destructive dark:bg-red-500/15 dark:text-red-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400'}`}>
                    {override.blocked ? 'Blocked' : 'Custom Price'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm">
                  <button
                    onClick={() => editOverride(override)}
                    className="text-primary hover:text-primary/80 mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteOverride(override.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {overrides.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">No slot overrides configured.</div>
        )}
      </div>
    </div>
  );
}