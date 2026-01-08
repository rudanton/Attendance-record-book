// src/lib/employeeService.ts
import { db } from '@/firebase/config';
import { collection, addDoc, updateDoc, doc, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { User } from './types';

/**
 * Adds a new employee to the 'users' collection with isActive set to true.
 * @param branchId The ID of the branch the employee belongs to.
 * @param employeeData Partial User object containing name, role, hourlyRate.
 * @returns Promise<User> The added user with generated UID and joinedAt timestamp.
 */
export async function addEmployee(branchId: string, employeeData: Omit<User, 'uid' | 'branchId' | 'isActive' | 'joinedAt'>): Promise<User> {
  try {
    const newUser: Omit<User, 'uid'> = {
      ...employeeData,
      branchId, // Add branchId here
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
    throw new Error("Failed to add employee.");
  }
}

/**
 * Performs a soft delete on an employee by setting their isActive status to false.
 * @param branchId The ID of the branch the employee belongs to (for future context, though not directly used in update).
 * @param uid The unique ID of the employee to "delete".
 * @returns Promise<void>
 */
export async function deleteEmployee(branchId: string, uid: string): Promise<void> {
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
 * @param branchId The ID of the branch the employee belongs to (for future context, though not directly used in update).
 * @param uid The unique ID of the employee to reactivate.
 * @returns Promise<void>
 */
export async function reactivateEmployee(branchId: string, uid: string): Promise<void> {
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
 * @param branchId The ID of the branch the employee belongs to (for future context, though not directly used in update).
 * @param uid The unique ID of the employee.
 * @param newRate The new hourly rate to set.
 * @returns Promise<void>
 */
export async function updateEmployeeRate(branchId: string, uid: string, newRate: number): Promise<void> {
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
 * Fetches all employees from the 'users' collection for a specific branch, regardless of active status.
 * @param branchId The ID of the branch to filter employees by.
 * @returns Promise<User[]> An array of all employees for the specified branch.
 */
export async function getAllEmployees(branchId: string): Promise<User[]> {
  try {
    const usersCollectionRef = collection(db, 'users');
    const q = query(usersCollectionRef, where('branchId', '==', branchId)); // Filter by branchId
    const querySnapshot = await getDocs(q);
    
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
 * Fetches all active employees from the 'users' collection for a specific branch.
 * @param branchId The ID of the branch to filter active employees by.
 * @returns Promise<User[]> An array of active employees for the specified branch.
 */
export async function getActiveEmployees(branchId: string): Promise<User[]> {
  try {
    const usersCollectionRef = collection(db, 'users');
    const q = query(usersCollectionRef, where('branchId', '==', branchId), where('isActive', '==', true)); // Filter by branchId and isActive
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
