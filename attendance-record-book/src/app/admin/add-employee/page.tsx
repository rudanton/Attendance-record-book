"use client";

import { useState, useCallback } from 'react';
import { addEmployee } from '@/lib/employeeService';
import AdminRouteGuard from '@/components/admin/AdminRouteGuard';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

function AddEmployeePageContent() {
  const [formState, setFormState] = useState({ name: '', pin: '', hourlyRate: '' });
  const router = useRouter();

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
      alert('성공적으로 직원을 추가했습니다.');
      setFormState({ name: '', pin: '', hourlyRate: '' });
      // Removed redirection to employee list after adding, as per user request.
    } catch (error) {
      console.error("Failed to add employee:", error);
      alert(error instanceof Error ? error.message : "직원을 추가할 수 없습니다.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-100">
      <div className="w-full max-w-4xl">
        <div className="flex justify-start items-center mb-8">
            <Link href="/admin" className="text-blue-600 hover:text-blue-800">
                ← 관리자 메뉴로 돌아가기
            </Link>
        </div>
        <h1 className="text-4xl font-bold mb-8 text-gray-800">신규 직원 추가</h1>
        
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
