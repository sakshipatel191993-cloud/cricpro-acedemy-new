'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Resource {
  id: string;
  name: string;
  type: string;
  active: boolean;
  capacity: number;
}

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'lane',
    active: true,
    capacity: 6,
  });

  useEffect(() => {
    fetchResources();
  }, []);

  async function fetchResources() {
    try {
      const res = await fetch('/api/admin/resources');
      const data = await res.json();
      if (data.success) {
        setResources(data.resources);
      }
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const url = editingId ? '/api/admin/resources' : '/api/admin/resources';
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
          setResources(resources.map(r => r.id === editingId ? data.resource : r));
        } else {
          setResources([...resources, data.resource]);
        }
        resetForm();
      }
    } catch (error) {
      console.error('Failed to save resource:', error);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    try {
      const res = await fetch('/api/admin/resources', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: !active })
      });
      const data = await res.json();
      if (data.success) {
        setResources(resources.map(r => r.id === id ? { ...r, active: !active } : r));
      }
    } catch (error) {
      console.error('Failed to toggle active:', error);
    }
  }

  async function deleteResource(id: string) {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      const res = await fetch(`/api/admin/resources?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setResources(resources.filter(r => r.id !== id));
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete resource:', error);
    }
  }

  function editResource(resource: Resource) {
    setEditingId(resource.id);
    setFormData({
      name: resource.name,
      type: resource.type,
      active: resource.active,
      capacity: resource.capacity,
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      type: 'lane',
      active: true,
      capacity: 6,
    });
  }

  const typeLabels: Record<string, string> = {
    lane: 'Lane',
    bowling_machine: 'Bowling Machine',
    side_arm: 'Side Arm'
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Resources</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90"
        >
          Add Resource
        </button>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">{editingId ? 'Edit' : 'Add'} Resource</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                >
                  <option value="lane">Lane</option>
                  <option value="bowling_machine">Bowling Machine</option>
                  <option value="side_arm">Side Arm</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Capacity</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
                  min="1"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map((resource) => (
            <div key={resource.id} className="bg-card rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-foreground">{resource.name}</h3>
                  <span className="text-sm text-muted-foreground">{typeLabels[resource.type]}</span>
                </div>
                <span className={`px-2 py-1 text-xs rounded ${resource.active ? 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                  {resource.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Capacity</span>
                  <span className="text-foreground">{resource.capacity} players</span>
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Link
                  href={`/admin/resources/${resource.id}/availability-rules`}
                  className="flex-1 px-3 py-2 text-sm border rounded hover:bg-muted bg-background text-foreground text-center"
                >
                  Settings
                </Link>
                <button
                  onClick={() => toggleActive(resource.id, resource.active)}
                  className="flex-1 px-3 py-2 text-sm border rounded hover:bg-muted bg-background text-foreground"
                >
                  {resource.active ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => editResource(resource)}
                  className="flex-1 px-3 py-2 text-sm border rounded hover:bg-muted bg-background text-foreground"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteResource(resource.id)}
                  className="flex-1 px-3 py-2 text-sm border border-destructive/30 text-destructive rounded hover:bg-destructive/10"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}