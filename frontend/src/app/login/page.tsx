'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const { setAuth } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string; password: string }>();

  const onSubmit = async (data: { email: string; password: string }) => {
    setServerError('');
    try {
      const res = await api.post('/auth/login', data);
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      router.push(redirect);
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-animex-bg flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="font-display text-4xl font-bold text-animex-red tracking-wider">ANIME<span className="text-white">X</span></span>
          </Link>
          <p className="text-white/40 mt-2 text-sm">Sign in to continue watching</p>
        </div>

        <div className="bg-animex-surface border border-animex-border rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-6">Welcome back</h1>

          {serverError && (
            <div className="mb-4 px-4 py-3 bg-animex-red/10 border border-animex-red/30 rounded-lg text-animex-red text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-sm text-white/60 block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input type="email" autoComplete="email"
                  {...register('email', { required: 'Email is required' })}
                  className="w-full bg-animex-card border border-animex-border rounded-lg pl-10 pr-4 py-2.5 text-white text-sm outline-none focus:border-animex-red/50 transition-colors placeholder:text-white/20"
                  placeholder="you@example.com" />
              </div>
              {errors.email && <p className="text-animex-red text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="text-sm text-white/60 block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input type={showPass ? 'text' : 'password'} autoComplete="current-password"
                  {...register('password', { required: 'Password is required' })}
                  className="w-full bg-animex-card border border-animex-border rounded-lg pl-10 pr-10 py-2.5 text-white text-sm outline-none focus:border-animex-red/50 transition-colors placeholder:text-white/20"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-animex-red text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-xs text-animex-red hover:underline">Forgot password?</Link>
            </div>

            <button type="submit" disabled={isSubmitting}
              className="w-full bg-animex-red hover:bg-animex-red-dark disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold transition-colors">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-white/40 mt-6">
            New to AnimeX?{' '}
            <Link href="/register" className="text-animex-red hover:underline font-medium">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
