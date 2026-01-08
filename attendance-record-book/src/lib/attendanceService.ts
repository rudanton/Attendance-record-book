import { db } from '@/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
  orderBy,
  limit,
  Timestamp,
  Query,
  DocumentData,
} from 'firebase/firestore';
import { Attendance } from './types';
import { isValid, startOfMinute } from 'date-fns';

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Calculates regular, night, and total work minutes from check-in, check-out, and breaks.
 * Night hours are considered from 22:00 to 05:00.
 * @param checkIn The check-in timestamp.
 * @param checkOut The check-out timestamp (can be null if still working).
 * @param breaks An array of break records.
 * @returns An object with regular, night, and total work minutes.
 */
function calculateWorkMinutes(
  checkIn: Timestamp | undefined,
  checkOut: Timestamp | null | undefined,
  breaks: Attendance['breaks']
): { regularWorkMinutes: number; nightWorkMinutes: number; totalWorkMinutes: number } {
  if (!checkIn || !checkOut) return { regularWorkMinutes: 0, nightWorkMinutes: 0, totalWorkMinutes: 0 };

  const checkInDate = checkIn.toDate();
  const checkOutDate = checkOut.toDate();

  if (!isValid(checkInDate) || !isValid(checkOutDate)) return { regularWorkMinutes: 0, nightWorkMinutes: 0, totalWorkMinutes: 0 };

  let regularMinutes = 0;
  let nightMinutes = 0;

  let currentMinute = startOfMinute(checkInDate);

  while (currentMinute < checkOutDate) {
    const nextMinute = new Date(currentMinute.getTime() + 60000);

    const isBreak = breaks.some(_break => {
      if (!_break.start || !_break.end) return false;
      const breakStart = _break.start.toDate();
      const breakEnd = _break.end.toDate();
      return currentMinute >= breakStart && currentMinute < breakEnd;
    });

    if (!isBreak) {
      const hour = currentMinute.getHours();
      // Night hours are 22, 23, 0, 1, 2, 3, 4
      if (hour >= 22 || hour < 5) {
        nightMinutes++;
      } else {
        regularMinutes++;
      }
    }
    currentMinute = nextMinute;
  }

  return {
    regularWorkMinutes: regularMinutes,
    nightWorkMinutes: nightMinutes,
    totalWorkMinutes: regularMinutes + nightMinutes,
  };
}


/**
 * Finds the most recent, open (not clocked-out) attendance record for a user.
 * @param userId The ID of the user.
 * @returns Promise<string | null> The document ID of the open attendance record, or null if none exists.
 */
async function getOpenAttendanceRecordId(userId: string): Promise<string | null> {
  const attendanceCol = collection(db, 'attendance');
  const q = query(
    attendanceCol,
    where('userId', '==', userId),
    where('checkOut', '==', null),
    orderBy('checkIn', 'desc'),
    limit(1)
  );

  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return querySnapshot.docs[0].id;
  }
  return null;
}

/**
 * Clocks in a user, creating a new attendance record.
 * @param userId The ID of the user clocking in.
 * @param userName The name of the user for denormalization.
 * @returns Promise<void>
 * @throws Will throw an error if the user is already clocked in (has an open session).
 */
export async function clockIn(userId: string, userName: string): Promise<void> {
  const openAttendanceId = await getOpenAttendanceRecordId(userId);

  if (openAttendanceId) {
    throw new Error('User is already clocked in. Cannot start a new session.');
  }

  const attendanceCol = collection(db, 'attendance');
  await addDoc(attendanceCol, {
    userId,
    userName,
    date: getTodayDateString(), // The date the shift *started*
    checkIn: serverTimestamp(),
    checkOut: null,
    breaks: [],
    isModified: false,
    regularWorkMinutes: 0,
    nightWorkMinutes: 0,
    totalWorkMinutes: 0,
  });
}

