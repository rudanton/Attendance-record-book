"use client";

import { useEffect, useState, useCallback } from 'react';
import AdminRouteGuard from '@/components/admin/AdminRouteGuard';
import { 
  getAllAttendanceRecords, 
  updateAttendanceRecord, 
  addAttendanceRecord,
  getAggregatedAttendance 
} from '@/lib/attendanceService';
import { getAllEmployees } from '@/lib/employeeService';
import { Attendance, User } from '@/lib/types';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { utils, writeFile } from 'xlsx';

// Helper to format Firebase Timestamp to datetime-local string
const formatTimestampToDatetimeLocal = (timestamp: Timestamp | null): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Helper to parse datetime-local string to Firebase Timestamp
const parseDatetimeLocalToTimestamp = (datetimeLocalStr: string): Timestamp | null => {
  if (!datetimeLocalStr) return null;
  return Timestamp.fromDate(new Date(datetimeLocalStr));
};

// Helper to format Date object to yyyy-MM-dd string
const formatDateToYMD = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function AdminAttendanceLogsContent() {
  const [allRecords, setAllRecords] = useState<Attendance[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingFormData, setEditingFormData] = useState<Partial<Attendance>>({});
  const [employees, setEmployees] = useState<User[]>([]);
  const [newRecordFormData, setNewRecordFormData] = useState({ userId: '', userName: '', date: formatDateToYMD(new Date()), checkIn: '', checkOut: '' });
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [filters, setFilters] = useState({ year: currentYear, month: currentMonth });

  // State for aggregation
  const [aggFilters, setAggFilters] = useState({
    userId: '',
    startDate: '',
    endDate: '',
  });
  const [aggregatedResults, setAggregatedResults] = useState<Map<string, { userName: string, totalWorkMinutes: number; }>>(new Map());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [records, emps] = await Promise.all([getAllAttendanceRecords(), getAllEmployees()]);
      setAllRecords(records);
      setEmployees(emps);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      alert("데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const filtered = allRecords.filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getFullYear() === filters.year && (recordDate.getMonth() + 1) === filters.month;
    });
    // Sort filtered records by date and then by checkIn time for consistent display/export
    filtered.sort((a, b) => {
      const dateComparison = a.date.localeCompare(b.date);
      if (dateComparison !== 0) return dateComparison;
      return (a.checkIn?.toMillis() || 0) - (b.checkIn?.toMillis() || 0);
    });
    setFilteredRecords(filtered);
  }, [allRecords, filters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: parseInt(value) }));
  };

  const handleExportToExcel = () => {
    if (filteredRecords.length === 0) {
      alert('내보낼 기록이 없습니다.');
      return;
    }

    // 1. Get all unique dates and employees from the filtered records
    const uniqueDates = Array.from(new Set(filteredRecords.map(record => record.date))).sort();
    const uniqueEmployees = Array.from(new Set(employees.map(emp => emp.name))).sort(); // Use all employee names for columns

    // 2. Prepare the header row
    const header = ['날짜'];
    uniqueEmployees.forEach(empName => {
      header.push(`${empName} (출근)`, `${empName} (퇴근)`, `${empName} (근무)`);
    });

    // 3. Prepare the data rows
    const dataRows: any[] = [];
    uniqueDates.forEach(date => {
      const row: any = { '날짜': date };
      uniqueEmployees.forEach(empName => {
        const employeeRecordsForDate = filteredRecords.filter(
          record => record.date === date && record.userName === empName
        );

        if (employeeRecordsForDate.length > 0) {
          // Concatenate all records for the day for that employee
          const checkIns = employeeRecordsForDate.map(r => r.checkIn ? new Date(r.checkIn.seconds * 1000).toLocaleTimeString('ko-KR') : '-').join(', ');
          const checkOuts = employeeRecordsForDate.map(r => r.checkOut ? new Date(r.checkOut.seconds * 1000).toLocaleTimeString('ko-KR') : '근무 중').join(', ');
          const workTimes = employeeRecordsForDate.map(r => 
            r.totalWorkMinutes > 0 ? `${Math.floor(r.totalWorkMinutes / 60)}시간 ${r.totalWorkMinutes % 60}분` : '-'
          ).join(', ');
          
          row[`${empName} (출근)`] = checkIns;
          row[`${empName} (퇴근)`] = checkOuts;
          row[`${empName} (근무)`] = workTimes;
        } else {
          // Fill with empty if no record for that employee on that date
          row[`${empName} (출근)`] = '';
          row[`${empName} (퇴근)`] = '';
          row[`${empName} (근무)`] = '';
        }
      });
      dataRows.push(row);
    });

    const worksheet = utils.json_to_sheet(dataRows, { header: header });
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, `${filters.year}년 ${filters.month}월`);
    writeFile(workbook, `${filters.year}_${filters.month}_출퇴근_기록.xlsx`);
  };

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // --- Edit/Add Handlers ---
  // Re-added implementations for clarity and to prevent unexpected behavior after full file replacement
  const handleEditClick = (record: Attendance) => {
    setEditingRecordId(record.id);
    setEditingFormData({ checkIn: record.checkIn, checkOut: record.checkOut, breaks: record.breaks });
  };
  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditingFormData({});
  };
  const handleSaveEdit = async (recordId: string) => {
    if (!editingFormData.checkIn) {
      alert('출근 시간은 필수입니다.');
      return;
    }
    try {
      await updateAttendanceRecord(recordId, editingFormData);
      await fetchData(); // Refresh list after update
      handleCancelEdit();
    } catch (error) {
      console.error("Failed to update record:", error);
      alert(error instanceof Error ? error.message : "기록을 업데이트할 수 없습니다.");
    }
  };
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditingFormData(prev => ({ ...prev, [name]: parseDatetimeLocalToTimestamp(value) }));
  };
  const handleNewRecordInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'userId') {
      const selectedEmployee = employees.find(emp => emp.uid === value);
      setNewRecordFormData(prev => ({ ...prev, userId: value, userName: selectedEmployee ? selectedEmployee.name : '' }));
    } else {
      setNewRecordFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const { userId, userName, date, checkIn, checkOut } = newRecordFormData;
    if (!userId || !date || !checkIn) {
      alert('직원, 날짜, 출근 시간은 필수입니다.');
      return;
    }
    try {
      await addAttendanceRecord({ userId, userName, date, checkIn: new Date(checkIn), checkOut: checkOut ? new Date(checkOut) : null });
      setNewRecordFormData({ userId: '', userName: '', date: formatDateToYMD(new Date()), checkIn: '', checkOut: '' });
      await fetchData(); // Refresh list after add
    } catch (error) {
      console.error("Failed to add new record:", error);
      alert(error instanceof Error ? error.message : "새 기록을 추가할 수 없습니다.");
    }
  };

  // --- Aggregation Handlers (remain the same as before) ---
  const handleAggFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAggFilters(prev => ({ ...prev, [name]: value }));
  };
  const handleAggregate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { userId, startDate, endDate } = aggFilters;
    if (!startDate || !endDate) {
      alert('조회할 시작일과 종료일을 모두 선택해주세요.');
      return;
    }
    try {
      const results = await getAggregatedAttendance(userId || null, startDate, endDate);
      setAggregatedResults(results);
    } catch (error) {
      console.error("Failed to aggregate data:", error);
      alert("데이터 정산 중 오류가 발생했습니다.");
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-100 text-gray-800">
      <h1 className="text-4xl font-bold mb-8">관리자 - 전체 출퇴근 기록</h1>
      <Link href="/admin" className="self-start text-blue-600 hover:text-blue-800 mb-4">← 관리자 홈으로 돌아가기</Link>
      
      {/* Month/Year Filter and Excel Export Button */}
      <div className="w-full max-w-6xl mb-4 p-6 bg-white rounded-lg shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold">월별 기록 필터</h2>
          <select name="year" value={filters.year} onChange={handleFilterChange} className="p-2 border rounded-md">
            {years.map(year => <option key={year} value={year}>{year}년</option>)}
          </select>
          <select name="month" value={filters.month} onChange={handleFilterChange} className="p-2 border rounded-md">
            {months.map(month => <option key={month} value={month}>{month}월</option>)}
          </select>
        </div>
        <button onClick={handleExportToExcel} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md">
          현재 월 기록 Excel로 다운로드
        </button>
      </div>

      {/* Manual Add Record Form */}
      <div className="w-full max-w-6xl mb-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">수동 기록 추가</h2>
        <form onSubmit={handleAddRecord} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col">
            <label htmlFor="newUserId" className="text-sm font-medium text-gray-600 mb-1">직원</label>
            <select
              name="userId"
              id="newUserId"
              value={newRecordFormData.userId}
              onChange={handleNewRecordInputChange}
              className="p-2 border rounded-md"
              required
            >
              <option value="">직원 선택</option>
              {employees.map(emp => (
                <option key={emp.uid} value={emp.uid}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label htmlFor="newDate" className="text-sm font-medium text-gray-600 mb-1">날짜</label>
            <input
              type="date"
              name="date"
              id="newDate"
              value={newRecordFormData.date}
              onChange={handleNewRecordInputChange}
              className="p-2 border rounded-md"
              required
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="newCheckIn" className="text-sm font-medium text-gray-600 mb-1">출근 시간</label>
            <input
              type="datetime-local"
              name="checkIn"
              id="newCheckIn"
              value={newRecordFormData.checkIn}
              onChange={handleNewRecordInputChange}
              className="p-2 border rounded-md"
              required
            />
          </div>
          <div className="flex flex-col">
            <label htmlFor="newCheckOut" className="text-sm font-medium text-gray-600 mb-1">퇴근 시간 (선택)</label>
            <input
              type="datetime-local"
              name="checkOut"
              id="newCheckOut"
              value={newRecordFormData.checkOut}
              onChange={handleNewRecordInputChange}
              className="p-2 border rounded-md"
            />
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md h-10 self-end">기록 추가</button>
        </form>
      </div>

      {/* Aggregation Section */}
      <div className="w-full max-w-6xl mb-8 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-semibold mb-4">근무 시간 정산 및 내보내기</h2>
        <form onSubmit={handleAggregate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="flex flex-col">
            <label htmlFor="aggStartDate" className="text-sm font-medium text-gray-600 mb-1">시작일</label>
            <input type="date" name="startDate" id="aggStartDate" value={aggFilters.startDate} onChange={handleAggFilterChange} className="p-2 border rounded-md" required />
          </div>
          <div className="flex flex-col">
            <label htmlFor="aggEndDate" className="text-sm font-medium text-gray-600 mb-1">종료일</label>
            <input type="date" name="endDate" id="aggEndDate" value={aggFilters.endDate} onChange={handleAggFilterChange} className="p-2 border rounded-md" required />
          </div>
          <div className="flex flex-col">
            <label htmlFor="aggUserId" className="text-sm font-medium text-gray-600 mb-1">직원 (선택)</label>
            <select name="userId" id="aggUserId" value={aggFilters.userId} onChange={handleAggFilterChange} className="p-2 border rounded-md">
              <option value="">모든 직원</option>
              {employees.map(emp => (<option key={emp.uid} value={emp.uid}>{emp.name}</option>))}
            </select>
          </div>
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md h-10 self-end">조회하기</button>
        </form>

        {aggregatedResults.size > 0 && (
          <div>
            <h3 className="text-xl font-semibold mb-2">정산 결과</h3>
            <table className="min-w-full divide-y divide-gray-200 mb-4">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">직원 이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 근무 시간</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.from(aggregatedResults.entries()).map(([userId, data]) => (
                  <tr key={userId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{data.userName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{Math.floor(data.totalWorkMinutes / 60)}시간 {data.totalWorkMinutes % 60}분</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Download button for aggregated results */}
            <button onClick={handleExportToExcel} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md">Excel로 다운로드</button>
          </div>
        )}
      </div>

      <div className="w-full max-w-6xl bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <p className="p-6 text-center">기록을 불러오는 중...</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">직원 이름</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">출근 시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">퇴근 시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 근무 시간</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{record.userName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingRecordId === record.id ? (
                        <input
                          type="datetime-local"
                          name="checkIn"
                          value={formatTimestampToDatetimeLocal(editingFormData.checkIn as Timestamp)}
                          onChange={handleFormChange}
                          className="p-1 border rounded-md w-40"
                        />
                      ) : (
                        record.checkIn ? new Date(record.checkIn.seconds * 1000).toLocaleString('ko-KR') : '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingRecordId === record.id ? (
                        <input
                          type="datetime-local"
                          name="checkOut"
                          value={formatTimestampToDatetimeLocal(editingFormData.checkOut as Timestamp)}
                          onChange={handleFormChange}
                          className="p-1 border rounded-md w-40"
                        />
                      ) : (
                        record.checkOut ? new Date(record.checkOut.seconds * 1000).toLocaleString('ko-KR') : '근무 중'
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
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">기록이 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}

export default function AdminAttendanceLogsPage() {
  return (<AdminRouteGuard><AdminAttendanceLogsContent /></AdminRouteGuard>);
}