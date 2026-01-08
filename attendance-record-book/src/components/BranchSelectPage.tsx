"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Branch } from '@/lib/types';
import { getAllBranches } from '@/lib/branchService';

interface BranchSelectPageProps {
  onBranchSelected: (branchId: string) => void;
}

export default function BranchSelectPage({ onBranchSelected }: BranchSelectPageProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchBranches() {
      try {
        const fetchedBranches = await getAllBranches();
        setBranches(fetchedBranches);
        setLoading(false);
      } catch (error) {
        console.error("Failed to fetch branches:", error);
        alert("지점 목록을 불러오는 데 실패했습니다.");
        setLoading(false);
      }
    }
    fetchBranches();
  }, []);

  const handleSelectBranch = (branchId: string) => {
    setSelectedBranch(branchId);
  };

  const handleConfirmSelection = () => {
    if (selectedBranch) {
      onBranchSelected(selectedBranch);
      router.push('/'); // Redirect to home after selection
    } else {
      alert("지점을 선택해주세요.");
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
        <p>지점 목록을 불러오는 중...</p>
      </main>
    );
  }

  if (branches.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white text-center">
        <h1 className="text-4xl font-bold mb-4">등록된 지점이 없습니다.</h1>
        <p className="text-xl mb-8">관리자 페이지에서 먼저 지점을 추가해주세요.</p>
        <Link href="/admin/manage-branches">
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-colors duration-300">
            지점 추가하러 가기 (관리자)
          </button>
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-8">지점을 선택해주세요</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl">
        {branches.map((branch) => (
          <div
            key={branch.branchId}
            onClick={() => handleSelectBranch(branch.branchId)}
            className={`cursor-pointer p-6 rounded-lg shadow-lg transition-all duration-200
              ${selectedBranch === branch.branchId ? 'bg-blue-700 ring-4 ring-blue-500' : 'bg-gray-800 hover:bg-gray-700'}`}
          >
            <h2 className="text-2xl font-semibold text-center">{branch.branchName}</h2>
          </div>
        ))}
      </div>
      <button
        onClick={handleConfirmSelection}
        disabled={!selectedBranch}
        className="mt-12 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-2xl transition-colors duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
      >
        선택한 지점으로 시작
      </button>
    </main>
  );
}
