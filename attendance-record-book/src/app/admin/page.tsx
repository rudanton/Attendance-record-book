"use client";

import { useEffect, useState, useCallback } from 'react';
import { User } from '@/lib/types';
import { 
  getAllEmployees, 
  addEmployee, 
  deleteEmployee, 
  reactivateEmployee,
  updateEmployeeRate
} from '@/lib/employeeService';
import AdminRouteGuard from '@/components/admin/AdminRouteGuard'; // Import AdminRouteGuard
import Link from 'next/link';

function AdminPageContent() { // Renamed the default export to a regular function
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState({ name: '', pin: '', hourlyRate: '' });
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [newRate, setNewRate] = useState<number>(0);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const allEmployees = await getAllEmployees();
      setEmployees(allEmployees);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
      alert("직원 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prevState => ({ ...prevState, [name]: value }));
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, pin, hourlyRate } = formState;
    if (!name || !pin || !hourlyRate) {
      alert("모든 항목을 입력해주세요.");
      return;
    }

    try {
      await addEmployee({ 
        name, 
        pin, 
        hourlyRate: parseFloat(hourlyRate),
        role: 'staff' // Defaulting role to 'staff'
      });
      setFormState({ name: '', pin: '', hourlyRate: '' });
      await fetchEmployees();
    } catch (error) {
      console.error("Failed to add employee:", error);
      alert(error instanceof Error ? error.message : "직원을 추가할 수 없습니다.");
    }
  };

  const handleDeleteEmployee = async (uid: string) => {
    if (window.confirm("정말로 이 직원을 퇴사 처리하시겠습니까?")) {
      try {
        await deleteEmployee(uid);
        await fetchEmployees();
      } catch (error) {
        console.error("Failed to deactivate employee:", error);
        alert("직원을 퇴사 처리할 수 없습니다.");
      }
    }
  };

  const handleReactivateEmployee = async (uid: string) => {
    if (window.confirm("정말로 이 직원을 복귀 처리하시겠습니까?")) {
      try {
        await reactivateEmployee(uid);
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
    try {
      await updateEmployeeRate(uid, newRate);
      setEditingUid(null);
      await fetchEmployees();
    } catch (error) {
      console.error("Failed to update rate:", error);
      alert(error instanceof Error ? error.message : "시급을 수정할 수 없습니다.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-100">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">관리자 - 직원 관리</h1>
      
      <Link href="/admin/attendance-logs" className="self-start text-blue-600 hover:text-blue-800 mb-6">
        → 전체 출퇴근 기록 보기
      </Link>
      
      {/* Add Employee Form */}
      <div className="w-full max-w-4xl mb-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-700">신규 직원 추가</h2>
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

      {/* Employee List */}
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-md overflow-hidden">
        <h2 className="text-2xl font-semibold p-6 text-gray-700">직원 목록</h2>
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
              {employees.map((employee) => (
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
    </main>
  );
}

export default function AdminPage() {
  return (
    <AdminRouteGuard>
      <AdminPageContent />
    </AdminRouteGuard>
  );
}
