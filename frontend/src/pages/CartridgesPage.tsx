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
  formatted_number?: string;
  status: 'refill' | 'ready_to_install' | 'installed' | 'broken';
  created_at: string;
}

const statusLabel: Record<Cartridge['status'], string> = {
  refill: 'На заправке',
  ready_to_install: 'Готов к установке',
  installed: 'Установлен',
  broken: 'Сломан',
};

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
      setError('Не удалось загрузить картриджи');
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
      setFormError(err.response?.data?.message || 'Не удалось создать картридж');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Удалить картридж "${name}"? Также будут удалены все работы и примечания.`)) return;
    try {
      await deleteCartridge(id);
      setCartridges((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('Не удалось удалить картридж');
    }
  };

  return (
    <div className="cartridges-page">
      <div className="page-header">
        <div>
          <h1>Картриджи</h1>
          <p className="subtitle">Управление картриджами и записями по обслуживанию</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'editor') && (
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Отмена' : '+ Добавить картридж'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="form-card">
          <h2>Новый картридж</h2>
          <form onSubmit={handleCreate} className="inline-form">
            <div className="form-row">
              <div className="form-group">
                <label>Название *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Например, HP LaserJet 85A"
                  required
                />
              </div>
              <div className="form-group">
                <label>Модель *</label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="Например, CE285A"
                  required
                />
              </div>
              <div className="form-group">
                <label>Серийный номер</label>
                <input
                  type="text"
                  value={form.serial_number}
                  onChange={(e) =>
                    setForm({ ...form, serial_number: e.target.value })
                  }
                  placeholder="Необязательно"
                />
              </div>
            </div>
            {formError && <div className="error-banner">{formError}</div>}
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Создание...' : 'Создать картридж'}
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
            placeholder="Поиск по названию, модели или серийному номеру..."
            className="search-input"
          />
          <button type="submit" className="btn-search">Найти</button>
          {search && (
            <button
              type="button"
              className="btn-clear"
              onClick={() => {
                setSearch('');
                fetchCartridges();
              }}
            >
              Сброс
            </button>
          )}
        </form>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Загрузка картриджей...</div>
      ) : cartridges.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">🖨️</span>
          <p>Картриджи не найдены</p>
          {search && <p className="hint">Попробуйте изменить запрос</p>}
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
                {c.formatted_number && <p className="card-serial">№ {c.formatted_number}</p>}
                <p className="card-serial">Статус: {statusLabel[c.status]}</p>
                {c.serial_number && (
                  <p className="card-serial">S/N: {c.serial_number}</p>
                )}
                <p className="card-date">
                  Добавлен: {new Date(c.created_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
              {user?.role === 'admin' && (
                <button
                  className="btn-delete-card"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(c.id, c.name);
                  }}
                  title="Удалить картридж"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
