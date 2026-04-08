import { useState, useEffect } from 'react';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getRegions,
  createRegion,
  deleteRegion,
  createCartridge,
  getCartridgeNextNumber,
  getCartridgeNameSuggestions,
  getCartridges,
  deleteCartridge,
} from '../api';
import './AdminPage.css';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
  tg_id?: string;
  created_at: string;
}

interface Region {
  id: number;
  name: string;
  code: number | null;
}

interface Cartridge {
  id: number;
  name: string;
  formatted_number?: string;
  status: CartridgeStatus;
  created_at: string;
}

type CartridgeStatus = 'refill' | 'ready_to_install' | 'installed' | 'broken';

const statusLabel: Record<CartridgeStatus, string> = {
  refill: 'На заправке',
  ready_to_install: 'Готов к установке',
  installed: 'Установлен',
  broken: 'Сломан',
};

const displayRegionCode = (code: number | null) => {
  if (code === null || code === undefined || Number.isNaN(Number(code))) {
    return '----';
  }
  return String(Number(code));
};

const EMPTY_FORM = {
  username: '',
  password: '',
  role: 'viewer' as 'admin' | 'editor' | 'viewer',
  tg_id: '',
};

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [cartridges, setCartridges] = useState<Cartridge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [regionName, setRegionName] = useState('');
  const [regionCode, setRegionCode] = useState('');
  const [regionError, setRegionError] = useState('');
  const [regionSubmitting, setRegionSubmitting] = useState(false);

  const [cartridgeForm, setCartridgeForm] = useState({
    name: '',
    region_id: '',
    number: '',
    formatted_number: '',
    status: 'refill' as CartridgeStatus,
    comment: '',
  });
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cartridgeError, setCartridgeError] = useState('');
  const [cartridgeSubmitting, setCartridgeSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await getUsers();
      setUsers(res.data);
    } catch {
      setError('Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  };

  const fetchRegions = async () => {
    try {
      const res = await getRegions();
      setRegions(res.data);
    } catch {
      setRegionError('Не удалось загрузить регионы');
    }
  };

  const fetchCartridges = async () => {
    try {
      const res = await getCartridges();
      setCartridges(res.data);
    } catch {
      setError('Не удалось загрузить картриджи');
    }
  };

  const fetchNextNumber = async () => {
    try {
      const regionId = cartridgeForm.region_id ? Number(cartridgeForm.region_id) : undefined;
      const res = await getCartridgeNextNumber(regionId);
      setCartridgeForm((prev) => ({
        ...prev,
        number: String(res.data.number),
        formatted_number: res.data.formatted_number || '',
      }));
    } catch {
      setCartridgeError('Не удалось получить следующий номер');
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRegions();
    fetchCartridges();
    fetchNextNumber();
  }, []);

  useEffect(() => {
    const query = cartridgeForm.name.trim();
    if (!query) {
      setNameSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await getCartridgeNameSuggestions(query);
        setNameSuggestions(res.data || []);
        setShowSuggestions(true);
      } catch {
        setNameSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [cartridgeForm.name]);

  useEffect(() => {
    if (!cartridgeForm.region_id) {
      setCartridgeForm((prev) => ({ ...prev, formatted_number: '' }));
      return;
    }

    const region = regions.find((r) => r.id === Number(cartridgeForm.region_id));
    const num = Number(cartridgeForm.number);
    if (!region || !num) {
      setCartridgeForm((prev) => ({ ...prev, formatted_number: '' }));
      return;
    }

    const formatted = `${displayRegionCode(region.code)}_${String(num).padStart(4, '0')}`;
    setCartridgeForm((prev) => ({ ...prev, formatted_number: formatted }));
  }, [cartridgeForm.region_id, cartridgeForm.number, regions]);

  const openCreate = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: '',
      role: user.role,
      tg_id: user.tg_id || '',
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (editingUser) {
        const updateData: any = {
          role: form.role,
          tg_id: form.tg_id || undefined,
        };
        if (form.password) updateData.password = form.password;
        await updateUser(editingUser.id, updateData);
      } else {
        await createUser({
          username: form.username,
          password: form.password,
          role: form.role,
          tg_id: form.tg_id || undefined,
        });
      }
      setShowForm(false);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Не удалось сохранить пользователя');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Удалить пользователя "${user.username}"?`)) return;
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch {
      alert('Не удалось удалить пользователя');
    }
  };

  const handleCreateRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegionError('');
    setRegionSubmitting(true);

    try {
      await createRegion({ name: regionName.trim(), code: Number(regionCode) });
      setRegionName('');
      setRegionCode('');
      await fetchRegions();
    } catch (err: any) {
      setRegionError(err.response?.data?.message || 'Не удалось создать регион');
    } finally {
      setRegionSubmitting(false);
    }
  };

  const handleDeleteRegion = async (region: Region) => {
    if (!confirm(`Удалить регион "${region.name}"?`)) return;

    try {
      await deleteRegion(region.id);
      setRegions((prev) => prev.filter((r) => r.id !== region.id));
      if (cartridgeForm.region_id === String(region.id)) {
        setCartridgeForm((prev) => ({ ...prev, region_id: '' }));
      }
    } catch (err: any) {
      setRegionError(err.response?.data?.message || 'Не удалось удалить регион');
    }
  };

  const handleCreateCartridge = async (e: React.FormEvent) => {
    e.preventDefault();
    setCartridgeError('');
    setCartridgeSubmitting(true);

    try {
      await createCartridge({
        name: cartridgeForm.name.trim(),
        model: cartridgeForm.name.trim(),
        region_id: Number(cartridgeForm.region_id),
        number: Number(cartridgeForm.number),
        status: cartridgeForm.status,
        comment: cartridgeForm.comment.trim() || undefined,
      });

      const next = await getCartridgeNextNumber(Number(cartridgeForm.region_id));
      setCartridgeForm({
        name: '',
        region_id: cartridgeForm.region_id,
        number: String(next.data.number),
        formatted_number: next.data.formatted_number || '',
        status: 'refill',
        comment: '',
      });
      setNameSuggestions([]);
      setShowSuggestions(false);
      await fetchCartridges();
    } catch (err: any) {
      setCartridgeError(err.response?.data?.message || 'Не удалось создать картридж');
    } finally {
      setCartridgeSubmitting(false);
    }
  };

  const handleDeleteCartridge = async (cartridge: Cartridge) => {
    if (!confirm(`Удалить картридж "${cartridge.name}"?`)) return;
    try {
      await deleteCartridge(cartridge.id);
      setCartridges((prev) => prev.filter((c) => c.id !== cartridge.id));
    } catch {
      setError('Не удалось удалить картридж');
    }
  };

  const roleColors: Record<string, string> = {
    admin: 'role-admin',
    editor: 'role-editor',
    viewer: 'role-viewer',
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Админ-панель</h1>
          <p className="subtitle">Управление пользователями и правами доступа</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          + Добавить пользователя
        </button>
      </div>

      <div className="form-card">
        <h2>Регионы</h2>
        <form onSubmit={handleCreateRegion} className="region-form">
          <div className="form-group">
            <label>Название региона *</label>
            <input
              type="text"
              value={regionName}
              onChange={(e) => setRegionName(e.target.value)}
              placeholder="Например, Москва"
              required
            />
          </div>
          <div className="form-group region-code-group">
            <label>Цифра региона *</label>
            <input
              type="number"
              min={0}
              max={9999}
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              placeholder="Например, 43"
              required
            />
          </div>
          <button type="submit" className="btn-primary region-add-btn" disabled={regionSubmitting}>
            {regionSubmitting ? 'Добавление...' : '+ Добавить регион'}
          </button>
        </form>

        {regions.length > 0 && (
          <div className="regions-list">
            {regions.map((region) => (
              <div key={region.id} className="region-chip">
                <span>
                  {region.name} ({displayRegionCode(region.code)})
                </span>
                <button
                  type="button"
                  className="btn-chip-delete"
                  onClick={() => handleDeleteRegion(region)}
                  title="Удалить регион"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="form-card">
        <h2>Создать картридж</h2>
        <form onSubmit={handleCreateCartridge} className="user-form">
          <div className="form-row cartridge-form-row">
            <div className="form-group">
              <label>Название картриджа *</label>
              <input
                type="text"
                value={cartridgeForm.name}
                onFocus={async () => {
                  setShowSuggestions(true);
                  if (!cartridgeForm.name.trim()) {
                    try {
                      const res = await getCartridgeNameSuggestions();
                      setNameSuggestions(res.data || []);
                    } catch {
                      setNameSuggestions([]);
                    }
                  }
                }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onChange={(e) => {
                  setCartridgeForm((prev) => ({ ...prev, name: e.target.value }));
                  setShowSuggestions(true);
                }}
                placeholder="Введите название"
                required
              />
              {showSuggestions && nameSuggestions.length > 0 && (
                <div className="name-suggestions">
                  {nameSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="name-suggestion-item"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCartridgeForm((prev) => ({ ...prev, name }));
                        setShowSuggestions(false);
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Регион *</label>
              <select
                value={cartridgeForm.region_id}
                onChange={(e) => {
                  const value = e.target.value;
                  setCartridgeForm((prev) => ({ ...prev, region_id: value }));
                  if (value) {
                    getCartridgeNextNumber(Number(value))
                      .then((res) => {
                        setCartridgeForm((prev) => ({
                          ...prev,
                          number: String(res.data.number),
                          formatted_number: res.data.formatted_number || '',
                        }));
                      })
                      .catch(() => setCartridgeError('Не удалось получить следующий номер'));
                  }
                }}
                required
              >
                <option value="">Выберите регион</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name} ({displayRegionCode(region.code)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Номер *</label>
              <input
                type="number"
                min={1}
                value={cartridgeForm.number}
                onChange={(e) =>
                  setCartridgeForm((prev) => ({ ...prev, number: e.target.value }))
                }
                required
              />
            </div>

            <div className="form-group">
              <label>Формат номера</label>
              <input type="text" value={cartridgeForm.formatted_number} disabled />
            </div>

            <div className="form-group">
              <label>Статус *</label>
              <select
                value={cartridgeForm.status}
                onChange={(e) =>
                  setCartridgeForm((prev) => ({
                    ...prev,
                    status: e.target.value as CartridgeStatus,
                  }))
                }
                required
              >
                {Object.entries(statusLabel).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Комментарий (необязательно)</label>
            <textarea
              value={cartridgeForm.comment}
              onChange={(e) =>
                setCartridgeForm((prev) => ({ ...prev, comment: e.target.value }))
              }
              placeholder="Дополнительная информация"
              rows={3}
            />
          </div>

          {cartridgeError && <div className="error-banner">{cartridgeError}</div>}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={cartridgeSubmitting}>
              {cartridgeSubmitting ? 'Создание...' : 'Создать картридж'}
            </button>
            <button type="button" className="btn-secondary" onClick={fetchNextNumber}>
              Обновить автономер
            </button>
          </div>
        </form>
      </div>

      <div className="form-card">
        <h2>Удаление картриджей</h2>
        {cartridges.length === 0 ? (
          <p className="subtitle">Нет картриджей для удаления</p>
        ) : (
          <div className="cartridge-admin-list">
            {cartridges
              .slice()
              .sort((a, b) => b.id - a.id)
              .map((c) => (
                <div key={c.id} className="cartridge-admin-item">
                  <div>
                    <strong>{c.name}</strong>
                    <div className="subtitle">
                      {c.formatted_number ? `№ ${c.formatted_number} • ` : ''}
                      {statusLabel[c.status]} • {new Date(c.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-action delete"
                    onClick={() => handleDeleteCartridge(c)}
                  >
                    🗑️ Удалить
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="form-card">
          <h2>{editingUser ? `Редактирование: ${editingUser.username}` : 'Создать пользователя'}</h2>
          <form onSubmit={handleSubmit} className="user-form">
            <div className="form-row">
              <div className="form-group">
                <label>Логин *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="логин"
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div className="form-group">
                <label>{editingUser ? 'Новый пароль (можно оставить пустым)' : 'Пароль *'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingUser ? 'Оставьте пустым, чтобы не менять' : 'Минимум 4 символа'}
                  required={!editingUser}
                  minLength={editingUser ? 0 : 4}
                />
              </div>
              <div className="form-group">
                <label>Роль *</label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as any })
                  }
                  required
                >
                  <option value="viewer">Наблюдатель</option>
                  <option value="editor">Редактор</option>
                  <option value="admin">Администратор</option>
                </select>
              </div>
              <div className="form-group">
                <label>Telegram ID</label>
                <input
                  type="text"
                  value={form.tg_id}
                  onChange={(e) => setForm({ ...form, tg_id: e.target.value })}
                  placeholder="Необязательный Telegram ID"
                />
              </div>
            </div>
            {formError && <div className="error-banner">{formError}</div>}
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Сохранение...' : editingUser ? 'Обновить пользователя' : 'Создать пользователя'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      {(error || regionError) && <div className="error-banner">{error || regionError}</div>}

      {loading ? (
        <div className="loading">Загрузка пользователей...</div>
      ) : (
        <div className="table-card">
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Логин</th>
                <th>Роль</th>
                <th>Telegram ID</th>
                <th>Создан</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="td-id">{u.id}</td>
                  <td className="td-username">
                    <strong>{u.username}</strong>
                  </td>
                  <td>
                    <span className={`role-badge ${roleColors[u.role]}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="td-tgid">
                    {u.tg_id ? (
                      <span className="tg-id">📱 {u.tg_id}</span>
                    ) : (
                      <span className="no-tg">—</span>
                    )}
                  </td>
                  <td className="td-date">
                    {new Date(u.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="td-actions">
                    <button
                      className="btn-action edit"
                      onClick={() => openEdit(u)}
                    >
                      ✏️ Изменить
                    </button>
                    <button
                      className="btn-action delete"
                      onClick={() => handleDelete(u)}
                    >
                      🗑️ Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
