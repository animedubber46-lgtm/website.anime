'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    api.get('/notifications?limit=50').then(res => {
      setNotifications(res.data.data);
    }).finally(() => setLoading(false));
  }, [user]);

  const markRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const del = async (id: string) => {
    await api.delete(`/notifications/${id}`);
    setNotifications(prev => prev.filter(n => n._id !== id));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-animex-bg pt-24 pb-16 px-6 lg:px-16">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-animex-red" />
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            {unreadCount > 0 && <span className="bg-animex-red text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-1.5 text-sm text-animex-red hover:underline">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}</div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n: any) => (
              <div key={n._id} className={`flex gap-4 p-4 rounded-xl border transition-colors ${n.isRead ? 'bg-animex-surface border-animex-border' : 'bg-animex-red/5 border-animex-red/20'}`}>
                {n.image && <img src={n.image} alt="" className="w-12 h-16 object-cover rounded flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{n.title}</p>
                  <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-white/30 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                  {n.link && (
                    <Link href={n.link} className="text-xs text-animex-red hover:underline mt-1 inline-block">Watch now →</Link>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  {!n.isRead && (
                    <button onClick={() => markRead(n._id)} className="p-1.5 text-white/30 hover:text-animex-red transition-colors rounded">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => del(n._id)} className="p-1.5 text-white/30 hover:text-animex-red transition-colors rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
