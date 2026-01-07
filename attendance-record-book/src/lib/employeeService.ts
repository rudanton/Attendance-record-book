// src/lib/employeeService.ts
import { db } from '@/firebase/config'; // Placeholder for Firebase Firestore instance
import { collection, addDoc, updateDoc, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { User } from './types';

// Assuming db is properly initialized and exported from '@/firebase/config'

/**
 * Adds a new employee to the 'users' collection with isActive set to true.
 * @param employeeData Partial User object containing name, pin, role, hourlyRate.
 * @returns Promise<User> The added user with generated UID and joinedAt timestamp.
 */
export async function addEmployee(employeeData: Omit<User, 'uid' | 'isActive' | 'joinedAt'>): Promise<User> {
  const minWage = parseFloat(process.env.NEXT_PUBLIC_MINIMUM_WAGE || '0');
  if (employeeData.hourlyRate < minWage) {
    throw new Error(`시급은 최저시급(${minWage.toLocaleString()}원) 이상이어야 합니다.`);
  }

  try {
    const newUser: Omit<User, 'uid'> = {
      ...employeeData,
      isActive: true,
      joinedAt: Timestamp.now(),
    };
    const usersCollectionRef = collection(db, 'users');
    const docRef = await addDoc(usersCollectionRef, newUser);

    const createdUser: User = {
      uid: docRef.id,
      ...newUser
    };

    // Update the document to include the UID as the document ID
    await updateDoc(doc(db, 'users', docRef.id), { uid: docRef.id });

    return createdUser;
  } catch (error) {
    console.error("Error adding employee: ", error);
    // Re-throw specific validation error
    if (error instanceof Error && error.message.includes('시급')) {
      throw error;
    }
    throw new Error("Failed to add employee.");
  }
}

/**
 * Performs a soft delete on an employee by setting their isActive status to false.
 * @param uid The unique ID of the employee to "delete".
 * @returns Promise<void>
 */
export async function deleteEmployee(uid: string): Promise<void> {
  try {
    const employeeRef = doc(db, 'users', uid);
    await updateDoc(employeeRef, {
      isActive: false
    });
  } catch (error) {
    console.error("Error soft deleting employee: ", error);
    throw new Error("Failed to soft delete employee.");
  }
}

/**
 * Reactivates an employee by setting their isActive status to true.
 * @param uid The unique ID of the employee to reactivate.
 * @returns Promise<void>
 */
export async function reactivateEmployee(uid: string): Promise<void> {
  try {
    const employeeRef = doc(db, 'users', uid);
    await updateDoc(employeeRef, {
      isActive: true
    });
  } catch (error) {
    console.error("Error reactivating employee: ", error);
    throw new Error("Failed to reactivate employee.");
  }
}

/**
 * Updates the hourly rate for a specific employee.
 * @param uid The unique ID of the employee.
 * @param newRate The new hourly rate to set.
 * @returns Promise<void>
 */
export async function updateEmployeeRate(uid: string, newRate: number): Promise<void> {
  const minWage = parseFloat(process.env.NEXT_PUBLIC_MINIMUM_WAGE || '0');
  if (newRate < minWage) {
    throw new Error(`시급은 최저시급(${minWage.toLocaleString()}원) 이상이어야 합니다.`);
  }
  
  try {
    const employeeRef = doc(db, 'users', uid);
    await updateDoc(employeeRef, {
      hourlyRate: newRate
    });
  } catch (error) {
    console.error("Error updating employee's hourly rate: ", error);
    // Re-throw specific validation error
    if (error instanceof Error && error.message.includes('시급')) {
      throw error;
    }
    throw new Error("Failed to update hourly rate.");
  }
}

/**
 * Fetches all employees from the 'users' collection, regardless of active status.
 * @returns Promise<User[]> An array of all employees.
 */
export async function getAllEmployees(): Promise<User[]> {
  try {
    const usersCollectionRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersCollectionRef);
    
    const employees: User[] = [];
    querySnapshot.forEach((doc) => {
      employees.push({ uid: doc.id, ...doc.data() } as User);
    });

    return employees;
  } catch (error) {
    console.error("Error fetching all employees: ", error);
    throw new Error("Failed to fetch all employees.");
  }
}

/**
 * Fetches all active employees from the 'users' collection.
 * @returns Promise<User[]> An array of active employees.
 */
export async function getActiveEmployees(): Promise<User[]> {
  try {
    const usersCollectionRef = collection(db, 'users');
    const q = query(usersCollectionRef, where('isActive', '==', true));
    const querySnapshot = await getDocs(q);
    
    const employees: User[] = [];
    querySnapshot.forEach((doc) => {
      employees.push({ uid: doc.id, ...doc.data() } as User);
    });

    return employees;
  } catch (error) {
    console.error("Error fetching active employees: ", error);
    throw new Error("Failed to fetch active employees.");
  }
}
