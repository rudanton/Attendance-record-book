import { db } from '@/firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  getDoc, // Add getDoc
  serverTimestamp,
  orderBy,
  limit,
  Timestamp, // Import Timestamp from firebase/firestore
  Query, // Add Query
  DocumentData, // Add DocumentData
} from 'firebase/firestore';
import { Attendance } from './types';
import { differenceInSeconds, isValid } from 'date-fns'; // Import date-fns functions

function getTodayDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper function to calculate total work minutes from check-in, check-out, and breaks.
 * @param checkIn The check-in timestamp.
 * @param checkOut The check-out timestamp (can be null if still working).
 * @param breaks An array of break records.
 * @returns The total work minutes, or 0 if calculation is not possible.
 */
function calculateTotalWorkMinutes(checkIn: Timestamp | undefined, checkOut: Timestamp | null | undefined, breaks: Attendance['breaks']): number {
  if (!checkIn || !checkOut) return 0;

  const checkInDate = checkIn.toDate();
  const checkOutDate = checkOut.toDate();

  if (!isValid(checkInDate) || !isValid(checkOutDate)) return 0;

  let totalSeconds = differenceInSeconds(checkOutDate, checkInDate);

  // Subtract break seconds
  breaks.forEach(_break => {
    if (_break.start && _break.end) {
      const breakStartDate = _break.start.toDate();
      const breakEndDate = _break.end.toDate();
      if (isValid(breakStartDate) && isValid(breakEndDate)) {
        totalSeconds -= differenceInSeconds(breakEndDate, breakStartDate);
      }
    }
  });

  const totalMinutes = Math.floor(totalSeconds / 60);
  return totalMinutes > 0 ? totalMinutes : 0; // Ensure non-negative total
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

  const totalMinutes = calculateTotalWorkMinutes(record.checkIn, checkOutTime, record.breaks);

  await updateDoc(attendanceDocRef, {
    checkOut: checkOutTime,
    totalWorkMinutes: totalMinutes,
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

    // Fetch current record to re-calculate totalWorkMinutes if needed
    const docSnap = await getDoc(attendanceDocRef);
    if (!docSnap.exists()) {
      throw new Error('Attendance record not found.');
    }
    const currentRecord = docSnap.data() as Attendance;

    // Use updated fields or current record's values
    const newCheckIn = updatedFields.checkIn || currentRecord.checkIn;
    const newCheckOut = updatedFields.checkOut || currentRecord.checkOut;
    const newBreaks = updatedFields.breaks || currentRecord.breaks;

    let newTotalWorkMinutes = currentRecord.totalWorkMinutes;

    // Recalculate totalWorkMinutes if relevant fields are updated
    if (updatedFields.checkIn || updatedFields.checkOut || updatedFields.breaks) {
      // Ensure Timestamp objects are used for calculation
      // If the updatedFields have checkIn/Out as Date, convert them to Timestamp
      const calculatedCheckIn = newCheckIn instanceof Timestamp ? newCheckIn : Timestamp.fromDate(newCheckIn as Date);
      const calculatedCheckOut = newCheckOut instanceof Timestamp ? newCheckOut : (newCheckOut ? Timestamp.fromDate(newCheckOut as Date) : null);

      newTotalWorkMinutes = calculateTotalWorkMinutes(calculatedCheckIn, calculatedCheckOut, newBreaks);
    }

    await updateDoc(attendanceDocRef, {
      ...updatedFields,
      totalWorkMinutes: newTotalWorkMinutes,
      isModified: true, // Mark as modified by admin
    });
  } catch (error) {
    console.error("Error updating attendance record: ", error);
    throw new Error("Failed to update attendance record.");
  }
}

/**
 * Manually adds a new attendance record for a user.
 * This is primarily for admin use to correct or add missed entries.
 * @param newRecordData Object containing userId, userName, date (YYYY-MM-DD), checkIn (Date), checkOut (Date or null).
 * @returns Promise<void>
 * @throws Will throw an error if checkIn is missing or invalid.
 */
export async function addAttendanceRecord(newRecordData: {
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
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

  const totalWorkMinutes = calculateTotalWorkMinutes(checkInTimestamp, checkOutTimestamp, breaks);

  try {
    const attendanceCol = collection(db, 'attendance');
    await addDoc(attendanceCol, {
      userId,
      userName,
      date,
      checkIn: checkInTimestamp,
      checkOut: checkOutTimestamp,
      breaks,
      isModified: true, // Manually added records are considered modified by admin
      totalWorkMinutes,
    });
  } catch (error) {
    console.error("Error adding attendance record: ", error);
    throw new Error("Failed to add attendance record.");
  }
}


/**
 * Fetches all attendance records relevant for the dashboard view.
 * This includes shifts that started today AND currently open shifts (overnight).
 * For each user, it returns the most recent relevant shift.
 * @returns Promise<Attendance[]> An array of relevant attendance records, one per user.
 */
export async function getRelevantAttendanceRecordsForDashboard(): Promise<Attendance[]> {
  try {
    const todayStr = getTodayDateString();
    const attendanceCol = collection(db, 'attendance');

    // Query 1: Shifts that started today (date field is today's date)
    const qTodayStarted = query(attendanceCol, where('date', '==', todayStr));
    const todayStartedSnapshot = await getDocs(qTodayStarted);

    // Query 2: Currently open shifts (checkOut is null)
    const qOpenSessions = query(attendanceCol, where('checkOut', '==', null));
    const openSessionsSnapshot = await getDocs(qOpenSessions);

    const allRelevantRecords: Attendance[] = [];

    todayStartedSnapshot.forEach(doc => allRelevantRecords.push({ id: doc.id, ...doc.data() } as Attendance));
    openSessionsSnapshot.forEach(doc => allRelevantRecords.push({ id: doc.id, ...doc.data() } as Attendance));

    // Consolidate records by userId, taking the most recent one if multiple exist
    const consolidatedRecords = new Map<string, Attendance>();
    allRelevantRecords.forEach(record => {
      const existing = consolidatedRecords.get(record.userId);
      // If no record exists for this user, or if the current record is more recent, add/replace it
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
 * @param year The year for which to fetch records (e.g., 2026).
 * @param month The month for which to fetch records (1-12).
 * @returns Promise<Attendance[]> An array of attendance records for the specified month.
 */
export async function getMonthlyAttendance(userId: string, year: number, month: number): Promise<Attendance[]> {
  try {
    const attendanceCol = collection(db, 'attendance');

    // Calculate start and end date strings for the month
    const startDate = new Date(year, month - 1, 1); // Month is 0-indexed in Date object
    const endDate = new Date(year, month, 0); // Last day of the month
    
    const startOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const q = query(
      attendanceCol,
      where('userId', '==', userId),
      where('date', '>=', startOfMonthStr),
      where('date', '<=', endOfMonthStr),
      orderBy('date', 'asc'), // Order by date for chronological display
      orderBy('checkIn', 'asc') // Then by checkIn time
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
    const q = query(attendanceCol, orderBy('date', 'desc'), orderBy('checkIn', 'desc')); // Order by date then checkIn for chronological view
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
 * @returns Promise<Map<string, { userName: string, totalWorkMinutes: number }>> Aggregated data per user.
 */
export async function getAggregatedAttendance(
  userId: string | null,
  startDateStr: string,
  endDateStr: string
): Promise<Map<string, { userName: string; totalWorkMinutes: number }>> {
  try {
    const attendanceCol = collection(db, 'attendance');
    let q: Query<DocumentData> = query(
      attendanceCol,
      where('date', '>=', startDateStr),
      where('date', '<=', endDateStr),
      orderBy('date', 'asc') // Need this for range queries
    );

    if (userId) {
      q = query(q, where('userId', '==', userId));
    }

    const querySnapshot = await getDocs(q);
    const aggregatedData = new Map<string, { userName: string; totalWorkMinutes: number }>();

    querySnapshot.forEach((docSnap) => {
      const record = docSnap.data() as Attendance;
      const current = aggregatedData.get(record.userId) || { userName: record.userName, totalWorkMinutes: 0 };
      current.totalWorkMinutes += record.totalWorkMinutes;
      aggregatedData.set(record.userId, current);
    });

    return aggregatedData;
  } catch (error) {
    console.error("Error fetching aggregated attendance: ", error);
    throw new Error("Failed to fetch aggregated attendance.");
  }
}

