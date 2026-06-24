import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { User } from '@/types';
import { ProfileForm } from '@/components/profile/ProfileForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  let user: User | null = null;
  try {
    user = await queryOne<User>(
      `SELECT id, email, name, role, display_name, bio, avatar_url, created_at
       FROM users WHERE id = $1`,
      [session.userId]
    );
  } catch {
    // DB not available
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <p className="text-gray-500">Could not load your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-1 capitalize">{user.role} account</p>
      </div>
      <ProfileForm user={user} />
    </div>
  );
}
