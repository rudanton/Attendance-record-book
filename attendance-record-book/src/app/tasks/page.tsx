"use client";

import { useState, useMemo } from "react";
import { matchesKoreanSearch } from "@/lib/koreanSearch";

// ===== 상수 =====
const DEFAULT_TASKS = ["청소", "재고 점검", "쓰레기 버리기", "온도 체크"];

const EMPLOYEES = [
  { id: "1", name: "김철수" },
  { id: "2", name: "박민수" },
  { id: "3", name: "이영희" },
  { id: "4", name: "홍길동" },
];

const MESSAGES = {
  TITLE: "업무 체크리스트",
  BACK: "← 대시보드로",
  ADD_TASK: "+ 태스크 추가",
  SEARCH_TASK: "태스크 검색...",
  CLEAR: "지우기",
  PREV_MONTH: "이전 달",
  NEXT_MONTH: "다음 달",
  EMPTY_CELL_TOOLTIP: "클릭하여 수행자 선택",
  SELECT_EMPLOYEE_TITLE: "누가 수행했나요?",
  SEARCH_EMPLOYEE: "직원 검색...",
  CANCEL: "취소",
  DELETE_CONFIRM_TITLE: "기록을 삭제할까요?",
  DELETE: "삭제",
  TASK_LABEL: "태스크",
  EMPLOYEE_LABEL: "수행자",
  DATE_LABEL: "날짜",
  ADD_TASK_TITLE: "새 태스크 추가",
  TASK_NAME_PLACEHOLDER: "태스크 이름을 입력하세요",
  ADD: "추가",
  TASK_NAME_REQUIRED: "태스크 이름을 입력해주세요",
  TASK_ALREADY_EXISTS: "이미 존재하는 태스크입니다",
};

const STYLES = {
  CONTAINER: "min-h-screen bg-gray-50 p-6",
  HEADER: "mb-6 flex items-center justify-between",
  HEADER_LEFT: "flex items-center gap-4",
  BACK_BUTTON: "text-blue-600 hover:text-blue-800 font-semibold transition-colors duration-300",
  TITLE: "text-3xl font-bold text-gray-800",
  ADD_TASK_BUTTON: "px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors duration-300 font-semibold",
  SEARCH_SECTION: "mb-4 flex gap-2",
  SEARCH_INPUT: "flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
  CLEAR_BUTTON: "px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors duration-300",
  MONTH_NAV: "mb-6 flex items-center justify-center gap-4",
  NAV_BUTTON: "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-300",
  MONTH_DISPLAY: "text-2xl font-bold text-gray-800 min-w-[200px] text-center",
  TABLE_CONTAINER: "bg-white rounded-lg shadow-md overflow-x-auto",
  TABLE: "w-full border-collapse",
  TH: "border border-gray-300 px-2 py-3 bg-gray-100 font-semibold text-gray-700 text-center min-w-[40px]",
  TH_TODAY: "border border-gray-300 px-2 py-3 bg-blue-100 font-semibold text-blue-700 text-center min-w-[40px]",
  TH_TASK: "border border-gray-300 px-4 py-3 bg-gray-100 font-semibold text-gray-700 text-left sticky left-0 z-10",
  TD_TASK: "border border-gray-300 px-4 py-3 bg-white font-medium sticky left-0 z-10",
  TD_EMPTY: "border border-gray-300 px-2 py-8 bg-gray-50 text-center cursor-pointer hover:bg-gray-100 transition-colors duration-300",
  TD_CHECKED: "border border-gray-300 px-2 py-8 bg-green-100 text-center cursor-pointer hover:bg-green-200 transition-colors duration-300",
  TD_EMPTY_TODAY: "border border-blue-300 px-2 py-8 bg-blue-100 text-center cursor-pointer hover:bg-blue-200 transition-colors duration-300",
  TD_CHECKED_TODAY: "border border-blue-400 px-2 py-8 bg-green-100 text-center cursor-pointer hover:bg-green-200 transition-colors duration-300 ring-2 ring-blue-300",
  CHECK_MARK: "text-2xl text-green-600",
  MODAL_OVERLAY: "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50",
  MODAL: "bg-white rounded-lg p-6 max-w-md w-full mx-4",
  MODAL_TITLE: "text-xl font-bold text-gray-800 mb-4 text-center",
  MODAL_SEARCH: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4",
  MODAL_INPUT: "w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4",
  EMPLOYEE_LIST: "max-h-[300px] overflow-y-auto border border-gray-300 rounded-lg mb-4",
  EMPLOYEE_ITEM: "px-4 py-3 hover:bg-gray-100 cursor-pointer transition-colors duration-300 border-b border-gray-200 last:border-b-0",
  MODAL_BUTTON: "px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors duration-300",
  DELETE_INFO: "mb-4 space-y-2 text-gray-700",
  DELETE_INFO_LABEL: "font-semibold text-gray-800",
  BUTTON_GROUP: "flex gap-2 justify-center",
  DELETE_BUTTON: "px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-300",
};

