import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCartridges, createCartridge, deleteCartridge } from '../api';
import { useAuthStore } from '../store/authStore';
import './CartridgesPage.css';

interface Cartridge {
  id: number;
  name: string;
  model: string;
  serial_number?: string;
  created_at: string;
}

export default function CartridgesPage() {
  const [cartridges, setCartridges] = useState<Cartridge[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', model: '', serial_number: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const fetchCartridges = async (q?: string) => {
    try {
      setLoading(true);
      const res = await getCartridges(q);
      setCartridges(res.data);
    } catch {
      setError('Failed to load cartridges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCartridges();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCartridges(search.trim() || undefined);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await createCartridge(form);
      setShowForm(false);
      setForm({ name: '', model: '', serial_number: '' });
      fetchCartridges(search || undefined);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create cartridge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete cartridge "${name}"? This will also remove all works and notes.`)) return;
    try {
      await deleteCartridge(id);
      setCartridges((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Failed to delete cartridge');
    }
  };

  return (
    <div className="cartridges-page">
      <div className="page-header">
        <div>
          <h1>Cartridges</h1>
          <p className="subtitle">Manage printer cartridges and their maintenance records</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'editor') && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Cancel' : '+ Add Cartridge'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="form-card">
          <h2>New Cartridge</h2>
          <form onSubmit={handleCreate} className="inline-form">
            <div className="form-row">
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. HP LaserJet 85A"
                  required
                />
              </div>
              <div className="form-group">
                <label>Model *</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="e.g. CE285A"
                  required
                />
              </div>
              <div className="form-group">
                <label>Serial Number</label>
                <input
                  type="text"
                  value={form.serial_number}
                  onChange={(e) =>
                    setForm({ ...form, serial_number: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
            {formError && <div className="error-banner">{formError}</div>}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Cartridge'}
            </button>
          </form>
        </div>
      )}

      <div className="search-bar">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, model, or serial number..."
            className="search-input"
          />
          <button type="submit" className="btn-search">Search</button>
          {search && (
            <button
              type="button"
              className="btn-clear"
              onClick={() => {
                setSearch('');
                fetchCartridges();
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading cartridges...</div>
      ) : cartridges.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🖨️</span>
          <p>No cartridges found</p>
          {search && <p className="hint">Try a different search term</p>}
        </div>
      ) : (
        <div className="cartridges-grid">
          {cartridges.map((c) => (
            <div
              key={c.id}
              className="cartridge-card"
              onClick={() => navigate(`/cartridges/${c.id}`)}
            >
              <div className="card-icon">🖨️</div>
              <div className="card-body">
                <h3 className="card-title">{c.name}</h3>
                <p className="card-model">{c.model}</p>
                {c.serial_number && (
                  <p className="card-serial">S/N: {c.serial_number}</p>
                )}
                <p className="card-date">
                  Added: {new Date(c.created_at).toLocaleDateString()}
                </p>
              </div>
              {user?.role === 'admin' && (
                <button
                  className="btn-delete-card"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id, c.name);
                  }}
                  title="Delete cartridge"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
