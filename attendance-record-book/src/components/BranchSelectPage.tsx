"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Branch } from '@/lib/types';
import { getAllBranches, addBranch } from '@/lib/branchService';

interface BranchSelectPageProps {
  onBranchSelected: (branchId: string) => void;
}

export default function BranchSelectPage({ onBranchSelected }: BranchSelectPageProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [adding, setAdding] = useState(false);
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

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) {
      alert("지점 이름을 입력해주세요.");
      return;
    }
    setAdding(true);
    try {
      const newBranch = await addBranch(newBranchName);
      setBranches([...branches, newBranch]);
      setNewBranchName('');
      setShowAddForm(false);
      // 새로 추가한 지점을 자동으로 선택
      setSelectedBranch(newBranch.branchId);
      alert(`"${newBranch.branchName}" 지점이 추가되었습니다.`);
    } catch (error) {
      console.error("Failed to add branch:", error);
      alert(error instanceof Error ? error.message : "지점을 추가할 수 없습니다.");
    } finally {
      setAdding(false);
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
      <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-900 text-white text-center">
        <h1 className="text-4xl font-bold mb-8">등록된 지점이 없습니다.</h1>
        <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-lg">
          <h2 className="text-2xl font-semibold mb-6">새 지점 추가</h2>
          <form onSubmit={handleAddBranch} className="space-y-4">
            <input
              type="text"
              placeholder="지점 이름 (예: 강남점, 홍대점)"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
              disabled={adding}
              autoFocus
            />
            <button
              type="submit"
              disabled={adding}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-colors duration-300 disabled:bg-gray-500"
            >
              {adding ? '추가 중...' : '지점 추가'}
            </button>
          </form>
          <div className="mt-8 pt-6 border-t border-gray-700">
            <Link href="/admin/login" className="text-blue-400 hover:text-blue-300 text-sm">
              관리자로 로그인하기 →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-8">지점을 선택해주세요</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-4xl mb-6">
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
        
        {/* 지점 추가 카드 */}
        {!showAddForm && (
          <div
            onClick={() => setShowAddForm(true)}
            className="cursor-pointer p-6 rounded-lg shadow-lg bg-gray-800 hover:bg-gray-700 border-2 border-dashed border-gray-600 flex items-center justify-center transition-all duration-200"
          >
            <div className="text-center">
              <div className="text-5xl mb-2">+</div>
              <h2 className="text-xl font-semibold">새 지점 추가</h2>
            </div>
          </div>
        )}
      </div>

      {/* 지점 추가 폼 */}
      {showAddForm && (
        <div className="w-full max-w-md bg-gray-800 p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-2xl font-semibold mb-4">새 지점 추가</h2>
          <form onSubmit={handleAddBranch} className="space-y-4">
            <input
              type="text"
              placeholder="지점 이름 (예: 강남점, 홍대점)"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="w-full p-3 rounded-md bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
              disabled={adding}
              autoFocus
            />
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={adding}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-300 disabled:bg-gray-500"
              >
                {adding ? '추가 중...' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewBranchName('');
                }}
                disabled={adding}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-300"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        onClick={handleConfirmSelection}
        disabled={!selectedBranch}
        className="mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-2xl transition-colors duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
      >
        선택한 지점으로 시작
      </button>
    </main>
  );
}
