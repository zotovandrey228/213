import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCartridge,
  createWork,
  createNote,
  deleteWork,
  deleteNote,
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
  performed_at: string;
  performed_by?: User;
  created_at: string;
}

interface Note {
  id: number;
  content: string;
  created_by?: User;
  created_at: string;
}

interface Cartridge {
  id: number;
  name: string;
  model: string;
  serial_number?: string;
  created_at: string;
  updated_at: string;
  works: Work[];
  notes: Note[];
}

export default function CartridgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [cartridge, setCartridge] = useState<Cartridge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'works' | 'notes'>('works');

  const [workForm, setWorkForm] = useState({
    description: '',
    performed_at: new Date().toISOString().slice(0, 10),
  });
  const [workError, setWorkError] = useState('');
  const [workSubmitting, setWorkSubmitting] = useState(false);

  const [noteForm, setNoteForm] = useState({ content: '' });
  const [noteError, setNoteError] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const canEdit = user?.role === 'admin' || user?.role === 'editor';

  const fetchCartridge = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await getCartridge(parseInt(id));
      setCartridge(res.data);
    } catch {
      setError('Cartridge not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCartridge();
  }, [id]);

  const handleAddWork = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorkError('');
    setWorkSubmitting(true);
    try {
      await createWork({
        cartridge_id: parseInt(id!),
        description: workForm.description,
        performed_at: new Date(workForm.performed_at).toISOString(),
      });
      setWorkForm({
        description: '',
        performed_at: new Date().toISOString().slice(0, 10),
      });
      fetchCartridge();
    } catch (err: any) {
      setWorkError(err.response?.data?.message || 'Failed to add work');
    } finally {
      setWorkSubmitting(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setNoteError('');
    setNoteSubmitting(true);
    try {
      await createNote({
        cartridge_id: parseInt(id!),
        content: noteForm.content,
      });
      setNoteForm({ content: '' });
      fetchCartridge();
    } catch (err: any) {
      setNoteError(err.response?.data?.message || 'Failed to add note');
    } finally {
      setNoteSubmitting(false);
    }
  };

  const handleDeleteWork = async (workId: number) => {
    if (!confirm('Delete this work entry?')) return;
    try {
      await deleteWork(workId);
      fetchCartridge();
    } catch {
      alert('Failed to delete work');
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteNote(noteId);
      fetchCartridge();
    } catch {
      alert('Failed to delete note');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error || !cartridge) return <div className="error-banner">{error || 'Not found'}</div>;

  return (
    <div className="detail-page">
      <div className="detail-header">
        <button className="btn-back" onClick={() => navigate('/cartridges')}>
          ← Back
        </button>
        <div className="detail-info">
          <h1>
            <span className="detail-icon">🖨️</span> {cartridge.name}
          </h1>
          <div className="detail-meta">
            <span className="meta-badge model">{cartridge.model}</span>
            {cartridge.serial_number && (
              <span className="meta-badge serial">S/N: {cartridge.serial_number}</span>
            )}
            <span className="meta-badge date">
              Added: {new Date(cartridge.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'works' ? 'active' : ''}`}
          onClick={() => setActiveTab('works')}
        >
          🔧 Works ({cartridge.works.length})
        </button>
        <button
          className={`tab ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          📝 Notes ({cartridge.notes.length})
        </button>
      </div>

      {activeTab === 'works' && (
        <div className="tab-content">
          {canEdit && (
            <div className="form-card">
              <h3>Add Work Entry</h3>
              <form onSubmit={handleAddWork} className="entry-form">
                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    value={workForm.description}
                    onChange={(e) =>
                      setWorkForm({ ...workForm, description: e.target.value })
                    }
                    placeholder="What maintenance was performed?"
                    rows={3}
                    required
                  />
                </div>
                <div className="form-group" style={{ maxWidth: '220px' }}>
                  <label>Date *</label>
                  <input
                    type="date"
                    value={workForm.performed_at}
                    onChange={(e) =>
                      setWorkForm({ ...workForm, performed_at: e.target.value })
                    }
                    required
                  />
                </div>
                {workError && <div className="error-banner">{workError}</div>}
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={workSubmitting}
                >
                  {workSubmitting ? 'Adding...' : 'Add Work'}
                </button>
              </form>
            </div>
          )}

          {cartridge.works.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🔧</span>
              <p>No work records yet</p>
            </div>
          ) : (
            <div className="entries-list">
              {cartridge.works
                .sort(
                  (a, b) =>
                    new Date(b.performed_at).getTime() -
                    new Date(a.performed_at).getTime(),
                )
                .map((w) => (
                  <div key={w.id} className="entry-card">
                    <div className="entry-header">
                      <span className="entry-date">
                        📅 {new Date(w.performed_at).toLocaleDateString()}
                      </span>
                      {w.performed_by && (
                        <span className="entry-author">
                          👤 {w.performed_by.username}
                        </span>
                      )}
                      {canEdit && (
                        <button
                          className="btn-delete-entry"
                          onClick={() => handleDeleteWork(w.id)}
                          title="Delete work"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <p className="entry-content">{w.description}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="tab-content">
          {canEdit && (
            <div className="form-card">
              <h3>Add Note</h3>
              <form onSubmit={handleAddNote} className="entry-form">
                <div className="form-group">
                  <label>Note *</label>
                  <textarea
                    value={noteForm.content}
                    onChange={(e) =>
                      setNoteForm({ content: e.target.value })
                    }
                    placeholder="Enter note text..."
                    rows={3}
                    required
                  />
                </div>
                {noteError && <div className="error-banner">{noteError}</div>}
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={noteSubmitting}
                >
                  {noteSubmitting ? 'Adding...' : 'Add Note'}
                </button>
              </form>
            </div>
          )}

          {cartridge.notes.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📝</span>
              <p>No notes yet</p>
            </div>
          ) : (
            <div className="entries-list">
              {cartridge.notes
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
                )
                .map((n) => (
                  <div key={n.id} className="entry-card note-card">
                    <div className="entry-header">
                      <span className="entry-date">
                        📅 {new Date(n.created_at).toLocaleDateString()}
                      </span>
                      {n.created_by && (
                        <span className="entry-author">
                          👤 {n.created_by.username}
                        </span>
                      )}
                      {canEdit && (
                        <button
                          className="btn-delete-entry"
                          onClick={() => handleDeleteNote(n.id)}
                          title="Delete note"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <p className="entry-content">{n.content}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
