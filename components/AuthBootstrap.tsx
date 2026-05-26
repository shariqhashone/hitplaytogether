"use client";
import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Ensures the signed-in Convex Auth identity has a matching app `users` row.
 * Mount once near the top of authenticated pages.
 */
export function AuthBootstrap() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const bootstrap = useMutation(api.users.bootstrap);
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      bootstrap({}).catch(() => {});
    }
  }, [isAuthenticated, isLoading, bootstrap]);
  return null;
}
