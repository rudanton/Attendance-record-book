"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";

import { auth } from "@/firebase/config";

export default function AdminSessionWatcher() {
  const pathname = usePathname();

  useEffect(() => {
    let currentUser: FirebaseUser | null = null;
    const unsub = onAuthStateChanged(auth, (user) => {
      currentUser = user;
    });

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!pathname) return;
    // Only enforce sign-out when outside admin routes
    if (!pathname.startsWith("/admin")) {
      const user = auth.currentUser;
      if (user) {
        signOut(auth).catch(() => {});
      }
    }
  }, [pathname]);

  return null;
}
