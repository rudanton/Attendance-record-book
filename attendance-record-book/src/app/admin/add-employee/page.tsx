"use client";

import { useState, useCallback, useEffect } from 'react';
import { addEmployee } from '@/lib/employeeService';
import { getAllBranches } from '@/lib/branchService'; // Import branch service
import { Branch } from '@/lib/types';
import AdminRouteGuard from '@/components/admin/AdminRouteGuard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function AddEmployeePageContent() {
  const [formState, setFormState] = useState({ name: '', pin: '', hourlyRate: '' });
  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      const fetchedBranches = await getAllBranches();
      setBranches(fetchedBranches);

      const storedBranchId = localStorage.getItem('selectedBranchId');
      if (storedBranchId && fetchedBranches.some(b => b.branchId === storedBranchId)) {
        setSelectedBranchId(storedBranchId);
        setSelectedBranchName(fetchedBranches.find(b => b.branchId === storedBranchId)?.branchName || null);
      } else if (fetchedBranches.length > 0) {
        // If stored ID is invalid or not found, select the first branch
        setSelectedBranchId(fetchedBranches[0].branchId);
        setSelectedBranchName(fetchedBranches[0].branchName);
        localStorage.setItem('selectedBranchId', fetchedBranches[0].branchId);
      }
      setInitialLoadComplete(true);
    }
    loadInitialData();
  }, []);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBranchId = e.target.value;
    setSelectedBranchId(newBranchId);
    setSelectedBranchName(branches.find(b => b.branchId === newBranchId)?.branchName || null);
    localStorage.setItem('selectedBranchId', newBranchId);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId) {
      alert("지점을 선택해주세요.");
      return;
    }
    const { name, pin, hourlyRate } = formState;
    if (!name || !pin || !hourlyRate) {
      alert("모든 항목을 입력해주세요.");
      return;
    }

    try {
      await addEmployee(selectedBranchId, { 
        name, 
        pin, 
        hourlyRate: parseFloat(hourlyRate),
        role: 'staff' // Defaulting role to 'staff'
      });
      alert('성공적으로 직원을 추가했습니다.');
      setFormState({ name: '', pin: '', hourlyRate: '' });
      // Removed redirection to employee list after adding, as per user request.
    } catch (error) {
      console.error("Failed to add employee:", error);
      alert(error instanceof Error ? error.message : "직원을 추가할 수 없습니다.");
    }
  };

  if (!initialLoadComplete) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100 text-gray-800">
        <p>초기 데이터를 불러오는 중...</p>
      </main>
    );
  }

  if (branches.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100 text-gray-800 text-center">
        <h1 className="text-4xl font-bold mb-4">등록된 지점이 없습니다.</h1>
        <p className="text-xl mb-8">지점 관리에 접속하여 먼저 지점을 추가해주세요.</p>
        <Link href="/admin/manage-branches">
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-colors duration-300">
            지점 관리로 이동
          </button>
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-100">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-8">
            <Link href="/admin" className="text-blue-600 hover:text-blue-800">
                ← 관리자 메뉴로 돌아가기
            </Link>
            <div className="flex items-center space-x-2">
                <label htmlFor="branch-select" className="text-sm font-medium text-gray-700">현재 지점:</label>
                <select 
                    id="branch-select" 
                    value={selectedBranchId || ''} 
                    onChange={handleBranchChange} 
                    className="p-2 border rounded-md"
                >
                    {branches.map(branch => (
                        <option key={branch.branchId} value={branch.branchId}>{branch.branchName}</option>
                    ))}
                </select>
            </div>
        </div>
        <h1 className="text-4xl font-bold mb-8 text-gray-800">
            {selectedBranchName ? `${selectedBranchName} - ` : ''}신규 직원 추가
        </h1>
        
        {selectedBranchId ? (
          <div className="w-full max-w-4xl p-6 bg-white rounded-lg shadow-md">
            <form onSubmit={handleAddEmployee} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="flex flex-col">
                <label htmlFor="name" className="text-sm font-medium text-gray-600 mb-1">이름</label>
                <input type="text" name="name" id="name" value={formState.name} onChange={handleInputChange} className="p-2 border rounded-md" />
              </div>
              <div className="flex flex-col">
                <label htmlFor="pin" className="text-sm font-medium text-gray-600 mb-1">PIN (4자리)</label>
                <input type="text" name="pin" id="pin" value={formState.pin} onChange={handleInputChange} maxLength={4} className="p-2 border rounded-md" />
              </div>
              <div className="flex flex-col">
                <label htmlFor="hourlyRate" className="text-sm font-medium text-gray-600 mb-1">시급</label>
                <input type="number" name="hourlyRate" id="hourlyRate" value={formState.hourlyRate} onChange={handleInputChange} className="p-2 border rounded-md" />
              </div>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md h-10">직원 추가</button>
            </form>
          </div>
        ) : (
          <div className="w-full max-w-4xl p-6 bg-white rounded-lg shadow-md text-center">
            <p className="text-lg text-red-500">직원을 추가하려면 먼저 지점을 선택하거나 추가해야 합니다.</p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function AddEmployeePage() {
  return (
    <AdminRouteGuard>
      <AddEmployeePageContent />
    </AdminRouteGuard>
  );
}
