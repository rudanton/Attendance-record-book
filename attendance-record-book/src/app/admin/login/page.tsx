"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { signInWithEmailAndPassword } from 'firebase/auth';

import { auth } from '@/firebase/config';

// ===== Constants =====
const STORAGE_KEYS = {
  ADMIN_EMAIL: 'adminEmail',
};

const MESSAGES = {
  TITLE: '관리자 로그인',
  BACK: '← 기본 페이지로 돌아가기',
  EMAIL_LABEL: '이메일',
  PASSWORD_LABEL: '비밀번호',
  LOGIN: '로그인',
  LOGGING_IN: '로그인 중...',
  UNKNOWN_ERROR: '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.',
  INVALID_EMAIL: '유효하지 않은 이메일 주소입니다.',
  INVALID_CREDENTIAL: '잘못된 이메일 또는 비밀번호입니다.',
};

const AUTH_ERROR_CODES: Record<string, string> = {
  'auth/user-not-found': MESSAGES.INVALID_CREDENTIAL,
  'auth/wrong-password': MESSAGES.INVALID_CREDENTIAL,
  'auth/invalid-email': MESSAGES.INVALID_EMAIL,
};

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const savedEmail = localStorage.getItem(STORAGE_KEYS.ADMIN_EMAIL);
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem(STORAGE_KEYS.ADMIN_EMAIL, email);
      router.push('/admin');
    } catch (err) {
      console.error('Login error:', err);
      const message = err && typeof err === 'object' && 'code' in err
        ? AUTH_ERROR_CODES[(err as { code?: string }).code ?? ''] ?? MESSAGES.UNKNOWN_ERROR
        : MESSAGES.UNKNOWN_ERROR;
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-100 text-gray-800">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold mb-6 text-center">{MESSAGES.TITLE}</h1>
        <div className="mb-4 text-center">
          <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
            {MESSAGES.BACK}
          </Link>
        </div>
        <form onSubmit={handleLogin}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">{MESSAGES.EMAIL_LABEL}</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">{MESSAGES.PASSWORD_LABEL}</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-300"
            disabled={loading}
          >
            {loading ? MESSAGES.LOGGING_IN : MESSAGES.LOGIN}
          </button>
        </form>
      </div>
    </main>
  );
}