// ===== 타입 =====
type TaskCompletion = {
  taskName: string;
  date: string;
  employeeName: string;
};

export default function TasksPage() {
  // ===== State =====
  const [tasks, setTasks] = useState<string[]>(DEFAULT_TASKS);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [taskSearch, setTaskSearch] = useState("");
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ task: string; date: string } | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCompletion, setSelectedCompletion] = useState<TaskCompletion | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");

  // ===== 날짜 계산 =====
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  // ===== 필터링 =====
  const filteredTasks = useMemo(() => {
    if (!taskSearch) return tasks;
    return tasks.filter((task) => matchesKoreanSearch(task, taskSearch));
  }, [taskSearch, tasks]);

  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return EMPLOYEES;
    return EMPLOYEES.filter((emp) => matchesKoreanSearch(emp.name, employeeSearch));
  }, [employeeSearch]);

  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) =>
      a.name.localeCompare(b.name, "ko-KR")
    );
  }, [filteredEmployees]);

  // ===== 핸들러 =====
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleCellClick = (taskName: string, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const existing = completions.find(
      (c) => c.taskName === taskName && c.date === dateStr
    );

    if (existing) {
      setSelectedCompletion(existing);
      setShowDeleteModal(true);
    } else {
      setSelectedCell({ task: taskName, date: dateStr });
      setShowEmployeeModal(true);
      setEmployeeSearch("");
    }
  };

  const handleEmployeeSelect = (employeeName: string) => {
    if (!selectedCell) return;

    const newCompletion: TaskCompletion = {
      taskName: selectedCell.task,
      date: selectedCell.date,
      employeeName,
    };

    setCompletions((prev) => [...prev, newCompletion]);
    setShowEmployeeModal(false);
    setSelectedCell(null);
  };

  const handleDelete = () => {
    if (!selectedCompletion) return;

    setCompletions((prev) =>
      prev.filter(
        (c) =>
          !(
            c.taskName === selectedCompletion.taskName &&
            c.date === selectedCompletion.date
          )
      )
    );

    setShowDeleteModal(false);
    setSelectedCompletion(null);
  };

  const handleAddTask = () => {
    const trimmedName = newTaskName.trim();
    
    if (!trimmedName) {
      alert(MESSAGES.TASK_NAME_REQUIRED);
      return;
    }

    if (tasks.includes(trimmedName)) {
      alert(MESSAGES.TASK_ALREADY_EXISTS);
      return;
    }

    setTasks((prev) => [...prev, trimmedName]);
    setNewTaskName("");
    setShowAddTaskModal(false);
  };

  const isCompleted = (taskName: string, day: number): string | null => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const completion = completions.find(
      (c) => c.taskName === taskName && c.date === dateStr
    );
    return completion ? completion.employeeName : null;
  };

  // ===== 렌더링 =====
  return (
    <div className={STYLES.CONTAINER}>
      {/* Header */}
      <div className={STYLES.HEADER}>
        <div className={STYLES.HEADER_LEFT}>
          <a href="/" className={STYLES.BACK_BUTTON}>
            {MESSAGES.BACK}
          </a>
          <h1 className={STYLES.TITLE}>{MESSAGES.TITLE}</h1>
        </div>
        <button onClick={() => setShowAddTaskModal(true)} className={STYLES.ADD_TASK_BUTTON}>
          {MESSAGES.ADD_TASK}
        </button>
      </div>

      {/* 검색 */}
      <div className={STYLES.SEARCH_SECTION}>
        <input
          type="text"
          placeholder={MESSAGES.SEARCH_TASK}
          value={taskSearch}
          onChange={(e) => setTaskSearch(e.target.value)}
          className={STYLES.SEARCH_INPUT}
        />
        <button onClick={() => setTaskSearch("")} className={STYLES.CLEAR_BUTTON}>
          {MESSAGES.CLEAR}
        </button>
      </div>

      {/* 월 네비게이션 */}
      <div className={STYLES.MONTH_NAV}>
        <button onClick={handlePrevMonth} className={STYLES.NAV_BUTTON}>
          ◀ {MESSAGES.PREV_MONTH}
        </button>
        <div className={STYLES.MONTH_DISPLAY}>
          {year}년 {month + 1}월
        </div>
        <button onClick={handleNextMonth} className={STYLES.NAV_BUTTON}>
          {MESSAGES.NEXT_MONTH} ▶
        </button>
      </div>

      {/* 테이블 */}
      <div className={STYLES.TABLE_CONTAINER}>
        <table className={STYLES.TABLE}>
          <thead>
            <tr>
              <th className={STYLES.TH_TASK}>{MESSAGES.TASK_LABEL}</th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                <th
                  key={day}
                  className={
                    isCurrentMonth && day === todayDate
                      ? STYLES.TH_TODAY
                      : STYLES.TH
                  }
                >
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task) => (
              <tr key={task}>
                <td className={STYLES.TD_TASK}>{task}</td>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const employeeName = isCompleted(task, day);
                  const isTodayCell = isCurrentMonth && day === todayDate;

                  // 오늘 날짜 열 강조
                  let cellStyle = "";
                  if (isTodayCell && employeeName) {
                    cellStyle = STYLES.TD_CHECKED_TODAY;
                  } else if (isTodayCell && !employeeName) {
                    cellStyle = STYLES.TD_EMPTY_TODAY;
                  } else if (employeeName) {
                    cellStyle = STYLES.TD_CHECKED;
                  } else {
                    cellStyle = STYLES.TD_EMPTY;
                  }

                  return (
                    <td
                      key={day}
                      className={cellStyle}
                      onClick={() => handleCellClick(task, day)}
                      title={employeeName || MESSAGES.EMPTY_CELL_TOOLTIP}
                    >
                      {employeeName && <span className={STYLES.CHECK_MARK}>✓</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 직원 선택 모달 */}
      {showEmployeeModal && (
        <div className={STYLES.MODAL_OVERLAY} onClick={() => setShowEmployeeModal(false)}>
          <div className={STYLES.MODAL} onClick={(e) => e.stopPropagation()}>
            <h2 className={STYLES.MODAL_TITLE}>{MESSAGES.SELECT_EMPLOYEE_TITLE}</h2>
            <input
              type="text"
              placeholder={MESSAGES.SEARCH_EMPLOYEE}
              value={employeeSearch}
              onChange={(e) => setEmployeeSearch(e.target.value)}
              className={STYLES.MODAL_SEARCH}
              autoFocus
            />
            <div className={STYLES.EMPLOYEE_LIST}>
              {sortedEmployees.map((emp) => (
                <div
                  key={emp.id}
                  className={STYLES.EMPLOYEE_ITEM}
                  onClick={() => handleEmployeeSelect(emp.name)}
                >
                  {emp.name}
                </div>
              ))}
            </div>
            <div className={STYLES.BUTTON_GROUP}>
              <button
                onClick={() => setShowEmployeeModal(false)}
                className={STYLES.MODAL_BUTTON}
              >
                {MESSAGES.CANCEL}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && selectedCompletion && (
        <div className={STYLES.MODAL_OVERLAY} onClick={() => setShowDeleteModal(false)}>
          <div className={STYLES.MODAL} onClick={(e) => e.stopPropagation()}>
            <h2 className={STYLES.MODAL_TITLE}>{MESSAGES.DELETE_CONFIRM_TITLE}</h2>
            <div className={STYLES.DELETE_INFO}>
              <div>
                <span className={STYLES.DELETE_INFO_LABEL}>{MESSAGES.TASK_LABEL}:</span>{" "}
                {selectedCompletion.taskName}
              </div>
              <div>
                <span className={STYLES.DELETE_INFO_LABEL}>{MESSAGES.EMPLOYEE_LABEL}:</span>{" "}
                {selectedCompletion.employeeName}
              </div>
              <div>
                <span className={STYLES.DELETE_INFO_LABEL}>{MESSAGES.DATE_LABEL}:</span>{" "}
                {new Date(selectedCompletion.date).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            </div>
            <div className={STYLES.BUTTON_GROUP}>
              <button onClick={handleDelete} className={STYLES.DELETE_BUTTON}>
                {MESSAGES.DELETE}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className={STYLES.MODAL_BUTTON}
              >
                {MESSAGES.CANCEL}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 태스크 추가 모달 */}
      {showAddTaskModal && (
        <div className={STYLES.MODAL_OVERLAY} onClick={() => setShowAddTaskModal(false)}>
          <div className={STYLES.MODAL} onClick={(e) => e.stopPropagation()}>
            <h2 className={STYLES.MODAL_TITLE}>{MESSAGES.ADD_TASK_TITLE}</h2>
            <input
              type="text"
              placeholder={MESSAGES.TASK_NAME_PLACEHOLDER}
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
              className={STYLES.MODAL_INPUT}
              autoFocus
            />
            <div className={STYLES.BUTTON_GROUP}>
              <button onClick={handleAddTask} className={STYLES.DELETE_BUTTON}>
                {MESSAGES.ADD}
              </button>
              <button
                onClick={() => {
                  setShowAddTaskModal(false);
                  setNewTaskName("");
                }}
                className={STYLES.MODAL_BUTTON}
              >
                {MESSAGES.CANCEL}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
