"use client";
export function ClientBody({ children }: { children: React.ReactNode }) {
  return <body suppressHydrationWarning>{children}</body>;
}
