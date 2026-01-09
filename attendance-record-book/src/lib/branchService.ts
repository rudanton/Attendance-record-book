import { db } from '@/firebase/config';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { logAudit, buildChanges } from './auditLogService';
import { Branch } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Fetches all branches from Firestore.
 * @returns Promise<Branch[]> An array of all branches.
 */
export async function getAllBranches(): Promise<Branch[]> {
  const branchesCol = collection(db, 'branches');
  const q = query(branchesCol, orderBy('branchName'));
  const querySnapshot = await getDocs(q);
  const branches: Branch[] = [];
  querySnapshot.forEach(doc => {
    branches.push({ id: doc.id, ...doc.data() } as Branch);
  });
  return branches;
}

/**
 * Adds a new branch to Firestore.
 * @param branchName The name of the new branch.
 * @returns Promise<Branch> The added branch object including its Firestore ID.
 */
export async function addBranch(branchName: string): Promise<Branch> {
  if (!branchName.trim()) {
    throw new Error('지점 이름은 비워둘 수 없습니다.');
  }
  const branchesCol = collection(db, 'branches');
  const branchId = uuidv4(); // Generate a unique ID for the branch
  const docRef = await addDoc(branchesCol, { branchId, branchName });
  
  // Log audit asynchronously without blocking branch creation
  logAudit({
    branchId,
    resourceType: 'branch',
    resourceId: docRef.id,
    action: 'create',
    changes: buildChanges({}, { branchId, branchName }),
  }).catch(error => console.error("Failed to log audit for branch creation:", error));
  
  return { id: docRef.id, branchId, branchName };
}

/**
 * Updates an existing branch in Firestore.
 * @param id The Firestore document ID of the branch.
 * @param branchId The branchId stored in the document.
 * @param newBranchName The new name for the branch.
 * @returns Promise<void>
 */
export async function updateBranch(id: string, branchId: string, newBranchName: string): Promise<void> {
  if (!newBranchName.trim()) {
    throw new Error('지점 이름은 비워둘 수 없습니다.');
  }
  const branchDoc = doc(db, 'branches', id);
  const updates = { branchName: newBranchName };
  await updateDoc(branchDoc, updates);
  
  // Log audit asynchronously without blocking branch update
  logAudit({
    branchId,
    resourceType: 'branch',
    resourceId: id,
    action: 'update',
    changes: buildChanges({}, updates),
  }).catch(error => console.error("Failed to log audit for branch update:", error));
}

/**
 * Deletes a branch from Firestore.
 * @param id The Firestore document ID of the branch to delete.
 * @returns Promise<void>
 */
export async function deleteBranch(id: string): Promise<void> {
  try {
    const branchDoc = doc(db, 'branches', id);
    await deleteDoc(branchDoc);
    
    // Log audit asynchronously without blocking deletion
    logAudit({
      branchId: id,
      resourceType: 'branch',
      resourceId: id,
      action: 'delete',
      changes: buildChanges({}, {}),
    }).catch(error => console.error("Failed to log audit for branch deletion:", error));
  } catch (error) {
    console.error("Error deleting branch:", error);
    throw new Error("지점을 삭제할 수 없습니다.");
  }
}
