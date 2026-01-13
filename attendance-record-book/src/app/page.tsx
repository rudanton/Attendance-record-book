"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { User, Attendance } from '@/lib/types';
import { getActiveEmployees } from '@/lib/employeeService';
import { 
  clockIn, 
  clockOut, 
  startBreak, 
  endBreak, 
  getRelevantAttendanceRecordsForDashboard,
  autoCloseLongSessions
} from '@/lib/attendanceService';
import BranchSelectPage from '@/components/BranchSelectPage';
import { getAllBranches } from '@/lib/branchService'; // To get branch name

// ========== 상수 정의 ==========

// 시간 관련
const COUNTDOWN_INITIAL_SECONDS = 3;
const COUNTDOWN_INTERVAL_MS = 1000;

// localStorage 키
const STORAGE_KEY_BRANCH_ID = 'selectedBranchId';

// 시간 포맷 옵션
const TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
};
const TIME_LOCALE = 'ko-KR';

// 상태 텍스트 및 색상
const STATUS_CONFIG = {
  NOT_CLOCKED_IN: { text: "출근 전", color: "text-yellow-400" },
  ON_BREAK: { text: "휴식 중", color: "text-cyan-400" },
  WORKING: { text: "근무 중", color: "text-green-400" },
  CLOCKED_OUT: { text: "퇴근 완료", color: "text-red-400" },
  UNKNOWN: { text: "알 수 없음", color: "text-gray-400" }
};

// 버튼 스타일
const BUTTON_STYLES = {
  CLOCK_IN: "bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300 disabled:bg-gray-500",
  START_BREAK: "bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors duration-300 disabled:bg-gray-500 mb-2",
  CLOCK_OUT: "bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300 disabled:bg-gray-500",
  END_BREAK: "bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300 disabled:bg-gray-500",
  ADD_EMPLOYEE: "bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md shadow",
  ADMIN_MENU: "bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-md",
  MODAL_CONFIRM: "flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded transition-colors duration-300",
  MODAL_CANCEL: "flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded transition-colors duration-300"
};

// 메시지
const MESSAGES = {
  SELECT_BRANCH_FIRST: "지점을 먼저 선택해주세요.",
  UNKNOWN_ERROR: "알 수 없는 오류가 발생했습니다.",
  LOADING_APP: "앱 로딩 중...",
  LOADING_DATA: "데이터 로딩 중...",
  REFRESHING: "새로고침 중...",
  NO_EMPLOYEES: "활성화된 직원이 없습니다.",
  CLOCK_OUT_CONFIRM: "퇴근합니다.",
  MODAL_CONFIRM_BUTTON: "확인",
  MODAL_CANCEL_BUTTON: "취소",
  COUNTDOWN_TEXT: (seconds: number) => `${seconds}초 후 퇴근처리합니다.`,
  PROCESSING: "처리 중...",
  DASHBOARD_TITLE: (branchName: string) => `${branchName} 출퇴근 대시보드`,
  FALLBACK_BRANCH_NAME: "선택된 지점",
  ADD_EMPLOYEE_BUTTON: "신규 직원 추가",
  ADMIN_MENU_BUTTON: "관리자 메뉴",
  TODAY_STATUS_LABEL: "오늘의 상태: ",
  CHECK_IN_LABEL: "출근: ",
  BREAK_START_LABEL: "휴식 시작: ",
  CHECK_OUT_LABEL: "퇴근: ",
  CLOCK_IN_BUTTON: "출근하기",
  START_BREAK_BUTTON: "휴식 시작",
  CLOCK_OUT_BUTTON: "퇴근하기",
  END_BREAK_BUTTON: "휴식 종료"
};

// ================================

