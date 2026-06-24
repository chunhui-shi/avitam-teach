import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { User } from '@/types';
import { ProfileForm } from '@/components/profile/ProfileForm';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/auth/login');

  const user = await queryOne<User>(`
    SELECT id, email, name, role, bio, avatar_url, stripe_customer_id, created_at
    FROM users
    WHERE id = $1
  `, [session.userId]);

  if (!user) redirect('/auth/login');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-600 mt-1">{user.email}</p>
      </div>
      <ProfileForm user={user} />
    </div>
  );
}