/**
 * Clocks out a user, closing their most recent open session and calculating total work minutes.
 * @param userId The ID of the user clocking out.
 * @returns Promise<void>
 * @throws Will throw an error if the user has no open session to clock out from.
 */
export async function clockOut(userId: string): Promise<void> {
  const openAttendanceId = await getOpenAttendanceRecordId(userId);

  if (!openAttendanceId) {
    throw new Error('User is not clocked in. Cannot clock out.');
  }

  const attendanceDocRef = doc(db, 'attendance', openAttendanceId);
  const checkOutTime = Timestamp.now(); // Use a consistent timestamp

  // Get the record to calculate totalWorkMinutes
  const docSnap = await getDoc(attendanceDocRef);
  if (!docSnap.exists()) {
    throw new Error("Clock-in record not found while trying to clock out.");
  }
  const record = docSnap.data() as Attendance;
  
  // Ensure any open break is closed before clocking out
  const openBreakIndex = record.breaks.findIndex(_break => _break.end === null);
  if (openBreakIndex !== -1) {
    record.breaks[openBreakIndex].end = checkOutTime;
  }

  const workMinutes = calculateWorkMinutes(record.checkIn, checkOutTime, record.breaks);

  await updateDoc(attendanceDocRef, {
    checkOut: checkOutTime,
    breaks: record.breaks, // Save the potentially updated breaks array
    ...workMinutes,
  });
}

/**
 * Starts a break for a user.
 * @param userId The ID of the user starting a break.
 * @returns Promise<void>
 * @throws Will throw an error if the user is not clocked in or is already on a break.
 */
export async function startBreak(userId: string): Promise<void> {
  const openAttendanceId = await getOpenAttendanceRecordId(userId);

  if (!openAttendanceId) {
    throw new Error('User is not clocked in. Cannot start a break.');
  }

  const attendanceDocRef = doc(db, 'attendance', openAttendanceId);
  const docSnap = await getDoc(attendanceDocRef);

  if (!docSnap.exists()) {
    throw new Error('Attendance record not found.');
  }

  const record = docSnap.data() as Attendance;
  const openBreak = record.breaks.find(_break => _break.end === null);

  if (openBreak) {
    throw new Error('User is already on a break.');
  }

  const newBreaks = [...record.breaks, { start: Timestamp.now(), end: null }];

  await updateDoc(attendanceDocRef, {
    breaks: newBreaks,
  });
}

/**
 * Ends a break for a user.
 * @param userId The ID of the user ending a break.
 * @returns Promise<void>
 * @throws Will throw an error if the user is not clocked in or not on a break.
 */
export async function endBreak(userId: string): Promise<void> {
  const openAttendanceId = await getOpenAttendanceRecordId(userId);

  if (!openAttendanceId) {
    throw new Error('User is not clocked in. Cannot end a break.');
  }

  const attendanceDocRef = doc(db, 'attendance', openAttendanceId);
  const docSnap = await getDoc(attendanceDocRef);

  if (!docSnap.exists()) {
    throw new Error('Attendance record not found.');
  }

  const record = docSnap.data() as Attendance;
  const openBreakIndex = record.breaks.findIndex(_break => _break.end === null);

  if (openBreakIndex === -1) {
    throw new Error('User is not on a break.');
  }

  const updatedBreaks = [...record.breaks];
  updatedBreaks[openBreakIndex].end = Timestamp.now();

  await updateDoc(attendanceDocRef, {
    breaks: updatedBreaks,
  });
}

/**
 * Updates an existing attendance record.
 * @param recordId The ID of the attendance record to update.
 * @param updatedFields An object containing the fields to update.
 * @returns Promise<void>
 */
