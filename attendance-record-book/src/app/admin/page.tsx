"use client";

import Link from 'next/link';

import AdminRouteGuard from '@/components/admin/AdminRouteGuard';

// ===== Constants =====
const TEXT = {
  BACK: '← 기본 페이지로 돌아가기',
  TITLE: '관리자 대시보드',
  BRANCH: { title: '지점 관리', desc: '지점을 추가, 수정, 삭제합니다.' },
  EMPLOYEE: { title: '직원 목록 관리', desc: '전체 직원의 정보를 조회하고 상태(재직/퇴사) 및 시급을 수정합니다.' },
  ATTENDANCE: { title: '전체 출퇴근 기록', desc: '모든 직원의 출퇴근 기록을 조회하고 관리합니다.' },
};

const CARD_CLASS = 'block p-6 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-transform transform hover:-translate-y-1';
const TITLE_CLASS = 'text-xl font-semibold text-gray-800';
const DESC_CLASS = 'mt-2 text-sm text-gray-600';

function AdminDashboardContent() {
  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-100">
      <div className="w-full max-w-5xl mb-8">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          {TEXT.BACK}
        </Link>
      </div>
      <h1 className="text-4xl font-bold mb-12 text-gray-800">{TEXT.TITLE}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl">
        <Link href="/admin/manage-branches" className={CARD_CLASS}>
          <h2 className={TITLE_CLASS}>{TEXT.BRANCH.title}</h2>
          <p className={DESC_CLASS}>{TEXT.BRANCH.desc}</p>
        </Link>

        <Link href="/admin/manage-employees" className={CARD_CLASS}>
          <h2 className={TITLE_CLASS}>{TEXT.EMPLOYEE.title}</h2>
          <p className={DESC_CLASS}>{TEXT.EMPLOYEE.desc}</p>
        </Link>
        
        <Link href="/admin/attendance-logs" className={CARD_CLASS}>
          <h2 className={TITLE_CLASS}>{TEXT.ATTENDANCE.title}</h2>
          <p className={DESC_CLASS}>{TEXT.ATTENDANCE.desc}</p>
        </Link>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <AdminRouteGuard>
      <AdminDashboardContent />
    </AdminRouteGuard>
  );
}
