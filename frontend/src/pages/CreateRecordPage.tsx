import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createWork, getCartridge } from '../api';
import './CartridgeDetailPage.css';

interface Cartridge {
  id: number;
  name: string;
}

export default function CreateRecordPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cartridge, setCartridge] = useState<Cartridge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    description: '',
    note: '',
    performed_at: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const res = await getCartridge(Number(id));
        setCartridge({ id: res.data.id, name: res.data.name });
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
      await createWork({
        cartridge_id: Number(id),
        description: form.description,
        note: form.note.trim() || undefined,
        performed_at: new Date(form.performed_at).toISOString(),
      });
      navigate(`/cartridges/${id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Не удалось создать запись');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error && !cartridge) return <div className="error-banner">{error}</div>;

  return (
    <div className="detail-page">
      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate(`/cartridges/${id}`)}>
          ← Назад
        </button>
        <div className="detail-info">
          <h1>Добавить запись</h1>
        </div>
      </div>

      <div className="form-card">
        <form onSubmit={handleSubmit} className="entry-form">
          <div className="form-group">
            <label>Название картриджа</label>
            <input type="text" value={cartridge?.name || ''} disabled />
          </div>
          <div className="form-group">
            <label>Проведенная работа *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Опишите выполненную работу"
              rows={3}
              required
            />
          </div>
          <div className="form-group">
            <label>Примечание (необязательно)</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Дополнительная информация"
              rows={3}
            />
          </div>
          <div className="form-group" style={{ maxWidth: '220px' }}>
            <label>Дата *</label>
            <input
              type="date"
              value={form.performed_at}
              onChange={(e) => setForm((prev) => ({ ...prev, performed_at: e.target.value }))}
              required
            />
          </div>
          {error && <div className="error-banner">{error}</div>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Сохранение...' : 'Сохранить запись'}
          </button>
        </form>
      </div>
    </div>
  );
}
