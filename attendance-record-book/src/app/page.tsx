"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link'; // Added this import
import { User, Attendance } from '@/lib/types';
import { getActiveEmployees } from '@/lib/employeeService';
import { isDeviceAuthorized } from '@/lib/deviceAuthService';
import { clockIn, clockOut, getRelevantAttendanceRecordsForDashboard } from '@/lib/attendanceService';

export default function HomePage() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<Map<string, Attendance>>(new Map());
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAllData = useCallback(async () => {
    // console.log("Starting data fetch..."); // Debugging logs can be removed or kept
    try {
      // console.log("Checking device authorization...");
      const authorized = await isDeviceAuthorized();
      // console.log("Device authorized:", authorized);
      setIsAuthorized(authorized);

      if (authorized) {
        // console.log("Fetching employees and attendance...");
        const [activeEmployees, relevantAttendance] = await Promise.all([ // Renamed todaysAttendance to relevantAttendance
          getActiveEmployees(),
          getRelevantAttendanceRecordsForDashboard(), // Use the new function
        ]);
        // console.log("Data fetched successfully.");
        setEmployees(activeEmployees);
        const attendanceMap = new Map(relevantAttendance.map(a => [a.userId, a])); // Use relevantAttendance
        setAttendance(attendanceMap);
      }
    } catch (error) {
      console.error("Failed to initialize dashboard:", error);
    } finally {
      // console.log("Finished data fetch. Setting loading to false.");
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleClockIn = async (userId: string, userName: string) => {
    setRefreshing(true);
    try {
      await clockIn(userId, userName);
      await fetchAllData();
    } catch (error) {
      console.error("Clock-in failed:", error);
      alert(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
      setRefreshing(false);
    }
  };

  const handleClockOut = async (userId: string) => {
    setRefreshing(true);
    try {
      await clockOut(userId);
      await fetchAllData();
    } catch (error) {
      console.error("Clock-out failed:", error);
      alert(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
      setRefreshing(false);
    }
  };

  const getStatus = (employeeId: string) => {
    const record = attendance.get(employeeId);
    if (!record || !record.checkIn) return { text: "출근 전", color: "text-yellow-400" };
    if (record.checkIn && !record.checkOut) return { text: "근무 중", color: "text-green-400" };
    if (record.checkIn && record.checkOut) return { text: "퇴근 완료", color: "text-red-400" };
    return { text: "알 수 없음", color: "text-gray-400" };
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
        <p>로딩 중...</p>
      </main>
    );
  }

  if (!isAuthorized) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-red-900 text-white">
        <h1 className="text-4xl font-bold mb-4">접근 거부됨</h1>
        <p>이 기기는 출퇴근 시스템에 접근할 권한이 없습니다.</p>
        <p className="mt-4 text-sm text-gray-300">관리자에게 문의하세요.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-900 text-white">
      <h1 className="text-5xl font-bold mb-8">출퇴근 대시보드</h1>
      {refreshing && <div className="absolute top-4 right-4 text-white">새로고침 중...</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full max-w-7xl">
        {employees.length > 0 ? (
          employees.map((employee) => {
            const status = getStatus(employee.uid);
            const attendanceRecord = attendance.get(employee.uid);
            // '출근' 버튼은 현재 열려 있는 세션이 없을 때 활성화
            const canClockIn = !attendanceRecord || !!(attendanceRecord.checkIn && attendanceRecord.checkOut);
            // '퇴근' 버튼은 현재 열려 있는 세션이 있을 때 활성화
            const canClockOut = !!(attendanceRecord?.checkIn && !attendanceRecord?.checkOut);

            return (
              <div key={employee.uid} className="bg-gray-800 rounded-lg shadow-lg p-6 flex flex-col justify-between">
                <div>
                  <Link href={`/employee/${employee.uid}?name=${employee.name}`} className="block">
                    <h2 className="text-2xl font-semibold mb-2 text-center hover:text-blue-400 cursor-pointer">{employee.name}</h2>
                  </Link>
                  <div className="text-gray-400 mb-4 text-center">오늘의 상태: <span className={status.color}>{status.text}</span></div>
                  <div className="text-sm text-gray-500">
                    {attendanceRecord?.checkIn && (
                      <div>출근: {new Date(attendanceRecord.checkIn.seconds * 1000).toLocaleTimeString()}</div>
                    )}
                    {attendanceRecord?.checkOut && (
                      <div>퇴근: {new Date(attendanceRecord.checkOut.seconds * 1000).toLocaleTimeString()}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col space-y-2 mt-4">
                  <button
                    onClick={() => handleClockIn(employee.uid, employee.name)}
                    disabled={!canClockIn || refreshing}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                  >
                    출근
                  </button>
                  <button
                    onClick={() => handleClockOut(employee.uid)}
                    disabled={!canClockOut || refreshing}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed"
                  >
                    퇴근
                  </button>
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
