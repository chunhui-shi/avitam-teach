'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '@/types';

const ROLES: UserRole[] = ['student', 'instructor', 'admin'];

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const url = search ? `/api/admin/users?q=${encodeURIComponent(search)}` : '/api/admin/users';
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) setUsers(data.users || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(''); }, [load]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const changeRole = async (userId: number, role: UserRole) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      const data = await res.json();
      setUsers(prev => prev.map(u => (u.id === userId ? { ...u, role: data.user.role } : u)));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Users</h2>
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search name or email…"
          className="w-64 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading users…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500">No users found.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Email</th>
              <th className="py-2 font-medium">Joined</th>
              <th className="py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-50">
                <td className="py-2 text-gray-800">{u.display_name || u.name}</td>
                <td className="py-2 text-gray-500">{u.email}</td>
                <td className="py-2 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="py-2">
                  <select
                    value={u.role}
                    onChange={e => changeRole(u.id, e.target.value as UserRole)}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {ROLES.map(r => (
                      <option key={r} value={r} className="capitalize">{r}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
