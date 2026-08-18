"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StickyCTA } from "@/components/sticky-cta";

/**
 * Wraps the public site chrome (header, footer, sticky CTA).
 * Admin routes have their own chrome (AdminNav), so we skip the
 * public header/footer/CTA there to avoid a doubled interface.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      {children}
      <Footer />
      <StickyCTA />
    </>
  );
}
