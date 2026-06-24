import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { AdminUsers } from '@/components/admin/AdminUsers';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');
  if (user.role !== 'admin') redirect('/dashboard');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
          <p className="text-gray-600 mt-1">Manage users and courses.</p>
        </div>
        <Link href="/instructor" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          Course management →
        </Link>
      </div>
      <AdminUsers />
    </div>
  );
}
