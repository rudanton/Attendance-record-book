"use client";

import AdminRouteGuard from '@/components/admin/AdminRouteGuard';
import Link from 'next/link';

function AdminDashboardContent() {
  const cardClasses = "block p-6 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-transform transform hover:-translate-y-1";
  const titleClasses = "text-xl font-semibold text-gray-800";
  const descriptionClasses = "mt-2 text-sm text-gray-600";

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-100">
      <div className="w-full max-w-5xl mb-8">
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          ← 기본 페이지로 돌아가기
        </Link>
      </div>
      <h1 className="text-4xl font-bold mb-12 text-gray-800">관리자 대시보드</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full max-w-5xl">
        
        <Link href="/admin/manage-branches" className={cardClasses}>
          <h2 className={titleClasses}>지점 관리</h2>
          <p className={descriptionClasses}>지점을 추가, 수정, 삭제합니다.</p>
        </Link>

        <Link href="/admin/manage-employees" className={cardClasses}>
          <h2 className={titleClasses}>직원 목록 관리</h2>
          <p className={descriptionClasses}>전체 직원의 정보를 조회하고 상태(재직/퇴사) 및 시급을 수정합니다.</p>
        </Link>
        
        <Link href="/admin/attendance-logs" className={cardClasses}>
          <h2 className={titleClasses}>전체 출퇴근 기록</h2>
          <p className={descriptionClasses}>모든 직원의 출퇴근 기록을 조회하고 관리합니다.</p>
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
