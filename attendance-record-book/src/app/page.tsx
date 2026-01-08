"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { User, Attendance } from '@/lib/types';
import { getActiveEmployees } from '@/lib/employeeService';
import { 
  clockIn, 
  clockOut, 
  startBreak, 
  endBreak, 
  getRelevantAttendanceRecordsForDashboard 
} from '@/lib/attendanceService';
import BranchSelectPage from '@/components/BranchSelectPage';
import { getAllBranches } from '@/lib/branchService'; // To get branch name

export default function HomePage() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<Map<string, Attendance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  useEffect(() => {
    // On initial load, try to get branchId from localStorage
    const storedBranchId = localStorage.getItem('selectedBranchId');
    if (storedBranchId) {
      setSelectedBranchId(storedBranchId);
    }
    setInitialLoadComplete(true);
  }, []);

  const handleBranchSelected = useCallback(async (branchId: string) => {
    localStorage.setItem('selectedBranchId', branchId);
    setSelectedBranchId(branchId);
    // Fetch all branches to get the name for the selected ID
    try {
      const branches = await getAllBranches();
      const branch = branches.find(b => b.branchId === branchId);
      setSelectedBranchName(branch ? branch.branchName : null);
    } catch (error) {
      console.error("Failed to fetch branch name:", error);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    if (!selectedBranchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [activeEmployees, relevantAttendance, allBranches] = await Promise.all([
        getActiveEmployees(selectedBranchId),
        getRelevantAttendanceRecordsForDashboard(selectedBranchId),
        getAllBranches() // Fetch branches to get the name
      ]);
      setEmployees(activeEmployees);
      const attendanceMap = new Map(relevantAttendance.map(a => [a.userId, a]));
      setAttendance(attendanceMap);

      const branch = allBranches.find(b => b.branchId === selectedBranchId);
      setSelectedBranchName(branch ? branch.branchName : null);

    } catch (error) {
      console.error("Failed to initialize dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (initialLoadComplete && selectedBranchId) {
      fetchAllData();
    } else if (initialLoadComplete && !selectedBranchId) {
      setLoading(false); // No branch selected, so stop loading
    }
  }, [initialLoadComplete, selectedBranchId, fetchAllData]);


  const handleClockIn = async (userId: string, userName: string) => {
    if (!selectedBranchId) {
      alert("지점을 먼저 선택해주세요.");
      return;
    }
    setRefreshing(true);
    try {
      await clockIn(selectedBranchId, userId, userName);
      await fetchAllData();
    } catch (error) {
      console.error("Clock-in failed:", error);
      alert(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
      setRefreshing(false);
    }
  };

  const handleClockOut = async (userId: string) => {
    if (!selectedBranchId) {
      alert("지점을 먼저 선택해주세요.");
      return;
    }
    setRefreshing(true);
    try {
      await clockOut(selectedBranchId, userId);
      await fetchAllData();
    } catch (error) {
      console.error("Clock-out failed:", error);
      alert(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
      setRefreshing(false);
    }
  };

  const handleStartBreak = async (userId: string) => {
    if (!selectedBranchId) {
      alert("지점을 먼저 선택해주세요.");
      return;
    }
    setRefreshing(true);
    try {
      await startBreak(selectedBranchId, userId);
      await fetchAllData();
    } catch (error) {
      console.error("Start break failed:", error);
      alert(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
      setRefreshing(false);
    }
  };

  const handleEndBreak = async (userId: string) => {
    if (!selectedBranchId) {
      alert("지점을 먼저 선택해주세요.");
      return;
    }
    setRefreshing(true);
    try {
      await endBreak(selectedBranchId, userId);
      await fetchAllData();
    } catch (error) {
      console.error("End break failed:", error);
      alert(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
      setRefreshing(false);
    }
  };

  const getStatus = (employeeId: string) => {
    const record = attendance.get(employeeId);
    if (!record || !record.checkIn) return { text: "출근 전", color: "text-yellow-400" };
    
    const isOnBreak = record.breaks?.some(b => b.start && !b.end);
    if (isOnBreak) return { text: "휴식 중", color: "text-cyan-400" };

    if (record.checkIn && !record.checkOut) return { text: "근무 중", color: "text-green-400" };
    if (record.checkIn && record.checkOut) return { text: "퇴근 완료", color: "text-red-400" };
    
    return { text: "알 수 없음", color: "text-gray-400" };
  };

  if (!initialLoadComplete) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
        <p>앱 로딩 중...</p>
      </main>
    );
  }

  if (!selectedBranchId) {
    return <BranchSelectPage onBranchSelected={handleBranchSelected} />;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
        <p>데이터 로딩 중...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-8">
        {selectedBranchName || '선택된 지점'} 출퇴근 대시보드
      </h1>
      {refreshing && <div className="absolute top-4 right-4 text-white">새로고침 중...</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-7xl">
        {employees.length > 0 ? (
          employees.map((employee) => {
            const status = getStatus(employee.uid);
            const attendanceRecord = attendance.get(employee.uid);

            const canClockIn = !attendanceRecord || !!(attendanceRecord.checkIn && attendanceRecord.checkOut);
            const isClockedIn = !!(attendanceRecord?.checkIn && !attendanceRecord?.checkOut);
            const openBreak = isClockedIn && attendanceRecord.breaks?.find(b => b.start && !b.end);
            const isOnBreak = !!openBreak;

            return (
              <div key={employee.uid} className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col justify-between">
                <div>
                  <Link href={`/employee/${employee.uid}?name=${employee.name}`} className="block">
                    <h2 className="text-2xl font-semibold mb-2 text-center hover:text-blue-400 cursor-pointer">{employee.name}</h2>
                  </Link>
                  <div className="text-gray-400 mb-4 text-center">오늘의 상태: <span className={status.color}>{status.text}</span></div>
                  <div className="text-sm text-gray-500">
                    {attendanceRecord?.checkIn && (
                      <div>출근: {new Date(attendanceRecord.checkIn.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    )}
                    {openBreak && (
                      <div className="text-cyan-400">휴식 시작: {new Date(openBreak.start.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    )}
                    {attendanceRecord?.checkOut && (
                      <div>퇴근: {new Date(attendanceRecord.checkOut.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col space-y-2 mt-4">
                  {/* 출근 버튼 */}
                  {canClockIn && (
                    <button
                      onClick={() => handleClockIn(employee.uid, employee.name)}
                      disabled={refreshing}
                      className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300 disabled:bg-gray-500"
                    >
                      출근하기
                    </button>
                  )}
                  {/* 근무 중일 때 버튼들 */}
                  {isClockedIn && !isOnBreak && (
                    <>
                      <button
                        onClick={() => handleStartBreak(employee.uid)}
                        disabled={refreshing}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300 disabled:bg-gray-500"
                      >
                        휴식 시작
                      </button>
                      <button
                        onClick={() => handleClockOut(employee.uid)}
                        disabled={refreshing}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300 disabled:bg-gray-500"
                      >
                        퇴근하기
                      </button>
                    </>
                  )}
                  {/* 휴식 중일 때 버튼 */}
                  {isClockedIn && isOnBreak && (
                    <button
                      onClick={() => handleEndBreak(employee.uid)}
                      disabled={refreshing}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300 disabled:bg-gray-500"
                    >
                      휴식 종료
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p>활성화된 직원이 없습니다.</p>
        )}
      </div>
    </main>
  );
}
