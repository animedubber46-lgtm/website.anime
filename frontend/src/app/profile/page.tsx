'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Save, Crown, Shield } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function ProfilePage() {
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<{ username: string }>();

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    api.get('/users/me').then(res => {
      setUserData(res.data.data);
      reset({ username: res.data.data.username });
    }).finally(() => setLoading(false));
  }, [user]);

  const onSubmit = async (data: { username: string }) => {
    try {
      const res = await api.patch('/users/me', data);
      setUserData(res.data.data);
      if (user && accessToken && refreshToken) setAuth({ ...user, username: res.data.data.username }, accessToken, refreshToken);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-animex-bg pt-24 pb-16 px-6 lg:px-16">
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-8">Profile Settings</h1>

        {/* Avatar & role */}
        <div className="bg-animex-surface border border-animex-border rounded-2xl p-6 mb-6 flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-animex-red/10 border-2 border-animex-red/30 flex items-center justify-center flex-shrink-0">
            {userData?.avatar ? (
              <img src={userData.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-animex-red" />
            )}
          </div>
          <div>
            <p className="text-lg font-bold text-white">{userData?.username}</p>
            <p className="text-sm text-white/40">{userData?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              {userData?.role === 'admin' && (
                <span className="flex items-center gap-1 text-xs bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">
                  <Shield className="w-3 h-3" /> Admin
                </span>
              )}
              {(userData?.role === 'premium' || userData?.role === 'admin') && (
                <span className="flex items-center gap-1 text-xs bg-animex-gold/20 text-animex-gold border border-animex-gold/30 px-2 py-0.5 rounded-full">
                  <Crown className="w-3 h-3" /> Premium
                </span>
              )}
              {userData?.role === 'free' && (
                <span className="text-xs bg-white/5 text-white/40 border border-white/10 px-2 py-0.5 rounded-full">Free Plan</span>
              )}
            </div>
          </div>
        </div>

        {/* Edit form */}
        <div className="bg-animex-surface border border-animex-border rounded-2xl p-6">
          <h2 className="font-semibold text-white mb-4">Edit Profile</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm text-white/60 block mb-1.5">Username</label>
              <input {...register('username', { required: true, minLength: 3 })}
                className="w-full bg-animex-card border border-animex-border rounded-lg px-4 py-2.5 text-white text-sm outline-none focus:border-animex-red/50 transition-colors" />
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-1.5">Email</label>
              <input value={userData?.email || ''} disabled
                className="w-full bg-animex-card border border-animex-border rounded-lg px-4 py-2.5 text-white/40 text-sm cursor-not-allowed" />
              <p className="text-xs text-white/30 mt-1">Email cannot be changed</p>
            </div>
            <button type="submit" disabled={isSubmitting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${saved ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-animex-red hover:bg-animex-red-dark text-white'}`}>
              <Save className="w-4 h-4" /> {saved ? 'Saved!' : isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {userData?.role === 'free' && (
          <div className="mt-6 bg-gradient-to-r from-animex-red/10 to-animex-gold/10 border border-animex-red/20 rounded-2xl p-6 text-center">
            <Crown className="w-8 h-8 text-animex-gold mx-auto mb-2" />
            <h3 className="text-lg font-bold text-white mb-1">Upgrade to Premium</h3>
            <p className="text-white/50 text-sm mb-4">Unlock all anime, 1080p quality, and offline downloads.</p>
            <a href="/premium" className="inline-block bg-animex-gold text-black font-bold px-6 py-2.5 rounded-full text-sm hover:bg-yellow-400 transition-colors">
              View Plans
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