export async function updateAttendanceRecord(recordId: string, updatedFields: Partial<Attendance>): Promise<void> {
  try {
    const attendanceDocRef = doc(db, 'attendance', recordId);

    const docSnap = await getDoc(attendanceDocRef);
    if (!docSnap.exists()) {
      throw new Error('Attendance record not found.');
    }
    const currentRecord = docSnap.data() as Attendance;

    const newCheckIn = updatedFields.checkIn || currentRecord.checkIn;
    const newCheckOut = updatedFields.checkOut || currentRecord.checkOut;
    const newBreaks = updatedFields.breaks || currentRecord.breaks;

    let workMinutes = {
      regularWorkMinutes: currentRecord.regularWorkMinutes,
      nightWorkMinutes: currentRecord.nightWorkMinutes,
      totalWorkMinutes: currentRecord.totalWorkMinutes,
    };

    if (updatedFields.checkIn || updatedFields.checkOut || updatedFields.breaks) {
      const calculatedCheckIn = newCheckIn instanceof Timestamp ? newCheckIn : Timestamp.fromDate(newCheckIn as Date);
      const calculatedCheckOut = newCheckOut instanceof Timestamp ? newCheckOut : (newCheckOut ? Timestamp.fromDate(newCheckOut as Date) : null);

      workMinutes = calculateWorkMinutes(calculatedCheckIn, calculatedCheckOut, newBreaks);
    }

    await updateDoc(attendanceDocRef, {
      ...updatedFields,
      ...workMinutes,
      isModified: true,
    });
  } catch (error) {
    console.error("Error updating attendance record: ", error);
    throw new Error("Failed to update attendance record.");
  }
}

/**
 * Manually adds a new attendance record for a user.
 * @param newRecordData Object containing userId, userName, date (YYYY-MM-DD), checkIn (Date), checkOut (Date or null).
 * @returns Promise<void>
 */
export async function addAttendanceRecord(newRecordData: {
  userId: string;
  userName: string;
  date: string;
  checkIn: Date;
  checkOut: Date | null;
  breaks?: Attendance['breaks'];
}): Promise<void> {
  const { userId, userName, date, checkIn, checkOut, breaks = [] } = newRecordData;

  if (!checkIn) {
    throw new Error('출근 시간은 필수입니다.');
  }

  const checkInTimestamp = Timestamp.fromDate(checkIn);
  const checkOutTimestamp = checkOut ? Timestamp.fromDate(checkOut) : null;

  const workMinutes = calculateWorkMinutes(checkInTimestamp, checkOutTimestamp, breaks);

  try {
    const attendanceCol = collection(db, 'attendance');
    await addDoc(attendanceCol, {
      userId,
      userName,
      date,
      checkIn: checkInTimestamp,
      checkOut: checkOutTimestamp,
      breaks,
      isModified: true,
      ...workMinutes,
    });
  } catch (error) {
    console.error("Error adding attendance record: ", error);
    throw new Error("Failed to add attendance record.");
  }
}


/**
 * Fetches all attendance records relevant for the dashboard view.
 * @returns Promise<Attendance[]> An array of relevant attendance records, one per user.
 */
export async function getRelevantAttendanceRecordsForDashboard(): Promise<Attendance[]> {
  try {
    const todayStr = getTodayDateString();
    const attendanceCol = collection(db, 'attendance');

    const qTodayStarted = query(attendanceCol, where('date', '==', todayStr));
    const todayStartedSnapshot = await getDocs(qTodayStarted);

    const qOpenSessions = query(attendanceCol, where('checkOut', '==', null));
    const openSessionsSnapshot = await getDocs(qOpenSessions);

    const allRelevantRecords: Attendance[] = [];
    todayStartedSnapshot.forEach(doc => allRelevantRecords.push({ id: doc.id, ...doc.data() } as Attendance));
    openSessionsSnapshot.forEach(doc => allRelevantRecords.push({ id: doc.id, ...doc.data() } as Attendance));

    const consolidatedRecords = new Map<string, Attendance>();
    allRelevantRecords.forEach(record => {
      const existing = consolidatedRecords.get(record.userId);
      if (!existing || record.checkIn.toMillis() > existing.checkIn.toMillis()) {
        consolidatedRecords.set(record.userId, record);
      }
    });

    return Array.from(consolidatedRecords.values());
  } catch (error) {
    console.error("Error fetching relevant attendance records for dashboard: ", error);
    throw new Error("Failed to fetch relevant attendance records for dashboard.");
  }
}

