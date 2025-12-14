'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Inloggningen misslyckades');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-sunken)] p-4">
      <div className="bg-[var(--color-surface-raised)] rounded-xl shadow-lg p-8 w-full max-w-sm fade-in border border-[var(--color-border-subtle)]">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-semibold text-[var(--color-text)]">
            Järva Gymnasium
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-1">
            Resultatanalys
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[var(--color-text)] mb-2">
              E-post
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="namn@jarvagymnasium.se"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[var(--color-text)] mb-2">
              Lösenord
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-[var(--color-danger-soft)] text-[var(--color-danger)] px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary w-full py-3"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner"></span>
                Loggar in...
              </span>
            ) : (
              'Logga in'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-[var(--color-text-muted)]">
          <p>© {new Date().getFullYear()} Järva Gymnasium</p>
        </div>
      </div>
    </div>
  );
}
