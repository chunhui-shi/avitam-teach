'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { User } from '@/types';

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, bio }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || 'Profile update failed');
      return;
    }

    setMessage('Profile updated');
    router.refresh();
  };

  const uploadAvatar = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append('avatar', file);
    const res = await fetch('/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(data.error || 'Avatar upload failed');
      return;
    }

    setAvatarUrl(data.avatarUrl);
    setMessage('Avatar updated');
    router.refresh();
  };

  return (
    <div className="grid gap-6 md:grid-cols-[240px_1fr]">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-32 w-32 rounded-full object-cover border border-gray-200" />
          ) : (
            <div className="h-32 w-32 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-4xl font-semibold">
              {name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <label className="w-full">
            <span className="sr-only">Upload avatar</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              onChange={(event) => uploadAvatar(event.target.files?.[0] || null)}
              disabled={uploading}
            />
          </label>
          {uploading && <p className="text-sm text-gray-500">Uploading...</p>}
        </div>
      </div>

      <form onSubmit={saveProfile} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Short bio</label>
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={5}
            maxLength={500}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>Save Profile</Button>
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </form>
    </div>
  );
}