export default function HomePage() {
  const [employees, setEmployees] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<Map<string, Attendance>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [clockOutUserId, setClockOutUserId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_INITIAL_SECONDS);
  const clockOutTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // On initial load, try to get branchId from localStorage
    const storedBranchId = localStorage.getItem(STORAGE_KEY_BRANCH_ID);
    if (storedBranchId) {
      setSelectedBranchId(storedBranchId);
    }
    setInitialLoadComplete(true);
  }, []);

  const handleBranchSelected = useCallback(async (branchId: string) => {
    localStorage.setItem(STORAGE_KEY_BRANCH_ID, branchId);
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
      await autoCloseLongSessions(selectedBranchId);
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
      alert(MESSAGES.SELECT_BRANCH_FIRST);
      return;
    }
    setRefreshing(true);
    try {
      await clockIn(selectedBranchId, userId, userName);
      await fetchAllData();
    } catch (error) {
      console.error("Clock-in failed:", error);
      alert(error instanceof Error ? error.message : MESSAGES.UNKNOWN_ERROR);
      setRefreshing(false);
    }
  };

  const handleClockOut = async (userId: string) => {
    if (!selectedBranchId) {
      alert(MESSAGES.SELECT_BRANCH_FIRST);
      return;
    }
    
    // 모달 표시
    setClockOutUserId(userId);
    setShowClockOutModal(true);
    setCountdown(COUNTDOWN_INITIAL_SECONDS);
  };

  // 카운트다운 효과
  useEffect(() => {
    if (showClockOutModal && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, COUNTDOWN_INTERVAL_MS);
      return () => clearTimeout(timer);
    } else if (showClockOutModal && countdown === 0 && clockOutUserId) {
      confirmClockOut(clockOutUserId);
    }
  }, [showClockOutModal, countdown, clockOutUserId]);

  const confirmClockOut = async (userId: string) => {
    setShowClockOutModal(false);
    setClockOutUserId(null);
    setRefreshing(true);
    
    try {
      await clockOut(selectedBranchId!, userId);
      await fetchAllData();
    } catch (error) {
      console.error("Clock-out failed:", error);
      alert(error instanceof Error ? error.message : MESSAGES.UNKNOWN_ERROR);
      setRefreshing(false);
    }
  };

  const cancelClockOut = () => {
    setShowClockOutModal(false);
    setClockOutUserId(null);
  };

  const handleStartBreak = async (userId: string) => {
    if (!selectedBranchId) {
      alert(MESSAGES.SELECT_BRANCH_FIRST);
      return;
    }
    setRefreshing(true);
    try {
      await startBreak(selectedBranchId, userId);
      await fetchAllData();
    } catch (error) {
      console.error("Start break failed:", error);
      alert(error instanceof Error ? error.message : MESSAGES.UNKNOWN_ERROR);
      setRefreshing(false);
    }
  };

  const handleEndBreak = async (userId: string) => {
    if (!selectedBranchId) {
      alert(MESSAGES.SELECT_BRANCH_FIRST);
      return;
    }
    setRefreshing(true);
    try {
      await endBreak(selectedBranchId, userId);
      await fetchAllData();
    } catch (error) {
      console.error("End break failed:", error);
      alert(error instanceof Error ? error.message : MESSAGES.UNKNOWN_ERROR);
      setRefreshing(false);
    }
  };

  const getStatus = (employeeId: string) => {
    const record = attendance.get(employeeId);
    if (!record || !record.checkIn) return STATUS_CONFIG.NOT_CLOCKED_IN;
    
    const isOnBreak = record.breaks?.some(b => b.start && !b.end);
    if (isOnBreak) return STATUS_CONFIG.ON_BREAK;

    if (record.checkIn && !record.checkOut) return STATUS_CONFIG.WORKING;
    if (record.checkIn && record.checkOut) return STATUS_CONFIG.CLOCKED_OUT;
    
    return STATUS_CONFIG.UNKNOWN;
  };

  if (!initialLoadComplete) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
        <p>{MESSAGES.LOADING_APP}</p>
      </main>
    );
  }

  if (!selectedBranchId) {
    return <BranchSelectPage onBranchSelected={handleBranchSelected} />;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-900 text-white">
        <p>{MESSAGES.LOADING_DATA}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-900 text-white">
      <div className="flex w-full max-w-7xl items-center justify-between mb-6">
        <h1 className="text-5xl font-bold">
          {MESSAGES.DASHBOARD_TITLE(selectedBranchName || MESSAGES.FALLBACK_BRANCH_NAME)}
        </h1>
        <div className="flex items-center space-x-3 text-sm">
          <Link
            href="/add-employee"
            className={BUTTON_STYLES.ADD_EMPLOYEE}
          >
            {MESSAGES.ADD_EMPLOYEE_BUTTON}
          </Link>
          <Link
            href="/admin"
            className={BUTTON_STYLES.ADMIN_MENU}
          >
            {MESSAGES.ADMIN_MENU_BUTTON}
          </Link>
        </div>
      </div>
      {refreshing && <div className="absolute top-4 right-4 text-white">{MESSAGES.REFRESHING}</div>}
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
                  <div className="text-gray-400 mb-4 text-center">{MESSAGES.TODAY_STATUS_LABEL}<span className={status.color}>{status.text}</span></div>
                  <div className="text-sm text-gray-500">
                    {attendanceRecord?.checkIn && (
                      <div>{MESSAGES.CHECK_IN_LABEL}{new Date(attendanceRecord.checkIn.seconds * 1000).toLocaleTimeString(TIME_LOCALE, TIME_FORMAT_OPTIONS)}</div>
                    )}
                    {openBreak && (
                      <div className="text-cyan-400">{MESSAGES.BREAK_START_LABEL}{new Date(openBreak.start.seconds * 1000).toLocaleTimeString(TIME_LOCALE, TIME_FORMAT_OPTIONS)}</div>
                    )}
                    {attendanceRecord?.checkOut && (
                      <div>{MESSAGES.CHECK_OUT_LABEL}{new Date(attendanceRecord.checkOut.seconds * 1000).toLocaleTimeString(TIME_LOCALE, TIME_FORMAT_OPTIONS)}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col space-y-2 mt-4">
                  {/* 출근 버튼 */}
                  {canClockIn && (
                    <button
                      onClick={() => handleClockIn(employee.uid, employee.name)}
                      disabled={refreshing}
                      className={BUTTON_STYLES.CLOCK_IN}
                    >
                      {MESSAGES.CLOCK_IN_BUTTON}
                    </button>
                  )}
                  {/* 근무 중일 때 버튼들 */}
                  {isClockedIn && !isOnBreak && (
                    <>
                      <button
                        onClick={() => handleStartBreak(employee.uid)}
                        disabled={refreshing}
                        className={BUTTON_STYLES.START_BREAK}
                      >
                        {MESSAGES.START_BREAK_BUTTON}
                      </button>
                      <button
                        onClick={() => handleClockOut(employee.uid)}
                        disabled={refreshing}
                        className={BUTTON_STYLES.CLOCK_OUT}
                      >
                        {MESSAGES.CLOCK_OUT_BUTTON}
                      </button>
                    </>
                  )}
                  {/* 휴식 중일 때 버튼 */}
                  {isClockedIn && isOnBreak && (
                    <button
                      onClick={() => handleEndBreak(employee.uid)}
                      disabled={refreshing}
                      className={BUTTON_STYLES.END_BREAK}
                    >
                      {MESSAGES.END_BREAK_BUTTON}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <p>{MESSAGES.NO_EMPLOYEES}</p>
        )}
      </div>

      {/* 퇴근 확인 모달 */}
      {showClockOutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">{MESSAGES.CLOCK_OUT_CONFIRM}</h2>
            <div className="flex space-x-4">
              <button
                onClick={() => clockOutUserId && confirmClockOut(clockOutUserId)}
                className={BUTTON_STYLES.MODAL_CONFIRM}
              >
                {MESSAGES.MODAL_CONFIRM_BUTTON}
              </button>
              <button
                onClick={cancelClockOut}
                className={BUTTON_STYLES.MODAL_CANCEL}
              >
                {MESSAGES.MODAL_CANCEL_BUTTON}
              </button>
            </div>
            <p className="text-gray-400 text-lg text-center mt-4 font-mono">
              {countdown > 0 ? MESSAGES.COUNTDOWN_TEXT(countdown) : MESSAGES.PROCESSING}
            </p>
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
