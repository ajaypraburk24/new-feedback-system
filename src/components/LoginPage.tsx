import React, { useState } from 'react';
import type { AuthUser } from '../types';
import { apiFetch, setAuthToken } from '../utils/api';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter Email and Password.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ user: AuthUser; token?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          role: 'student',
          identifier: identifier.trim(),
          password,
          rememberMe: true,
        }),
      });
      if (res.token) setAuthToken(res.token, true);
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black px-4 py-14">
      <div className="mx-auto max-w-[400px]">
        <div className="text-center mb-4">
          <h1 className="text-lg font-bold uppercase">SRM TRP Engineering College</h1>
          <p className="text-sm underline mt-0.5">Student Feedback System</p>
        </div>

        <fieldset className="border border-gray-600 p-4 bg-white">
          <legend className="px-1.5 font-bold text-sm">Student Login</legend>

          {error && (
            <div className="mb-3 border border-red-600 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <div>
              <label htmlFor="login-email" className="block font-bold text-xs mb-1">
                College Email:
              </label>
              <input
                id="login-email"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="814725148004@trp.srmtrichy.edu.in"
                className="w-full border border-gray-500 bg-white px-2.5 py-1.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block font-bold text-xs mb-1">
                Password:
              </label>
              <div className="flex gap-2">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="flex-1 border border-gray-500 bg-white px-2.5 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="border border-gray-500 bg-gray-100 px-2.5 py-1 text-xs hover:bg-gray-200 cursor-pointer"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="pt-1 flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="border border-gray-800 bg-gray-200 px-4 py-1 text-sm font-bold hover:bg-gray-300 cursor-pointer"
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIdentifier('');
                  setPassword('');
                  setError('');
                }}
                className="border border-gray-500 bg-white px-3 py-1 text-sm hover:bg-gray-100 cursor-pointer"
              >
                Clear
              </button>
            </div>
          </form>
        </fieldset>

        <div className="mt-4 border border-gray-300 bg-gray-50 p-2.5 text-xs flex items-center justify-between gap-2">
          <div>
            <div>
              <strong>Email:</strong>{' '}
              <span className="font-mono">814725148004@trp.srmtrichy.edu.in</span>
            </div>
            <div>
              <strong>Password:</strong> <span className="font-mono">trpstudents@123</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIdentifier('814725148004@trp.srmtrichy.edu.in');
              setPassword('trpstudents@123');
              setError('');
            }}
            className="border border-gray-600 bg-white px-2.5 py-1 text-xs hover:bg-gray-200 cursor-pointer shrink-0"
          >
            Fill
          </button>
        </div>
      </div>
    </div>
  );
}
