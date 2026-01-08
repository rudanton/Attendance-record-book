"use client";

import { useEffect, useState, useCallback } from 'react';
import { User, Branch } from '@/lib/types';
import { 
  getAllEmployees, 
  deleteEmployee, 
  reactivateEmployee,
  updateEmployeeRate
} from '@/lib/employeeService';
import { getAllBranches } from '@/lib/branchService'; // Import branch service
import AdminRouteGuard from '@/components/admin/AdminRouteGuard';
import Link from 'next/link';

function ManageEmployeesPageContent() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBranchName, setNewBranchName] = useState(''); // Not used here, but kept if needed for future
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [newRate, setNewRate] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'active' | 'inactive'>('active');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Load branches and selected branch from localStorage on initial render
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

  const fetchEmployees = useCallback(async () => {
    if (!selectedBranchId) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const allEmployees = await getAllEmployees(selectedBranchId);
      setEmployees(allEmployees);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
      alert("직원 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (initialLoadComplete) {
      fetchEmployees();
    }
  }, [initialLoadComplete, fetchEmployees]);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBranchId = e.target.value;
    setSelectedBranchId(newBranchId);
    setSelectedBranchName(branches.find(b => b.branchId === newBranchId)?.branchName || null);
    localStorage.setItem('selectedBranchId', newBranchId);
  };

  const handleDeleteEmployee = async (uid: string) => {
    if (!selectedBranchId) return;
    if (window.confirm("정말로 이 직원을 퇴사 처리하시겠습니까?")) {
      try {
        await deleteEmployee(selectedBranchId, uid);
        await fetchEmployees();
      } catch (error) {
        console.error("Failed to deactivate employee:", error);
        alert("직원을 퇴사 처리할 수 없습니다.");
      }
    }
  };

  const handleReactivateEmployee = async (uid: string) => {
    if (!selectedBranchId) return;
    if (window.confirm("정말로 이 직원을 복귀 처리하시겠습니까?")) {
      try {
        await reactivateEmployee(selectedBranchId, uid);
        await fetchEmployees();
      } catch (error) {
        console.error("Failed to reactivate employee:", error);
        alert("직원을 복귀 처리할 수 없습니다.");
      }
    }
  };

  const handleEditClick = (uid: string, currentRate: number) => {
    setEditingUid(uid);
    setNewRate(currentRate);
  };

  const handleCancelEdit = () => {
    setEditingUid(null);
    setNewRate(0);
  };

  const handleSaveRate = async (uid: string) => {
    if (!selectedBranchId) return;
    try {
      await updateEmployeeRate(selectedBranchId, uid, newRate);
      setEditingUid(null);
      await fetchEmployees();
    } catch (error) {
      console.error("Failed to update rate:", error);
      alert(error instanceof Error ? error.message : "시급을 수정할 수 없습니다.");
    }
  };

  const activeEmployees = employees.filter(e => e.isActive);
  const inactiveEmployees = employees.filter(e => !e.isActive);
  const displayedEmployees = activeTab === 'active' ? activeEmployees : inactiveEmployees;

  const tabClass = (tabName: 'active' | 'inactive') =>
    `px-4 py-2 text-sm font-medium rounded-t-lg transition-colors duration-200 ${
      activeTab === tabName 
        ? 'bg-white text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-500 hover:text-gray-700 bg-gray-50'
    }`;

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
            {selectedBranchName ? `${selectedBranchName} - ` : ''}직원 목록 관리
        </h1>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-[-1px]">
          <nav className="-mb-px flex space-x-2" aria-label="Tabs">
            <button onClick={() => setActiveTab('active')} className={tabClass('active')}>
              재직중인 직원 ({activeEmployees.length})
            </button>
            <button onClick={() => setActiveTab('inactive')} className={tabClass('inactive')}>
              퇴사한 직원 ({inactiveEmployees.length})
            </button>
          </nav>
        </div>

        <div className="w-full max-w-4xl bg-white rounded-lg rounded-t-none shadow-md overflow-hidden">
            {loading ? (
            <p className="p-6">직원 목록을 불러오는 중...</p>
            ) : (
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">시급</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {displayedEmployees.map((employee) => (
                    <tr key={employee.uid}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{employee.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        employee.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {employee.isActive ? '재직중' : '퇴사'}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {editingUid === employee.uid ? (
                        <div className="flex items-center space-x-2">
                            <input 
                            type="number"
                            value={newRate}
                            onChange={(e) => setNewRate(parseFloat(e.target.value))}
                            className="p-1 border rounded-md w-24"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                handleSaveRate(employee.uid);
                                } else if (e.key === 'Escape') {
                                handleCancelEdit();
                                }
                            }}
                            autoFocus
                            />
                            <button onClick={() => handleSaveRate(employee.uid)} className="text-green-600 hover:text-green-900">저장</button>
                            <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-900">취소</button>
                        </div>
                        ) : (
                        <div className="flex items-center space-x-4">
                            <span>{`₩${employee.hourlyRate.toLocaleString()}`}</span>
                            <button onClick={() => handleEditClick(employee.uid, employee.hourlyRate)} className="text-xs text-indigo-600 hover:text-indigo-900">수정</button>
                        </div>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        {employee.isActive ? (
                        <button onClick={() => handleDeleteEmployee(employee.uid)} className="text-red-600 hover:text-red-900">퇴사 처리</button>
                        ) : (
                        <button onClick={() => handleReactivateEmployee(employee.uid)} className="text-green-600 hover:text-green-900">복귀 처리</button>
                        )}
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            )}
        </div>
      </div>
    </main>
  );
}

export default function ManageEmployeesPage() {
  return (
    <AdminRouteGuard>
      <ManageEmployeesPageContent />
    </AdminRouteGuard>
  );
}
