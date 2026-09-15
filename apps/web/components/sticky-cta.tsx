"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@workspace/ui/components/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function StickyCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 500);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // These pages already contain the booking/enquiry flow or its result.
  const hasOwnBookingFlow = [
    "/lane-hire", "/group-sessions", "/masterclass", "/bowling-machine",
    "/side-arm", "/coaching", "/birthday-parties", "/booking-confirm",
    "/booking-success", "/booking-cancel",
  ].some(route => pathname === route || pathname.startsWith(`${route}/`));

  if (hasOwnBookingFlow || pathname === "/contact" || pathname === "/about") return null;

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
          >
            <div className="bg-background/95 backdrop-blur-md border-t border-primary/20 px-4 py-3 shadow-xl">
              <Button asChild className="w-full h-12 text-base font-semibold shadow-lg">
                <Link href="/lane-hire#booking-form">
                  Book a Lane
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {isVisible && <div className="h-[72px] lg:hidden" />}
    </>
  );
}
