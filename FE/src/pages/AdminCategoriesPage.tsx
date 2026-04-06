import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useAuth } from '../hooks/useAuth';
import { CategoryItem, adminCreateCategory, adminDeleteCategory, adminListCategories, adminUpdateCategory } from '../lib/api';

const typeOptions = [
  { label: 'Movies', value: 'Movie' as const },
  { label: 'Series', value: 'Series' as const },
  { label: 'Both', value: 'Both' as const },
];

const AdminCategoriesPage: React.FC = () => {
  const { user } = useAuth();
  const email = user?.email || '';

  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const [name, setName] = useState('');
  const [type, setType] = useState<'Movie' | 'Series' | 'Both'>('Both');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<'Movie' | 'Series' | 'Both'>('Both');

  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const list = await adminListCategories(email);
      setItems(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const onCreate = async () => {
    if (!canSubmit) return;
    try {
      await adminCreateCategory({ email, name: name.trim(), type });
      setName('');
      setType('Both');
      await load();
    } catch (e: any) {
      alert(e?.message || 'Create failed');
    }
  };

  const startEdit = (it: CategoryItem) => {
    setEditingId(it.CategoryID);
    setEditName(it.CategoryName);
    setEditType(it.Type);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const confirmEdit = async () => {
    if (!editingId) return;
    try {
      await adminUpdateCategory({ email, id: editingId, name: editName.trim() || undefined, type: editType });
      setEditingId(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Update failed');
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm('Delete this category? This will unlink from movies/series.')) return;
    try {
      await adminDeleteCategory(email, id);
      await load();
    } catch (e: any) {
      alert(e?.message || 'Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Categories</h1>

        <Card>
          <div className="p-4 space-y-3">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">Add New Category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
              >
                {typeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Button onClick={onCreate} disabled={!canSubmit}>Create</Button>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Existing</h2>
            {loading ? (
              <div className="text-gray-600 dark:text-gray-400">Loading...</div>
            ) : error ? (
              <div className="text-red-600">{error}</div>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.CategoryID} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-3">
                    {editingId === it.CategoryID ? (
                      <>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as any)}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
                          >
                            {typeOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <Button onClick={confirmEdit}>Save</Button>
                            <Button variant="ghost" onClick={cancelEdit}>Cancel</Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-gray-100">{it.CategoryName} <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800">{it.Type}</span></div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">/{it.Slug}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => startEdit(it)}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => onDelete(it.CategoryID)}>Delete</Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-gray-600 dark:text-gray-400">No categories yet.</div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminCategoriesPage;


