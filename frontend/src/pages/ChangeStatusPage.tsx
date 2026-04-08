import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCartridge, updateCartridge } from '../api';
import './CartridgeDetailPage.css';

type CartridgeStatus = 'refill' | 'ready_to_install' | 'installed' | 'broken';

const statusLabel: Record<CartridgeStatus, string> = {
  refill: 'На заправке',
  ready_to_install: 'Готов к установке',
  installed: 'Установлен',
  broken: 'Сломан',
};

interface Cartridge {
  id: number;
  name: string;
  status: CartridgeStatus;
}

export default function ChangeStatusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cartridge, setCartridge] = useState<Cartridge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<{ status: CartridgeStatus; reason: string }>({
    status: 'refill',
    reason: '',
  });

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await getCartridge(Number(id));
        setCartridge({ id: res.data.id, name: res.data.name, status: res.data.status });
        setForm((prev) => ({ ...prev, status: res.data.status || 'refill' }));
      } catch {
        setError('Картридж не найден');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setError('');
    setSubmitting(true);
    try {
      await updateCartridge(Number(id), {
        status: form.status,
        status_reason: form.reason.trim() || undefined,
      });
      navigate(`/cartridges/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Не удалось обновить статус');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error && !cartridge) return <div className="error-banner">{error}</div>;

  return (
    <div className="detail-page">
      <div className="detail-header hero-card">
        <div className="detail-header-main">
          <button className="btn-back" onClick={() => navigate(`/cartridges/${id}`)}>
            ← Назад
          </button>
          <div className="detail-info">
            <h1>Изменение статуса</h1>
            <div className="detail-meta">
              <span className="meta-badge model">{cartridge?.name}</span>
              {cartridge && (
                <span className={`meta-badge status status-${cartridge.status}`}>
                  Текущий: {statusLabel[cartridge.status]}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="form-card glass-card">
        <form onSubmit={handleSubmit} className="entry-form">
          <div className="form-group" style={{ maxWidth: '360px' }}>
            <label>Новый статус *</label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, status: e.target.value as CartridgeStatus }))
              }
              required
            >
              <option value="refill">На заправке</option>
              <option value="ready_to_install">Готов к установке</option>
              <option value="installed">Установлен</option>
              <option value="broken">Сломан</option>
            </select>
          </div>

          <div className="form-group">
            <label>Причина (необязательно)</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Почему был изменен статус"
              rows={3}
            />
          </div>

          {error && <div className="error-banner">{error}</div>}

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Сохранение...' : 'Сохранить статус'}
          </button>
        </form>
      </div>
    </div>
  );
}