/**
 * Fetches monthly attendance records for a specific user.
 * @param userId The ID of the user.
 * @param year The year for which to fetch records.
 * @param month The month for which to fetch records (1-12).
 * @returns Promise<Attendance[]> An array of attendance records for the specified month.
 */
export async function getMonthlyAttendance(userId: string, year: number, month: number): Promise<Attendance[]> {
  try {
    const attendanceCol = collection(db, 'attendance');
    const startOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const q = query(
      attendanceCol,
      where('userId', '==', userId),
      where('date', '>=', startOfMonthStr),
      where('date', '<=', endOfMonthStr),
      orderBy('date', 'asc'),
      orderBy('checkIn', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const monthlyAttendance: Attendance[] = [];
    querySnapshot.forEach((doc) => {
      monthlyAttendance.push({ id: doc.id, ...doc.data() } as Attendance);
    });

    return monthlyAttendance;
  } catch (error) {
    console.error("Error fetching monthly attendance: ", error);
    throw new Error("Failed to fetch monthly attendance.");
  }
}

/**
 * Fetches all attendance records from the collection.
 * @returns Promise<Attendance[]> An array of all attendance records.
 */
export async function getAllAttendanceRecords(): Promise<Attendance[]> {
  try {
    const attendanceCol = collection(db, 'attendance');
    const q = query(attendanceCol, orderBy('date', 'desc'), orderBy('checkIn', 'desc'));
    const querySnapshot = await getDocs(q);
    
    const allRecords: Attendance[] = [];
    querySnapshot.forEach((doc) => {
      allRecords.push({ id: doc.id, ...doc.data() } as Attendance);
    });

    return allRecords;
  } catch (error) {
    console.error("Error fetching all attendance records: ", error);
    throw new Error("Failed to fetch all attendance records.");
  }
}

/**
 * Aggregates attendance data for a given period and optionally for a specific user.
 * @param userId Optional. The ID of the user to filter by.
 * @param startDateStr The start date of the period (YYYY-MM-DD).
 * @param endDateStr The end date of the period (YYYY-MM-DD).
 * @returns Aggregated data per user including regular, night, and total minutes.
 */
export async function getAggregatedAttendance(
  userId: string | null,
  startDateStr: string,
  endDateStr: string
): Promise<Map<string, { userName: string; regularWorkMinutes: number; nightWorkMinutes: number; totalWorkMinutes: number }>> {
  try {
    const attendanceCol = collection(db, 'attendance');
    let q: Query<DocumentData> = query(
      attendanceCol,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr),
      orderBy('date', 'asc')
    );

    if (userId) {
      q = query(q, where('userId', '==', userId));
    }

    const querySnapshot = await getDocs(q);
    const aggregatedData = new Map<string, { userName: string; regularWorkMinutes: number; nightWorkMinutes: number; totalWorkMinutes: number }>();

    querySnapshot.forEach((docSnap) => {
      const record = docSnap.data() as Attendance;
      const current = aggregatedData.get(record.userId) || {
        userName: record.userName,
        regularWorkMinutes: 0,
        nightWorkMinutes: 0,
        totalWorkMinutes: 0,
      };
      current.regularWorkMinutes += record.regularWorkMinutes || 0;
      current.nightWorkMinutes += record.nightWorkMinutes || 0;
      current.totalWorkMinutes += record.totalWorkMinutes || 0;
      aggregatedData.set(record.userId, current);
    });

    return aggregatedData;
  } catch (error) {
    console.error("Error fetching aggregated attendance: ", error);
    throw new Error("Failed to fetch aggregated attendance.");
  }
}

