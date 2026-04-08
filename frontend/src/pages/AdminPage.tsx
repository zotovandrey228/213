import { useState, useEffect } from 'react';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
} from '../api';
import './AdminPage.css';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'editor' | 'viewer';
  tg_id?: string;
  created_at: string;
}

const EMPTY_FORM = {
  username: '',
  password: '',
  role: 'viewer' as 'admin' | 'editor' | 'viewer',
  tg_id: '',
};

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await getUsers();
      setUsers(res.data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
      setFormError(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user "${user.username}"?`)) return;
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch {
      alert('Failed to delete user');
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
          <h1>Admin Panel</h1>
          <p className="subtitle">Manage users and their access levels</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          + Add User
        </button>
      </div>

      {showForm && (
        <div className="form-card">
          <h2>{editingUser ? `Edit User: ${editingUser.username}` : 'Create New User'}</h2>
          <form onSubmit={handleSubmit} className="user-form">
            <div className="form-row">
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="username"
                  required
                  disabled={!!editingUser}
                />
              </div>
              <div className="form-group">
                <label>{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Min 4 characters'}
                  required={!editingUser}
                  minLength={editingUser ? 0 : 4}
                />
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as any })
                  }
                  required
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Telegram ID</label>
                <input
                  type="text"
                  value={form.tg_id}
                  onChange={(e) => setForm({ ...form, tg_id: e.target.value })}
                  placeholder="Optional Telegram user ID"
                />
              </div>
            </div>
            {formError && <div className="error-banner">{formError}</div>}
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loading">Loading users...</div>
      ) : (
        <div className="table-card">
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Role</th>
                <th>Telegram ID</th>
                <th>Created</th>
                <th>Actions</th>
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
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="td-actions">
                    <button
                      className="btn-action edit"
                      onClick={() => openEdit(u)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn-action delete"
                      onClick={() => handleDelete(u)}
                    >
                      🗑️ Delete
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
