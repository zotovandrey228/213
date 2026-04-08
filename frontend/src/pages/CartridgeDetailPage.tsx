import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCartridge,
  deleteWork,
} from '../api';
import { useAuthStore } from '../store/authStore';
import './CartridgeDetailPage.css';

interface User {
  id: number;
  username: string;
}

interface Work {
  id: number;
  description: string;
  note?: string;
  performed_at: string;
  performed_by?: User;
  created_at: string;
}

interface Cartridge {
  id: number;
  name: string;
  model: string;
  number?: number;
  formatted_number?: string;
  serial_number?: string;
  status: 'refill' | 'ready_to_install' | 'installed' | 'broken';
  status_logs?: Array<{
    id: number;
    from_status: 'refill' | 'ready_to_install' | 'installed' | 'broken';
    to_status: 'refill' | 'ready_to_install' | 'installed' | 'broken';
    reason?: string;
    changed_at: string;
    changed_by?: User;
  }>;
  created_at: string;
  updated_at: string;
  works: Work[];
}

const statusLabel: Record<
  'refill' | 'ready_to_install' | 'installed' | 'broken',
  string
> = {
  refill: 'На заправке',
  ready_to_install: 'Готов к установке',
  installed: 'Установлен',
  broken: 'Сломан',
};

export default function CartridgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [cartridge, setCartridge] = useState<Cartridge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'works' | 'logs'>('works');

  const canEdit = user?.role === 'admin' || user?.role === 'editor';

  const fetchCartridge = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await getCartridge(parseInt(id));
      setCartridge(res.data);
    } catch {
      setError('Картридж не найден');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCartridge();
  }, [id]);

  const handleDeleteWork = async (workId: number) => {
    if (!confirm('Удалить эту запись о работе?')) return;
    try {
      await deleteWork(workId);
      fetchCartridge();
    } catch {
      alert('Не удалось удалить запись о работе');
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error || !cartridge) return <div className="error-banner">{error || 'Не найдено'}</div>;

  return (
    <div className="detail-page">
      <div className="detail-header hero-card">
        <div className="detail-header-main">
          <button className="btn-back" onClick={() => navigate('/cartridges')}>
            ← Назад
          </button>
          <div className="detail-info">
            <h1>
              <span className="detail-icon">🖨️</span> {cartridge.name}
            </h1>
            <div className="detail-meta">
              <span className="meta-badge model">{cartridge.model}</span>
              {cartridge.formatted_number && (
                <span className="meta-badge serial">№ {cartridge.formatted_number}</span>
              )}
              {cartridge.serial_number && (
                <span className="meta-badge serial">S/N: {cartridge.serial_number}</span>
              )}
              <span className="meta-badge date">
                Добавлен: {new Date(cartridge.created_at).toLocaleDateString('ru-RU')}
              </span>
              <span className={`meta-badge status status-${cartridge.status}`}>
                Статус: {statusLabel[cartridge.status]}
              </span>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="detail-header-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(`/cartridges/${id}/new-record`)}
            >
              Добавить запись
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(`/cartridges/${id}/change-status`)}
            >
              Изменить статус
            </button>
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'works' ? 'active' : ''}`}
          onClick={() => setActiveTab('works')}
        >
          🔧 Работы ({cartridge.works.length})
        </button>
        <button
          className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          🧾 Логи статусов ({cartridge.status_logs?.length || 0})
        </button>
      </div>

      {activeTab === 'works' && (
        <div className="tab-content">
          {cartridge.works.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔧</span>
              <p>Пока нет записей о работах</p>
            </div>
          ) : (
            <div className="entries-list">
              {cartridge.works
                .slice()
                .sort(
                  (a, b) =>
                    new Date(b.performed_at).getTime() -
                    new Date(a.performed_at).getTime(),
                )
                .map((w) => (
                  <div key={w.id} className="entry-card">
                    <div className="entry-header">
                      <span className="entry-date">
                        📅 {new Date(w.performed_at).toLocaleDateString('ru-RU')}
                      </span>
                      {w.performed_by && (
                        <span className="entry-author">👤 {w.performed_by.username}</span>
                      )}
                      {canEdit && (
                        <button
                          className="btn-delete-entry"
                          onClick={() => handleDeleteWork(w.id)}
                          title="Удалить запись"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <p className="entry-content">{w.description}</p>
                    {w.note && <p className="entry-content note-inline">Примечание: {w.note}</p>}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="tab-content">
          <div className="form-card glass-card">
            <h3>Журнал изменения статуса</h3>
            {!cartridge.status_logs || cartridge.status_logs.length === 0 ? (
              <p className="entry-content muted">Изменений статуса пока нет</p>
            ) : (
              <div className="entries-list compact">
                {cartridge.status_logs
                  .slice()
                  .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
                  .map((log) => (
                    <div key={log.id} className="entry-card timeline-card">
                      <div className="entry-header">
                        <span className="entry-date">
                          📅 {new Date(log.changed_at).toLocaleString('ru-RU')}
                        </span>
                        <span className="entry-author">
                          {statusLabel[log.from_status]} → {statusLabel[log.to_status]}
                        </span>
                        {log.changed_by && (
                          <span className="entry-author">👤 {log.changed_by.username}</span>
                        )}
                      </div>
                      {log.reason && <p className="entry-content">Причина: {log.reason}</p>}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
