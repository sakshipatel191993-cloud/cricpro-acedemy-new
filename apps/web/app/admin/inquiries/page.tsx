'use client';

import { useEffect, useState } from 'react';

interface Inquiry {
  id: string;
  type: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  status: string;
  created_at: string;
}

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(total / 20);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  useEffect(() => {
    fetchInquiries();
  }, [statusFilter, typeFilter, page]);

  async function fetchInquiries() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);
      params.set('page', page.toString());

      const res = await fetch(`/api/admin/inquiries?${params}`);
      const data = await res.json();
      if (data.success) {
        setInquiries(data.inquiries);
        setTotal(data.total);
      }
    } catch (error) {
      console.error('Failed to fetch inquiries:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      const res = await fetch('/api/admin/inquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setInquiries(inquiries.map(i => i.id === id ? { ...i, status: newStatus } : i));
      }
    } catch (error) {
      console.error('Failed to update inquiry:', error);
    }
  }

  async function deleteInquiry(id: string) {
    if (!confirm('Are you sure you want to delete this inquiry?')) return;
    try {
      const res = await fetch(`/api/admin/inquiries?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setInquiries(inquiries.filter(i => i.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete inquiry:', error);
    }
  }

  const statusColors: Record<string, string> = {
    new: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-400',
    contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-400',
    converted: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-400',
    closed: 'bg-muted text-muted-foreground'
  };

  const typeLabels: Record<string, string> = {
    coaching: 'Coaching',
    birthday_party: 'Birthday Party',
    contact: 'Contact',
    general: 'General'
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Inquiries</h1>
        <div className="flex gap-2">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="border rounded-lg px-4 py-2 bg-background text-foreground"
          >
            <option value="">All Types</option>
            <option value="coaching">Coaching</option>
            <option value="birthday_party">Birthday Party</option>
            <option value="contact">Contact</option>
            <option value="general">General</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border rounded-lg px-4 py-2 bg-background text-foreground"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : inquiries.length === 0 ? (
        <div className="bg-card rounded-lg shadow p-8 text-center text-muted-foreground">
          No inquiries found
        </div>
      ) : (
        <>
          <div className="bg-card rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {inquiries.map((inquiry) => (
                    <tr key={inquiry.id} className="hover:bg-muted">
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">{typeLabels[inquiry.type]}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{inquiry.name}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{inquiry.email}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{inquiry.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(inquiry.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={inquiry.status}
                          onChange={(e) => updateStatus(inquiry.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded border ${statusColors[inquiry.status]}`}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="converted">Converted</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedInquiry(inquiry)}
                          className="text-primary hover:underline text-sm mr-2"
                        >
                          View
                        </button>
                        <button
                          onClick={() => deleteInquiry(inquiry.id)}
                          className="text-destructive hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 border rounded disabled:opacity-50 bg-background text-foreground"
              >
                Previous
              </button>
              <span className="text-muted-foreground">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 border rounded disabled:opacity-50 bg-background text-foreground"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Inquiry Detail Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-lg">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-semibold">Inquiry Details</h2>
              <button
                onClick={() => setSelectedInquiry(null)}
                className="text-muted-foreground hover:text-foreground text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Type</label>
                  <p className="font-medium">{typeLabels[selectedInquiry.type]}</p>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <p className="font-medium capitalize">{selectedInquiry.status}</p>
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <p className="font-medium">{selectedInquiry.name}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Email</label>
                <p className="font-medium">{selectedInquiry.email}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Phone</label>
                <p className="font-medium">{selectedInquiry.phone || 'Not provided'}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Message</label>
                <p className="mt-1 p-3 bg-muted rounded text-foreground">{selectedInquiry.message}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Received</label>
                <p className="text-foreground">
                  {new Date(selectedInquiry.created_at).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={() => {
                  window.location.href = `mailto:${selectedInquiry.email}?subject=Re: Your Inquiry`;
                }}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Reply by Email
              </button>
              <button
                onClick={() => setSelectedInquiry(null)}
                className="px-4 py-2 border rounded-lg bg-background text-foreground"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}