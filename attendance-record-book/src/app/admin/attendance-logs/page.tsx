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
import { getAllBranches } from '@/lib/branchService';
import { Attendance, User, Branch } from '@/lib/types';
import Link from 'next/link';
import { Timestamp } from 'firebase/firestore';
import { utils, writeFile } from 'xlsx';

// Helper function to format minutes into a "X시간 Y분" string
const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return '0분';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours > 0 ? `${hours}시간 ` : ''}${mins}분`;
};


// Helper to format Firebase Timestamp to datetime-local string
const formatTimestampToDatetimeLocal = (timestamp: Timestamp | null): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Helper to format Firebase Timestamp to HH:mm string
const formatTimestampToTime = (timestamp: Timestamp | null): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// Helper to parse datetime-local string to Firebase Timestamp
const parseDatetimeLocalToTimestamp = (datetimeLocalStr: string): Timestamp | null => {
  if (!datetimeLocalStr) return null;
  return Timestamp.fromDate(new Date(datetimeLocalStr));
};

// Helper to parse time string (HH:mm) to Firebase Timestamp, keeping the original date
const parseTimeToTimestamp = (timeStr: string, originalTimestamp: Timestamp | null, recordDate: string): Timestamp | null => {
  if (!timeStr) return null;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = originalTimestamp ? originalTimestamp.toDate() : new Date(recordDate);
  date.setHours(hours, minutes, 0, 0);
  return Timestamp.fromDate(date);
};

// Helper to format Date object to yyyy-MM-dd string
const formatDateToYMD = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

type AggregatedResult = {
  userName: string;
  regularWorkMinutes: number;
  nightWorkMinutes: number;
  totalWorkMinutes: number;
};

function AdminAttendanceLogsContent() {
  const [allRecords, setAllRecords] = useState<Attendance[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingFormData, setEditingFormData] = useState<Partial<Attendance>>({});
  const [employees, setEmployees] = useState<User[]>([]);
  const [newRecordFormData, setNewRecordFormData] = useState({ userId: '', userName: '', date: formatDateToYMD(new Date()), checkInTime: '', checkOutTime: '' });
  
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [filters, setFilters] = useState({ year: currentYear, month: currentMonth });

  // State for aggregation
  const [aggFilters, setAggFilters] = useState({
    userId: '',
    startDate: '',
    endDate: '',
  });
  const [aggregatedResults, setAggregatedResults] = useState<Map<string, AggregatedResult>>(new Map());

  // Branch states
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

  const fetchData = useCallback(async () => {
    if (!selectedBranchId) {
        setLoading(false);
        setAllRecords([]);
        setEmployees([]);
        setAggregatedResults(new Map()); // Clear aggregated results as well
        return;
    }
    setLoading(true);
    try {
      const [records, emps] = await Promise.all([getAllAttendanceRecords(selectedBranchId), getAllEmployees(selectedBranchId)]);
      setAllRecords(records);
      setEmployees(emps);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      alert("데이터를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (initialLoadComplete) {
      fetchData();
    }
  }, [initialLoadComplete, fetchData]);

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

    // 월별 필터 변경 시 정산 필터의 시작일/종료일도 자동 업데이트
    const startOfMonth = new Date(filters.year, filters.month - 1, 1);
    const endOfMonth = new Date(filters.year, filters.month, 0);
    setAggFilters(prev => ({
      ...prev,
      startDate: formatDateToYMD(startOfMonth),
      endDate: formatDateToYMD(endOfMonth)
    }));
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
          const checkIns = employeeRecordsForDate.map(r => r.checkIn ? new Date(r.checkIn.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-').join(', ');
          const checkOuts = employeeRecordsForDate.map(r => r.checkOut ? new Date(r.checkOut.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '근무 중').join(', ');
          const workTimes = employeeRecordsForDate.map(r => formatMinutes(r.totalWorkMinutes)).join(', ');
          
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
  const handleEditClick = (record: Attendance) => {
    setEditingRecordId(record.id);
    setEditingFormData({ checkIn: record.checkIn, checkOut: record.checkOut, breaks: record.breaks });
  };
  const handleCancelEdit = () => {
    setEditingRecordId(null);
    setEditingFormData({});
  };
  const handleSaveEdit = async (recordId: string) => {
    if (!selectedBranchId) return; // Add check for selectedBranchId
    if (!editingFormData.checkIn) {
      alert('출근 시간은 필수입니다.');
      return;
    }
    try {
      await updateAttendanceRecord(selectedBranchId, recordId, editingFormData);
      await fetchData(); // Refresh list after update
      handleCancelEdit();
    } catch (error) {
      console.error("Failed to update record:", error);
      alert(error instanceof Error ? error.message : "기록을 업데이트할 수 없습니다.");
    }
  };
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!editingRecordId) return;
    const currentRecord = allRecords.find(r => r.id === editingRecordId);
    if (!currentRecord) return;
    
    const originalTimestamp = name === 'checkIn' ? currentRecord.checkIn : currentRecord.checkOut;
    const newTimestamp = parseTimeToTimestamp(value, originalTimestamp, currentRecord.date);
    setEditingFormData(prev => ({ ...prev, [name]: newTimestamp }));
  };

  const handleAdd30Minutes = () => {
    if (!editingFormData.checkOut) {
      // 출근 시간이 있으면 출근 시간 + 30분을 기본값으로 설정
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

  const handleAdd30MinutesNewRecord = () => {
    const { date, checkInTime, checkOutTime } = newRecordFormData;
    
    if (!checkOutTime && checkInTime) {
      // 출근 시간 + 30분
      const [hours, minutes] = checkInTime.split(':').map(Number);
      const newDate = new Date();
      newDate.setHours(hours, minutes + 30, 0, 0);
      const newCheckOutTime = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;
      setNewRecordFormData(prev => ({ ...prev, checkOutTime: newCheckOutTime }));
    } else if (checkOutTime) {
      // 현재 퇴근 시간 + 30분
      const [hours, minutes] = checkOutTime.split(':').map(Number);
      const newDate = new Date();
      newDate.setHours(hours, minutes + 30, 0, 0);
      const newCheckOutTime = `${String(newDate.getHours()).padStart(2, '0')}:${String(newDate.getMinutes()).padStart(2, '0')}`;
      setNewRecordFormData(prev => ({ ...prev, checkOutTime: newCheckOutTime }));
    }
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
    if (!selectedBranchId) return; // Add check for selectedBranchId
    const { userId, userName, date, checkInTime, checkOutTime } = newRecordFormData;
    if (!userId || !date || !checkInTime) {
      alert('직원, 날짜, 출근 시간은 필수입니다.');
      return;
    }
    try {
      // Combine date and time to create full datetime
      const checkInDateTime = new Date(`${date}T${checkInTime}:00`);
      const checkOutDateTime = checkOutTime ? new Date(`${date}T${checkOutTime}:00`) : null;
      
      await addAttendanceRecord(selectedBranchId, { userId, userName, date, checkIn: checkInDateTime, checkOut: checkOutDateTime });
      setNewRecordFormData({ userId: '', userName: '', date: formatDateToYMD(new Date()), checkInTime: '', checkOutTime: '' });
      await fetchData(); // Refresh list after add
    } catch (error) {
      console.error("Failed to add new record:", error);
      alert(error instanceof Error ? error.message : "새 기록을 추가할 수 없습니다.");
    }
  };

  // --- Aggregation Handlers ---
  const handleAggFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAggFilters(prev => ({ ...prev, [name]: value }));
  };
  
  // 자동으로 정산 수행
  const performAggregation = useCallback(async () => {
    if (!selectedBranchId) return;
    const { userId, startDate, endDate } = aggFilters;
    if (!startDate || !endDate) return;
    
    try {
      const attendanceResults = await getAggregatedAttendance(selectedBranchId, userId || null, startDate, endDate);
      
      const enrichedResults = new Map<string, AggregatedResult>();

      for (const [uid, data] of attendanceResults.entries()) {
        enrichedResults.set(uid, {
          ...data,
        });
      }

      setAggregatedResults(enrichedResults);
    } catch (error) {
      console.error("Failed to aggregate data:", error);
    }
  }, [selectedBranchId, aggFilters]);

  // 정산 필터나 직원 데이터가 변경될 때 자동으로 정산 수행
  useEffect(() => {
    if (aggFilters.startDate && aggFilters.endDate && employees.length > 0) {
      performAggregation();
    }
  }, [aggFilters, employees, performAggregation]);

  const handleAggregate = async (e: React.FormEvent) => {
    e.preventDefault();
    performAggregation();
  };

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBranchId = e.target.value;
    setSelectedBranchId(newBranchId);
    setSelectedBranchName(branches.find(b => b.branchId === newBranchId)?.branchName || null);
    localStorage.setItem('selectedBranchId', newBranchId);
  };

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
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-100 text-gray-800">
      <div className="w-full max-w-7xl">
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
            {selectedBranchName ? `${selectedBranchName} - ` : ''}전체 출퇴근 기록 및 정산
        </h1>
      
      {selectedBranchId && ( // Render content only if a branch is selected
        <>
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
                {employees.map(emp => (<option key={emp.uid} value={emp.uid}>{emp.name}</option>))}
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
                type="time"
                name="checkInTime"
                id="newCheckIn"
                value={newRecordFormData.checkInTime}
                onChange={handleNewRecordInputChange}
                className="p-2 border rounded-md [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                placeholder="HH:mm"
                required
                />
            </div>
            <div className="flex flex-col">
                <label htmlFor="newCheckOut" className="text-sm font-medium text-gray-600 mb-1">퇴근 시간 (선택)</label>
                <div className="flex items-center space-x-2">
                  <input
                  type="time"
                  name="checkOutTime"
                  id="newCheckOut"
                  value={newRecordFormData.checkOutTime}
                  onChange={handleNewRecordInputChange}
                  className="p-2 border rounded-md flex-1 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                  placeholder="HH:mm"
                  />
                  <button
                    type="button"
                    onClick={handleAdd30MinutesNewRecord}
                    className="px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded whitespace-nowrap"
                  >
                    +30분
                  </button>
                </div>
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md h-10 self-end">기록 추가</button>
            </form>
        </div>

        {/* Aggregation Section */}
        <div className="w-full max-w-7xl mb-8 p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">근무 시간 정산 및 급여 계산</h2>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">총 근무</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">일반 근무</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">야간 근무</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">시급</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">예상 급여</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {Array.from(aggregatedResults.entries()).map(([userId, data]) => (
                    <tr key={userId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{data.userName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold">{formatMinutes(data.totalWorkMinutes)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatMinutes(data.regularWorkMinutes)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{formatMinutes(data.nightWorkMinutes)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">₩{data.hourlyRate.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">₩{data.estimatedSalary.toLocaleString()}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            )}
        </div>

        <div className="w-full max-w-7xl bg-white rounded-lg shadow-md overflow-hidden">
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
                            </div>
                        ) : (
                            record.checkOut ? new Date(record.checkOut.seconds * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '근무 중'
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
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                            출퇴근 기록이 없습니다.
                        </td>
                    </tr>
                )}
                </tbody>
            </table>
            )}
        </div>
        </>
      )}
      </div>
    </main>
  );
}

export default function AdminAttendanceLogsPage() {
  return (<AdminRouteGuard><AdminAttendanceLogsContent /></AdminRouteGuard>);
}