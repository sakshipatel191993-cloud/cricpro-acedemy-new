'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface AvailabilityRule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_mins: number;
  buffer_mins: number;
  active: boolean;
}

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AvailabilityRulesPage() {
  const { resourceId } = useParams();
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '17:00',
    slot_duration_mins: 60,
    buffer_mins: 0,
    active: true
  });

  useEffect(() => {
    fetchRules();
  }, [resourceId]);

  async function fetchRules() {
    try {
      const res = await fetch(`/api/admin/resources/${resourceId}/availability-rules`);
      const data = await res.json();
      if (data.success) {
        setRules(data.rules);
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = `/api/admin/resources/${resourceId}/availability-rules`;
      const method = editingId ? 'PATCH' : 'POST';
      const body = editingId ? { id: editingId, ...formData } : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        if (editingId) {
          setRules(rules.map(r => r.id === editingId ? data.rule : r));
        } else {
          setRules([...rules, data.rule]);
        }
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save rule:', error);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      const res = await fetch(`/api/admin/resources/${resourceId}/availability-rules`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !active })
      });
      const data = await res.json();
      if (data.success) {
        setRules(rules.map(r => r.id === id ? { ...r, active: !active } : r));
      }
    } catch (error) {
      console.error('Failed to toggle active:', error);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm('Are you sure?')) return;
    try {
      const res = await fetch(`/api/admin/resources/${resourceId}/availability-rules?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setRules(rules.filter(r => r.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  }

  function editRule(rule: AvailabilityRule) {
    setEditingId(rule.id);
    setFormData({
      day_of_week: rule.day_of_week,
      start_time: rule.start_time,
      end_time: rule.end_time,
      slot_duration_mins: rule.slot_duration_mins,
      buffer_mins: rule.buffer_mins,
      active: rule.active
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      day_of_week: 1,
      start_time: '09:00',
      end_time: '17:00',
      slot_duration_mins: 60,
      buffer_mins: 0,
      active: true
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
        <h1 className="text-2xl font-bold text-foreground">Availability Rules</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
        >
          Add Rule
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Availability Rule</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Day of Week</label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) => setFormData({ ...formData, day_of_week: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                >
                  {dayNames.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Start Time</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">End Time</label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Slot Duration (mins)</label>
                  <input
                    type="number"
                    value={formData.slot_duration_mins}
                    onChange={(e) => setFormData({ ...formData, slot_duration_mins: parseInt(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                    min="15"
                    step="15"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Buffer (mins)</label>
                  <input
                    type="number"
                    value={formData.buffer_mins}
                    onChange={(e) => setFormData({ ...formData, buffer_mins: parseInt(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                    min="0"
                  />
                </div>
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

      <div className="bg-card rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Day</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Hours</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Slot Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-6 py-4 text-sm text-foreground">{dayNames[rule.day_of_week]}</td>
                <td className="px-6 py-4 text-sm text-foreground">{rule.start_time} - {rule.end_time}</td>
                <td className="px-6 py-4 text-sm text-foreground">{rule.slot_duration_mins} mins</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded ${rule.active ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                    {rule.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm">
                  <button
                    onClick={() => toggleActive(rule.id, rule.active)}
                    className="text-muted-foreground hover:text-foreground mr-2"
                  >
                    {rule.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => editRule(rule)}
                    className="text-primary hover:text-primary/80 mr-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">No availability rules configured.</div>
        )}
      </div>
    </div>
  );
}