"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/firebase/config';
import { User } from '@/lib/types';

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export default function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const [loadingUser, setLoadingUser] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // If user navigates away from admin routes, log out the admin session
  useEffect(() => {
    if (!pathname) return;
    if (!pathname.startsWith('/admin')) {
      signOut(auth).catch(() => {});
    }
  }, [pathname]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // No user logged in, redirect to login page
        router.push('/admin/login');
        return;
      }

      // User logged in, now check their role from Firestore
      try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const user = userDocSnap.data() as User;
          if (user.role === 'admin') {
            // User is an admin, allow access
            setLoadingUser(false);
          } else {
            // User is logged in but not an admin, redirect
            alert('관리자 권한이 없습니다.');
            router.push('/'); // Redirect to home page or an unauthorized page
          }
        } else {
          // User document not found, likely not an employee or corrupted data
          alert('사용자 정보를 찾을 수 없습니다.');
          router.push('/admin/login');
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        alert('사용자 권한 확인 중 오류가 발생했습니다.');
        router.push('/admin/login');
      }
    });

    return () => unsubscribe(); // Cleanup subscription
  }, [router]);

  if (loadingUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-800">
        <p>권한 확인 중...</p>
      </div>
    );
  }

  // If loadingUser is false, it means the user is an admin and can see the content
  return <>{children}</>;
}
