"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getMonthlyAttendance, updateAttendanceRecord } from '@/lib/attendanceService';
import { Attendance } from '@/lib/types';
import { differenceInMinutes } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

// Helper to format Firebase Timestamp to HH:mm string
const formatTimestampToTime = (timestamp: Timestamp | null): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Helper to parse time string (HH:mm) to Firebase Timestamp, keeping the original date
const parseTimeToTimestamp = (timeStr: string, originalTimestamp: Timestamp | null, recordDate: string): Timestamp | null => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = originalTimestamp ? originalTimestamp.toDate() : new Date(recordDate);
  date.setHours(hours, minutes, 0, 0);
  return Timestamp.fromDate(date);
};

// Calculate total break minutes for convenience helpers
const calcBreakMinutes = (breaks: Attendance['breaks'] = []): number => {
  return breaks.reduce((sum, b) => {
    if (!b.start || !b.end) return sum;
    return sum + differenceInMinutes(b.end.toDate(), b.start.toDate());
  }, 0);
};

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
  const [branchId, setBranchId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingFormData, setEditingFormData] = useState<Partial<Attendance>>({});

  useEffect(() => {
    // localStorage에서 branchId 가져오기
    const storedBranchId = localStorage.getItem('selectedBranchId');
    if (storedBranchId) {
      setBranchId(storedBranchId);
    }
  }, []);

  const fetchMonthlyData = useCallback(async () => {
    if (!employeeId || !branchId) return;
    setLoading(true);
    try {
      const records = await getMonthlyAttendance(branchId, employeeId, selectedYear, selectedMonth);
      setAttendanceRecords(records);
    } catch (error) {
      console.error("Failed to fetch monthly attendance:", error);
      alert("월별 출근 기록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [branchId, employeeId, selectedYear, selectedMonth]);

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

  const handleEditClick = (record: Attendance) => {
    setEditingRecordId(record.id);
    setEditingFormData({ checkIn: record.checkIn, checkOut: record.checkOut, breaks: record.breaks });
  };

  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditingFormData({});
  };

  const handleSaveEdit = async (recordId: string) => {
    if (!branchId) return;
    if (!editingFormData.checkIn) {
      alert('출근 시간은 필수입니다.');
      return;
    }
    try {
      await updateAttendanceRecord(branchId, recordId, editingFormData);
      await fetchMonthlyData();
      handleCancelEdit();
    } catch (error) {
      console.error("Failed to update record:", error);
      alert(error instanceof Error ? error.message : "기록을 업데이트할 수 없습니다.");
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!editingRecordId) return;
    const currentRecord = attendanceRecords.find(r => r.id === editingRecordId);
    if (!currentRecord) return;
    
    const originalTimestamp = name === 'checkIn' ? currentRecord.checkIn : currentRecord.checkOut;
    let newTimestamp = parseTimeToTimestamp(value, originalTimestamp, currentRecord.date);
    
    // 퇴근 시간을 수정하는 경우, 출근 시간보다 이르면 다음날로 간주
    if (name === 'checkOut' && newTimestamp) {
      const checkInTs = (editingFormData.checkIn as Timestamp) || currentRecord.checkIn;
      if (checkInTs) {
        const checkInDate = checkInTs.toDate();
        const checkOutDate = newTimestamp.toDate();
        if (checkOutDate <= checkInDate) {
          checkOutDate.setDate(checkOutDate.getDate() + 1);
          newTimestamp = Timestamp.fromDate(checkOutDate);
        }
      }
    }
    
    setEditingFormData(prev => ({ ...prev, [name]: newTimestamp }));
  };

  const handleAdd30Minutes = () => {
    if (!editingFormData.checkOut) {
      if (editingFormData.checkIn) {
        const newCheckOut = new Date((editingFormData.checkIn as Timestamp).toDate());
        newCheckOut.setMinutes(newCheckOut.getMinutes() + 30);
        setEditingFormData(prev => ({ ...prev, checkOut: Timestamp.fromDate(newCheckOut) }));
      }
    } else {
      const currentCheckOut = (editingFormData.checkOut as Timestamp).toDate();
      currentCheckOut.setMinutes(currentCheckOut.getMinutes() + 30);
      setEditingFormData(prev => ({ ...prev, checkOut: Timestamp.fromDate(currentCheckOut) }));
    }
  };

  // Ensure at least the required break minutes by appending a synthetic break ending at check-out.
  const handleEnsureMinimumBreak = (requiredMinutes: number) => {
    if (!editingRecordId) return;
    const currentRecord = attendanceRecords.find(r => r.id === editingRecordId);
    if (!currentRecord) return;

    const checkInTs = (editingFormData.checkIn as Timestamp) || currentRecord.checkIn;
    let checkOutTs = (editingFormData.checkOut as Timestamp) || currentRecord.checkOut;
    
    if (!checkInTs || !checkOutTs) {
      alert('출근과 퇴근 시간을 먼저 입력하세요.');
      return;
    }

    // Normalize checkout to always be after checkin (handles overnight shifts)
    const checkInDate = checkInTs.toDate();
    const originalCheckOutDate = checkOutTs.toDate();
    if (originalCheckOutDate <= checkInDate) {
      const corrected = new Date(originalCheckOutDate.getTime());
      corrected.setDate(corrected.getDate() + 1);
      checkOutTs = Timestamp.fromDate(corrected);
      setEditingFormData(prev => ({ ...prev, checkOut: checkOutTs }));
    }

    const existingBreaks = (editingFormData.breaks || currentRecord.breaks || []) as Attendance['breaks'];
    const currentBreakMinutes = calcBreakMinutes(existingBreaks);
    const missing = requiredMinutes - currentBreakMinutes;

    if (missing <= 0) {
      alert(`이미 ${requiredMinutes}분 이상의 휴게가 반영되었습니다.`);
      return;
    }

    // Append a synthetic break right before checkout
    const checkOutDate = checkOutTs.toDate();
    
    // Check if the work period is valid (checkout should be after checkin)
    if (checkOutDate <= checkInDate) {
      alert('출근과 퇴근 시간이 같거나 역순입니다.');
      return;
    }
    
    const totalWorkMinutes = Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000);
    
    // Calculate the break start time (missing minutes before checkout)
    let startDate = new Date(checkOutDate.getTime() - missing * 60000);

    // If start date goes before check-in, cap it at check-in time
    if (startDate < checkInDate) {
      startDate = checkInDate;
    }

    const newBreak = { start: Timestamp.fromDate(startDate), end: Timestamp.fromDate(checkOutDate) } as Attendance['breaks'][number];

    setEditingFormData(prev => ({
      ...prev,
      breaks: [...existingBreaks, newBreak],
    }));
  };

  const handleBreakChange = (breakIndex: number, field: 'start' | 'end', value: string) => {
    if (!editingRecordId) return;
    const currentRecord = attendanceRecords.find(r => r.id === editingRecordId);
    if (!currentRecord) return;

    const existingBreaks = [...((editingFormData.breaks || currentRecord.breaks || []) as Attendance['breaks'])];
    if (!existingBreaks[breakIndex]) return;

    const originalTimestamp = field === 'start' ? existingBreaks[breakIndex].start : existingBreaks[breakIndex].end;
    const newTimestamp = parseTimeToTimestamp(value, originalTimestamp, currentRecord.date);

    if (newTimestamp) {
      existingBreaks[breakIndex] = {
        ...existingBreaks[breakIndex],
        [field]: newTimestamp
      };
      setEditingFormData(prev => ({ ...prev, breaks: existingBreaks }));
    }
  };

  const handleAddBreak = () => {
    if (!editingRecordId) return;
    const currentRecord = attendanceRecords.find(r => r.id === editingRecordId);
    if (!currentRecord) return;

    const checkInTs = (editingFormData.checkIn as Timestamp) || currentRecord.checkIn;
    const existingBreaks = [...((editingFormData.breaks || currentRecord.breaks || []) as Attendance['breaks'])];
    
    // Create a new break starting 1 hour after check-in, 30 minutes duration
    const defaultStart = new Date(checkInTs.toDate());
    defaultStart.setHours(defaultStart.getHours() + 1);
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setMinutes(defaultEnd.getMinutes() + 30);

    existingBreaks.push({
      start: Timestamp.fromDate(defaultStart),
      end: Timestamp.fromDate(defaultEnd)
    });

    setEditingFormData(prev => ({ ...prev, breaks: existingBreaks }));
  };

  const handleDeleteBreak = (breakIndex: number) => {
    if (!editingRecordId) return;
    const currentRecord = attendanceRecords.find(r => r.id === editingRecordId);
    if (!currentRecord) return;

    const existingBreaks = [...((editingFormData.breaks || currentRecord.breaks || []) as Attendance['breaks'])];
    existingBreaks.splice(breakIndex, 1);
    setEditingFormData(prev => ({ ...prev, breaks: existingBreaks }));
  };
    }

    // Append a synthetic break right before checkout
    const checkOutDate = checkOutTs.toDate();
    
    // Check if the work period is valid (checkout should be after checkin)
    if (checkOutDate <= checkInDate) {
      alert('출근과 퇴근 시간이 같거나 역순입니다.');
      return;
    }
    
    const totalWorkMinutes = Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000);
    
    // Calculate the break start time (missing minutes before checkout)
    let startDate = new Date(checkOutDate.getTime() - missing * 60000);

    // If start date goes before check-in, cap it at check-in time
    if (startDate < checkInDate) {
      startDate = checkInDate;
    }

    const newBreak = { start: Timestamp.fromDate(startDate), end: Timestamp.fromDate(checkOutDate) } as Attendance['breaks'][number];

    setEditingFormData(prev => ({
      ...prev,
      breaks: [...existingBreaks, newBreak],
    }));
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">휴식 시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 근무 시간</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingRecordId === record.id ? (
                        <input
                          type="time"
                          name="checkIn"
                          value={formatTimestampToTime(editingFormData.checkIn as Timestamp)}
                          onChange={handleFormChange}
                          className="p-2 border rounded-md w-32 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                          placeholder="HH:mm"
                        />
                      ) : (
                        record.checkIn ? new Date(record.checkIn.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingRecordId === record.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="time"
                            name="checkOut"
                            value={formatTimestampToTime(editingFormData.checkOut as Timestamp)}
                            onChange={handleFormChange}
                            className="p-2 border rounded-md w-32 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                            placeholder="HH:mm"
                          />
                          <button
                            type="button"
                            onClick={handleAdd30Minutes}
                            className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded"
                          >
                            +30분
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEnsureMinimumBreak(60)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded"
                            title="법정 최소 휴게 60분을 맞추기 위해 퇴근 직전에 부족한 휴게를 채웁니다."
                          >
                            휴게 1시간 맞추기
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(record.id)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                          >
                            저장
                          </button>
                        </div>
                      ) : (
                        record.checkOut ? new Date(record.checkOut.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '근무 중'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {editingRecordId === record.id ? (
                        <div className="space-y-2">
                          {((editingFormData.breaks || record.breaks || []) as Attendance['breaks']).map((b, index) => (
                            <div key={index} className="flex items-center space-x-2 bg-gray-50 p-2 rounded">
                              <input
                                type="time"
                                value={formatTimestampToTime(b.start)}
                                onChange={(e) => handleBreakChange(index, 'start', e.target.value)}
                                className="p-1 border rounded w-24 text-xs"
                              />
                              <span>-</span>
                              <input
                                type="time"
                                value={formatTimestampToTime(b.end)}
                                onChange={(e) => handleBreakChange(index, 'end', e.target.value)}
                                className="p-1 border rounded w-24 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleDeleteBreak(index)}
                                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
                                title="이 휴게 시간 삭제"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={handleAddBreak}
                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded"
                          >
                            + 휴게 추가
                          </button>
                        </div>
                      ) : (
                        record.breaks && record.breaks.length > 0 ? 
                          record.breaks.map((b, index) => {
                            const breakStartTime = new Date(b.start.seconds * 1000);
                            const breakEndTime = b.end ? new Date(b.end.seconds * 1000) : null;
                            const duration = breakEndTime ? differenceInMinutes(breakEndTime, breakStartTime) : null;
                            
                            return (
                              <div key={index}>
                                {breakStartTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} - {breakEndTime ? breakEndTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '진행중'}
                                {duration !== null && duration > 0 && ` (${duration}분)`}
                              </div>
                            );
                          })
                        : '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.totalWorkMinutes > 0 ? `${Math.floor(record.totalWorkMinutes / 60)}시간 ${record.totalWorkMinutes % 60}분` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      {editingRecordId === record.id ? (
                        <>
                          <button onClick={() => handleSaveEdit(record.id)} className="text-green-600 hover:text-green-900 mr-4">저장</button>
                          <button onClick={() => handleCancelEdit()} className="text-gray-600 hover:text-gray-900">취소</button>
                        </>
                      ) : (
                        <button onClick={() => handleEditClick(record)} className="text-indigo-600 hover:text-indigo-900">수정</button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">해당 월의 출근 기록이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
