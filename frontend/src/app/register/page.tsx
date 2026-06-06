'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, User, Mail, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

type FormData = { username: string; email: string; password: string; confirm: string };

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPass, setShowPass] = useState(false);
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setServerError('');
    try {
      const res = await api.post('/auth/register', { username: data.username, email: data.email, password: data.password });
      const { user, accessToken, refreshToken } = res.data.data;
      setAuth(user, accessToken, refreshToken);
      router.push('/');
    } catch (err: any) {
      setServerError(err.response?.data?.message || 'Registration failed.');
    }
  };

  return (
    <div className="min-h-screen bg-animex-bg flex items-center justify-center px-4 pt-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <span className="font-display text-4xl font-bold text-animex-red tracking-wider">ANIME<span className="text-white">X</span></span>
          </Link>
          <p className="text-white/40 mt-2 text-sm">Create your free account</p>
        </div>

        <div className="bg-animex-surface border border-animex-border rounded-2xl p-8 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-6">Join AnimeX</h1>

          {serverError && (
            <div className="mb-4 px-4 py-3 bg-animex-red/10 border border-animex-red/30 rounded-lg text-animex-red text-sm">
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {[
              { name: 'username', label: 'Username', type: 'text', Icon: User, rules: { required: 'Required', minLength: { value: 3, message: 'Min 3 characters' }, pattern: { value: /^[a-zA-Z0-9_]+$/, message: 'Letters, numbers, underscores only' } } },
              { name: 'email', label: 'Email', type: 'email', Icon: Mail, rules: { required: 'Required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' } } },
            ].map(({ name, label, type, Icon, rules }) => (
              <div key={name}>
                <label className="text-sm text-white/60 block mb-1.5">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input type={type} {...register(name as any, rules)}
                    className="w-full bg-animex-card border border-animex-border rounded-lg pl-10 pr-4 py-2.5 text-white text-sm outline-none focus:border-animex-red/50 transition-colors placeholder:text-white/20"
                    placeholder={label} />
                </div>
                {(errors as any)[name] && <p className="text-animex-red text-xs mt-1">{(errors as any)[name].message}</p>}
              </div>
            ))}

            <div>
              <label className="text-sm text-white/60 block mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input type={showPass ? 'text' : 'password'} {...register('password', {
                  required: 'Required', minLength: { value: 8, message: 'Min 8 characters' },
                  pattern: { value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, message: 'Need uppercase, lowercase, and number' }
                })}
                  className="w-full bg-animex-card border border-animex-border rounded-lg pl-10 pr-10 py-2.5 text-white text-sm outline-none focus:border-animex-red/50 transition-colors placeholder:text-white/20"
                  placeholder="••••••••" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-animex-red text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting}
              className="w-full bg-animex-red hover:bg-animex-red-dark disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold transition-colors mt-2">
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-white/40 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-animex-red hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
