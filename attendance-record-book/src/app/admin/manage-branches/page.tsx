"use client";

import { useCallback,useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { auth, db } from '@/firebase/config';
import { addBranch, deleteBranch,getAllBranches, updateBranch } from '@/lib/branchService';
import { Branch, User } from '@/lib/types';

// ===== Constants =====
const STORAGE_KEYS = {
  BRANCH_ID: 'branchId',
};

const MESSAGES = {
  TITLE: '지점 관리',
  BACK: '← 관리자 메뉴로 돌아가기',
  NEW_BRANCH_TITLE: '새 지점 추가',
  NEW_BRANCH_PLACEHOLDER: '새 지점 이름',
  NEW_BRANCH_ADD: '지점 추가',
  LIST_TITLE: '지점 목록',
  LOADING_BRANCHES: '지점 목록을 불러오는 중...',
  AUTH_CHECKING: '권한 확인 중...',
  NO_ACCESS: '접근 권한이 없습니다.',
  INPUT_REQUIRED: '지점 이름을 입력해주세요.',
  DELETE_CONFIRM: (branchName: string) => `정말로 지점 "${branchName}"을(를) 삭제하시겠습니까?`,
  FETCH_ERROR: '지점 목록을 불러올 수 없습니다.',
  ADD_ERROR: '지점을 추가할 수 없습니다.',
  UPDATE_ERROR: '지점을 수정할 수 없습니다.',
  DELETE_ERROR: '지점을 삭제할 수 없습니다.',
};

const BUTTON_STYLES = {
  PRIMARY: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md',
  LINK: 'text-blue-600 hover:text-blue-800',
};

function ManageBranchesPageContent() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBranchName, setNewBranchName] = useState('');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingBranchName, setEditingBranchName] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedBranches = await getAllBranches();
      setBranches(fetchedBranches);
      return fetchedBranches;
    } catch (error) {
      console.error("Failed to fetch branches:", error);
      alert(MESSAGES.FETCH_ERROR);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Check authorization: if no branchId in localStorage, allow access; otherwise require admin
  useEffect(() => {
    const checkAuth = async () => {
      const storedBranchId = localStorage.getItem(STORAGE_KEYS.BRANCH_ID);
      
      // If no branchId in localStorage, skip auth check
      if (!storedBranchId) {
        setIsAuthorized(true);
        setLoadingUser(false);
        await fetchBranches();
        return;
      }

      // If branchId exists, check admin role
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
          router.push('/admin/login');
          return;
        }

        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const user = userDocSnap.data() as User;
            if (user.role === 'admin') {
              setIsAuthorized(true);
            } else {
              alert('관리자 권한이 없습니다.');
              router.push('/');
            }
          } else {
            alert('사용자 정보를 찾을 수 없습니다.');
            router.push('/admin/login');
          }
        } catch (error) {
          console.error("Error checking user role:", error);
          alert('사용자 권한 확인 중 오류가 발생했습니다.');
          router.push('/admin/login');
        }
        setLoadingUser(false);
      });

      await fetchBranches();

      return () => unsubscribe();
    };

    checkAuth();
  }, [fetchBranches, router]);

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) {
      alert(MESSAGES.INPUT_REQUIRED);
      return;
    }
    try {
      await addBranch(newBranchName);
      setNewBranchName('');
      await fetchBranches();
    } catch (error) {
      console.error("Failed to add branch:", error);
      alert(error instanceof Error ? error.message : MESSAGES.ADD_ERROR);
    }
  };

  const handleEditClick = (branch: Branch) => {
    setEditingBranchId(branch.id);
    setEditingBranchName(branch.branchName);
  };

  const handleCancelEdit = () => {
    setEditingBranchId(null);
    setEditingBranchName('');
  };

  const handleSaveEdit = async (id: string, branchId: string) => {
    if (!editingBranchName.trim()) {
      alert(MESSAGES.INPUT_REQUIRED);
      return;
    }
    try {
      await updateBranch(id, branchId, editingBranchName);
      await fetchBranches();
      handleCancelEdit();
    } catch (error) {
      console.error("Failed to update branch:", error);
      alert(error instanceof Error ? error.message : MESSAGES.UPDATE_ERROR);
    }
  };

  const handleDeleteBranch = async (id: string, branchName: string) => {
    if (window.confirm(MESSAGES.DELETE_CONFIRM(branchName))) {
      try {
        await deleteBranch(id);
        await fetchBranches();
      } catch (error) {
        console.error("Failed to delete branch:", error);
        alert(MESSAGES.DELETE_ERROR);
      }
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-12 bg-gray-100 text-gray-800">
      {loadingUser ? (
        <div className="flex items-center justify-center">
          <p>{MESSAGES.AUTH_CHECKING}</p>
        </div>
      ) : !isAuthorized ? (
        <div className="flex items-center justify-center">
          <p>{MESSAGES.NO_ACCESS}</p>
        </div>
      ) : (
        <div className="w-full max-w-4xl">
        <div className="flex justify-start items-center mb-8">
            <Link href="/admin" className={BUTTON_STYLES.LINK}>
                {MESSAGES.BACK}
            </Link>
        </div>
        <h1 className="text-4xl font-bold mb-8 text-gray-800">{MESSAGES.TITLE}</h1>
        
        {/* Add Branch Form */}
        <div className="w-full mb-8 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-gray-700">{MESSAGES.NEW_BRANCH_TITLE}</h2>
          <form onSubmit={handleAddBranch} className="flex space-x-4">
            <input 
              type="text" 
              placeholder={MESSAGES.NEW_BRANCH_PLACEHOLDER} 
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="flex-grow p-2 border rounded-md"
              required
            />
            <button type="submit" className={BUTTON_STYLES.PRIMARY}>{MESSAGES.NEW_BRANCH_ADD}</button>
          </form>
        </div>

        {/* Branch List */}
        <div className="w-full bg-white rounded-lg shadow-md overflow-hidden">
          <h2 className="text-2xl font-semibold p-6 text-gray-700">{MESSAGES.LIST_TITLE}</h2>
          {loading ? (
            <p className="p-6">{MESSAGES.LOADING_BRANCHES}</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">지점 ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">지점명</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {branches.map((branch) => (
                  <tr key={branch.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{branch.branchId}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {editingBranchId === branch.id ? (
                        <input
                          type="text"
                          value={editingBranchName}
                          onChange={(e) => setEditingBranchName(e.target.value)}
                          className="p-1 border rounded-md w-full"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveEdit(branch.id, branch.branchId);
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        branch.branchName
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      {editingBranchId === branch.id ? (
                        <>
                          <button onClick={() => handleSaveEdit(branch.id, branch.branchId)} className="text-green-600 hover:text-green-900 mr-4">저장</button>
                          <button onClick={handleCancelEdit} className="text-gray-600 hover:text-gray-900">취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleEditClick(branch)} className="text-indigo-600 hover:text-indigo-900 mr-4">수정</button>
                          <button onClick={() => handleDeleteBranch(branch.id, branch.branchName)} className="text-red-600 hover:text-red-900">삭제</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        </div>
      )}
      </main>
  );
}

export default function ManageBranchesPage() {
  return <ManageBranchesPageContent />;
}
