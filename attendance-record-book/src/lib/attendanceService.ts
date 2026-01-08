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
      // Use UTC hours so calculations stay consistent across server/timezone differences.
      const hour = currentMinute.getUTCHours();
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

// Expose internal helpers for testing
export const __testables = {
  calculateWorkMinutes,
};


/**
 * Finds the most recent, open (not clocked-out) attendance record for a user within a specific branch.
 * @param branchId The ID of the branch.
 * @param userId The ID of the user.
 * @returns Promise<string | null> The document ID of the open attendance record, or null if none exists.
 */
async function getOpenAttendanceRecordId(branchId: string, userId: string): Promise<string | null> {
  const attendanceCol = collection(db, 'attendance');
  const q = query(
    attendanceCol,
    where('branchId', '==', branchId), // Filter by branchId
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
 * Clocks in a user, creating a new attendance record for a specific branch.
 * @param branchId The ID of the branch.
 * @param userId The ID of the user clocking in.
 * @param userName The name of the user for denormalization.
 * @returns Promise<void>
 * @throws Will throw an error if the user is already clocked in (has an open session).
 */
export async function clockIn(branchId: string, userId: string, userName: string): Promise<void> {
  const openAttendanceId = await getOpenAttendanceRecordId(branchId, userId);

  if (openAttendanceId) {
    throw new Error('User is already clocked in. Cannot start a new session.');
  }

  const attendanceCol = collection(db, 'attendance');
  await addDoc(attendanceCol, {
    branchId, // Add branchId here
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
 * Clocks out a user, closing their most recent open session and calculating total work minutes for a specific branch.
 * If total work (excluding breaks) would exceed 8 hours, automatically extends break time to ensure legal compliance.
 * @param branchId The ID of the branch.
 * @param userId The ID of the user clocking out.
 * @returns Promise<void>
 * @throws Will throw an error if the user has no open session to clock out from.
 */
/**
 * Clocks out a user, closing their most recent open session and calculating total work minutes for a specific branch.
 * For shifts 8+ hours: ensures minimum 1 hour break time (Korean labor law requirement).
 * For shifts under 8 hours: keeps actual break time as-is.
 * @param branchId The ID of the branch.
 * @param userId The ID of the user clocking out.
 * @returns Promise<void>
 * @throws Will throw an error if the user has no open session to clock out from.
 */
export async function clockOut(branchId: string, userId: string): Promise<void> {
  const openAttendanceId = await getOpenAttendanceRecordId(branchId, userId);

  if (!openAttendanceId) {
    throw new Error('User is not clocked in. Cannot clock out.');
  }

  const attendanceDocRef = doc(db, 'attendance', openAttendanceId);
  let checkOutTime = Timestamp.now(); // Current checkout time

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

  // Calculate current break minutes
  let totalBreakMinutes = 0;
  record.breaks.forEach(_break => {
    if (_break.start && _break.end) {
      totalBreakMinutes += Math.floor(((_break.end.toDate().getTime() - _break.start.toDate().getTime()) / 60000));
    }
  });

  // Calculate total work time (elapsed time - break time)
  const checkInDate = record.checkIn.toDate();
  const totalElapsedMinutes = Math.floor((checkOutTime.toDate().getTime() - checkInDate.getTime()) / 60000);
  const totalWorkMinutes = totalElapsedMinutes - totalBreakMinutes;

  // If total work time is 8+ hours, ensure minimum 1 hour break
  const minBreakMinutes = 60;
  if (totalWorkMinutes >= 8 * 60) { // 8 hours = 480 minutes
    if (totalBreakMinutes < minBreakMinutes) {
      // Extend break time to at least 1 hour by extending checkout time
      const additionalBreakNeeded = minBreakMinutes - totalBreakMinutes;
      const originalCheckOutDate = checkOutTime.toDate();
      const extendedCheckOutDate = new Date(originalCheckOutDate.getTime() + additionalBreakNeeded * 60000);
      checkOutTime = Timestamp.fromDate(extendedCheckOutDate);
      
      // Add a synthetic break for the additional time
      record.breaks.push({
        start: Timestamp.fromDate(originalCheckOutDate),
        end: checkOutTime,
      });
    }
  }

  const workMinutes = calculateWorkMinutes(record.checkIn, checkOutTime, record.breaks);

  await updateDoc(attendanceDocRef, {
    checkOut: checkOutTime,
    breaks: record.breaks,
    ...workMinutes,
  });
}

/**
 * Starts a break for a user within a specific branch.
 * @param branchId The ID of the branch.
 * @param userId The ID of the user starting a break.
 * @returns Promise<void>
 * @throws Will throw an error if the user is not clocked in or is already on a break.
 */
export async function startBreak(branchId: string, userId: string): Promise<void> {
  const openAttendanceId = await getOpenAttendanceRecordId(branchId, userId);

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
 * Ends a break for a user within a specific branch.
 * @param branchId The ID of the branch.
 * @param userId The ID of the user ending a break.
 * @returns Promise<void>
 * @throws Will throw an error if the user is not clocked in or not on a break.
 */
export async function endBreak(branchId: string, userId: string): Promise<void> {
  const openAttendanceId = await getOpenAttendanceRecordId(branchId, userId);

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
 * Updates an existing attendance record for a specific branch.
 * @param branchId The ID of the branch.
 * @param recordId The ID of the attendance record to update.
 * @param updatedFields An object containing the fields to update.
 * @returns Promise<void>
 */
export async function updateAttendanceRecord(branchId: string, recordId: string, updatedFields: Partial<Attendance>): Promise<void> {
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
      let calculatedCheckOut = newCheckOut instanceof Timestamp ? newCheckOut : (newCheckOut ? Timestamp.fromDate(newCheckOut as Date) : null);
      let finalBreaks = [...newBreaks];

      // If checkout exists and work is 8+ hours, ensure minimum 1 hour break
      if (calculatedCheckOut) {
        // Calculate current break minutes
        let totalBreakMinutes = 0;
        finalBreaks.forEach(_break => {
          if (_break.start && _break.end) {
            totalBreakMinutes += Math.floor(((_break.end.toDate().getTime() - _break.start.toDate().getTime()) / 60000));
          }
        });

        // Calculate total work time (elapsed time - break time)
        const totalElapsedMinutes = Math.floor((calculatedCheckOut.toDate().getTime() - calculatedCheckIn.toDate().getTime()) / 60000);
        const totalWorkMinutes = totalElapsedMinutes - totalBreakMinutes;

        // If total work time is 8+ hours, ensure minimum 1 hour break
        const minBreakMinutes = 60;
        if (totalWorkMinutes >= 8 * 60) {
          if (totalBreakMinutes < minBreakMinutes) {
            // Extend checkout time to ensure 1 hour break
            const additionalBreakNeeded = minBreakMinutes - totalBreakMinutes;
            const originalCheckOutDate = calculatedCheckOut.toDate();
            const extendedCheckOutDate = new Date(originalCheckOutDate.getTime() + additionalBreakNeeded * 60000);
            calculatedCheckOut = Timestamp.fromDate(extendedCheckOutDate);
            
            // Add a synthetic break for the additional time
            finalBreaks.push({
              start: Timestamp.fromDate(originalCheckOutDate),
              end: calculatedCheckOut,
            });
            
            // Update the updatedFields with new checkout and breaks
            updatedFields.checkOut = calculatedCheckOut;
            updatedFields.breaks = finalBreaks;
          }
        }
      }

      workMinutes = calculateWorkMinutes(calculatedCheckIn, calculatedCheckOut, finalBreaks);
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
 * Manually adds a new attendance record for a user within a specific branch.
 * @param branchId The ID of the branch.
 * @param newRecordData Object containing userId, userName, date (YYYY-MM-DD), checkIn (Date), checkOut (Date or null).
 * @returns Promise<void>
 */
export async function addAttendanceRecord(branchId: string, newRecordData: {
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
  let checkOutTimestamp = checkOut ? Timestamp.fromDate(checkOut) : null;
  let finalBreaks = [...breaks];

  // If checkout exists and work is 8+ hours, ensure minimum 1 hour break
  if (checkOutTimestamp) {
    // Calculate current break minutes
    let totalBreakMinutes = 0;
    finalBreaks.forEach(_break => {
      if (_break.start && _break.end) {
        totalBreakMinutes += Math.floor(((_break.end.toDate().getTime() - _break.start.toDate().getTime()) / 60000));
      }
    });

    // Calculate total work time (elapsed time - break time)
    const totalElapsedMinutes = Math.floor((checkOutTimestamp.toDate().getTime() - checkInTimestamp.toDate().getTime()) / 60000);
    const totalWorkMinutes = totalElapsedMinutes - totalBreakMinutes;

    // If total work time is 8+ hours, ensure minimum 1 hour break
    const minBreakMinutes = 60;
    if (totalWorkMinutes >= 8 * 60) {
      if (totalBreakMinutes < minBreakMinutes) {
        // Extend checkout time to ensure 1 hour break
        const additionalBreakNeeded = minBreakMinutes - totalBreakMinutes;
        const originalCheckOutDate = checkOutTimestamp.toDate();
        const extendedCheckOutDate = new Date(originalCheckOutDate.getTime() + additionalBreakNeeded * 60000);
        checkOutTimestamp = Timestamp.fromDate(extendedCheckOutDate);
        
        // Add a synthetic break for the additional time
        finalBreaks.push({
          start: Timestamp.fromDate(originalCheckOutDate),
          end: checkOutTimestamp,
        });
      }
    }
  }

  const workMinutes = calculateWorkMinutes(checkInTimestamp, checkOutTimestamp, finalBreaks);

  try {
    const attendanceCol = collection(db, 'attendance');
    await addDoc(attendanceCol, {
      branchId,
      userId,
      userName,
      date,
      checkIn: checkInTimestamp,
      checkOut: checkOutTimestamp,
      breaks: finalBreaks,
      isModified: true,
      ...workMinutes,
    });
  } catch (error) {
    console.error("Error adding attendance record: ", error);
    throw new Error("Failed to add attendance record.");
  }
}


/**
 * Fetches all attendance records relevant for the dashboard view for a specific branch.
 * @param branchId The ID of the branch.
 * @returns Promise<Attendance[]> An array of relevant attendance records, one per user.
 */
export async function getRelevantAttendanceRecordsForDashboard(branchId: string): Promise<Attendance[]> {
  try {
    const todayStr = getTodayDateString();
    const attendanceCol = collection(db, 'attendance');

    const qTodayStarted = query(attendanceCol, where('branchId', '==', branchId), where('date', '==', todayStr));
    const todayStartedSnapshot = await getDocs(qTodayStarted);

    const qOpenSessions = query(attendanceCol, where('branchId', '==', branchId), where('checkOut', '==', null));
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
 * Fetches monthly attendance records for a specific user and branch.
 * @param branchId The ID of the branch.
 * @param userId The ID of the user.
 * @param year The year for which to fetch records.
 * @param month The month for which to fetch records (1-12).
 * @returns Promise<Attendance[]> An array of attendance records for the specified month.
 */
export async function getMonthlyAttendance(branchId: string, userId: string, year: number, month: number): Promise<Attendance[]> {
  try {
    const attendanceCol = collection(db, 'attendance');
    const startOfMonthStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonthStr = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

    const q = query(
      attendanceCol,
      where('branchId', '==', branchId), // Filter by branchId
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
 * Fetches all attendance records from the collection for a specific branch.
 * @param branchId The ID of the branch.
 * @returns Promise<Attendance[]> An array of all attendance records.
 */
export async function getAllAttendanceRecords(branchId: string): Promise<Attendance[]> {
  try {
    const attendanceCol = collection(db, 'attendance');
    const q = query(attendanceCol, where('branchId', '==', branchId), orderBy('date', 'desc'), orderBy('checkIn', 'desc'));
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
 * Aggregates attendance data for a given period and optionally for a specific user and branch.
 * @param branchId The ID of the branch.
 * @param userId Optional. The ID of the user to filter by.
 * @param startDateStr The start date of the period (YYYY-MM-DD).
 * @param endDateStr The end date of the period (YYYY-MM-DD).
 * @returns Aggregated data per user including regular, night, and total minutes.
 */
export async function getAggregatedAttendance(
  branchId: string,
  userId: string | null,
  startDateStr: string,
  endDateStr: string
): Promise<Map<string, { userName: string; regularWorkMinutes: number; nightWorkMinutes: number; totalWorkMinutes: number }>> {
  try {
    const attendanceCol = collection(db, 'attendance');
    let q: Query<DocumentData> = query(
      attendanceCol,
      where('branchId', '==', branchId), // Filter by branchId
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

