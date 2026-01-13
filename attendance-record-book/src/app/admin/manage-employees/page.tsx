"use client";

import { useCallback,useEffect, useState } from 'react';
import Link from 'next/link';

import AdminRouteGuard from '@/components/admin/AdminRouteGuard';
import { getAllBranches } from '@/lib/branchService'; // Import branch service
import { 
  deleteEmployee, 
  getAllEmployees, 
  reactivateEmployee
} from '@/lib/employeeService';
import { Branch,User } from '@/lib/types';

// ===== Constants =====
const STORAGE_KEYS = {
  SELECTED_BRANCH: 'selectedBranchId',
};

const MESSAGES = {
  TITLE: '직원 목록 관리',
  BACK: '← 관리자 메뉴로 돌아가기',
  CURRENT_BRANCH: '현재 지점:',
  LOADING: '초기 데이터를 불러오는 중...',
  NO_BRANCH_TITLE: '등록된 지점이 없습니다.',
  NO_BRANCH_DESC: '지점 관리에 접속하여 먼저 지점을 추가해주세요.',
  NO_BRANCH_CTA: '지점 관리로 이동',
  TAB_ACTIVE: (count: number) => `재직중인 직원 (${count})`,
  TAB_INACTIVE: (count: number) => `퇴사한 직원 (${count})`,
  FETCH_ERROR: '직원 목록을 불러올 수 없습니다.',
  TERMINATE_CONFIRM: '정말로 이 직원을 퇴사 처리하시겠습니까?',
  REACTIVATE_CONFIRM: '정말로 이 직원을 복귀 처리하시겠습니까?',
  TERMINATE_ERROR: '직원을 퇴사 처리할 수 없습니다.',
  REACTIVATE_ERROR: '직원을 복귀 처리할 수 없습니다.',
};

const BUTTON_STYLES = {
  LINK: 'text-blue-600 hover:text-blue-800',
};

function ManageEmployeesPageContent() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBranchName, setNewBranchName] = useState(''); // Not used here, but kept if needed for future
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

      const storedBranchId = localStorage.getItem(STORAGE_KEYS.SELECTED_BRANCH);
      if (storedBranchId && fetchedBranches.some(b => b.branchId === storedBranchId)) {
        setSelectedBranchId(storedBranchId);
        setSelectedBranchName(fetchedBranches.find(b => b.branchId === storedBranchId)?.branchName || null);
      } else if (fetchedBranches.length > 0) {
        // If stored ID is invalid or not found, select the first branch
        setSelectedBranchId(fetchedBranches[0].branchId);
        setSelectedBranchName(fetchedBranches[0].branchName);
        localStorage.setItem(STORAGE_KEYS.SELECTED_BRANCH, fetchedBranches[0].branchId);
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
      alert(MESSAGES.FETCH_ERROR);
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
    localStorage.setItem(STORAGE_KEYS.SELECTED_BRANCH, newBranchId);
  };

  const handleDeleteEmployee = async (uid: string) => {
    if (!selectedBranchId) return;
    if (window.confirm(MESSAGES.TERMINATE_CONFIRM)) {
      try {
        await deleteEmployee(selectedBranchId, uid);
        await fetchEmployees();
      } catch (error) {
        console.error("Failed to deactivate employee:", error);
        alert(MESSAGES.TERMINATE_ERROR);
      }
    }
  };

  const handleReactivateEmployee = async (uid: string) => {
    if (!selectedBranchId) return;
    if (window.confirm(MESSAGES.REACTIVATE_CONFIRM)) {
      try {
        await reactivateEmployee(selectedBranchId, uid);
        await fetchEmployees();
      } catch (error) {
        console.error("Failed to reactivate employee:", error);
        alert(MESSAGES.REACTIVATE_ERROR);
      }
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
        <p>{MESSAGES.LOADING}</p>
      </main>
    );
  }

  if (branches.length === 0) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-100 text-gray-800 text-center">
        <h1 className="text-4xl font-bold mb-4">{MESSAGES.NO_BRANCH_TITLE}</h1>
        <p className="text-xl mb-8">{MESSAGES.NO_BRANCH_DESC}</p>
        <Link href="/admin/manage-branches">
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-colors duration-300">
            {MESSAGES.NO_BRANCH_CTA}
          </button>
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-100">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <Link href="/admin" className={BUTTON_STYLES.LINK}>
            {MESSAGES.BACK}
            </Link>
            <div className="flex items-center space-x-2">
            <label htmlFor="branch-select" className="text-sm font-medium text-gray-700">{MESSAGES.CURRENT_BRANCH}</label>
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
          {selectedBranchName ? `${selectedBranchName} - ` : ''}{MESSAGES.TITLE}
        </h1>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-[-1px]">
          <nav className="-mb-px flex space-x-2" aria-label="Tabs">
            <button onClick={() => setActiveTab('active')} className={tabClass('active')}>
              {MESSAGES.TAB_ACTIVE(activeEmployees.length)}
            </button>
            <button onClick={() => setActiveTab('inactive')} className={tabClass('inactive')}>
              {MESSAGES.TAB_INACTIVE(inactiveEmployees.length)}
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
