"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getMonthlyAttendance } from '@/lib/attendanceService';
import { Attendance } from '@/lib/types';

export default function EmployeeDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const employeeId = params.id as string;
  const employeeName = searchParams.get('name') || '직원'; // Get name from query param

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1; // 1-indexed

  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const fetchMonthlyData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const records = await getMonthlyAttendance(employeeId, selectedYear, selectedMonth);
      setAttendanceRecords(records);
    } catch (error) {
      console.error("Failed to fetch monthly attendance:", error);
      alert("월별 출근 기록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [employeeId, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchMonthlyData();
  }, [fetchMonthlyData]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMonth(parseInt(e.target.value));
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedYear(parseInt(e.target.value));
  };

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  // Generate year options
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i); // Current year +/- 2
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-100 text-gray-800">
      <Link href="/" className="self-start text-blue-600 hover:text-blue-800 mb-4">← 대시보드로 돌아가기</Link>
      <h1 className="text-4xl font-bold mb-8">{employeeName} 직원 월별 출근 기록</h1>

      <div className="flex items-center space-x-4 mb-6">
        <button onClick={goToPreviousMonth} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">이전 달</button>
        <select value={selectedYear} onChange={handleYearChange} className="p-2 border rounded-md">
          {years.map(year => (
            <option key={year} value={year}>{year}년</option>
          ))}
        </select>
        <select value={selectedMonth} onChange={handleMonthChange} className="p-2 border rounded-md">
          {months.map(month => (
            <option key={month} value={month}>{month}월</option>
          ))}
        </select>
        <button onClick={goToNextMonth} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">다음 달</button>
      </div>

      <div className="w-full max-w-4xl bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <p className="p-6 text-center">월별 기록을 불러오는 중...</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">출근 시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">퇴근 시간</th>
                {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">휴식 시간</th> */}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 근무 시간</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.checkIn ? new Date(record.checkIn.seconds * 1000).toLocaleTimeString('ko-KR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.checkOut ? new Date(record.checkOut.seconds * 1000).toLocaleTimeString('ko-KR') : '근무 중'}
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.breaks.length > 0 ? record.breaks.map(b => `${new Date(b.start.seconds * 1000).toLocaleTimeString()} - ${b.end ? new Date(b.end.seconds * 1000).toLocaleTimeString() : '진행중'}`).join(', ') : '-'}
                    </td> */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.totalWorkMinutes > 0 ? `${Math.floor(record.totalWorkMinutes / 60)}시간 ${record.totalWorkMinutes % 60}분` : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">해당 월의 출근 기록이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
