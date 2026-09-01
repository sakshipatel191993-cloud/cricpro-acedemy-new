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

  if (pathname === "/contact" || pathname === "/about") return null;

  const getCTAText = () => {
    if (pathname === "/lane-hire") return "Book Now";
    if (pathname === "/group-sessions") return "Join Session";
    if (pathname === "/bowling-machine") return "Book Machine";
    if (pathname === "/side-arm") return "Book Session";
    if (pathname === "/coaching") return "Enquire Now";
    if (pathname === "/birthday-parties") return "Plan Party";
    return "Book a Lane";
  };

  const getCTALink = () => {
    if (pathname.startsWith("/lane-hire")) return "/lane-hire";
    if (pathname.startsWith("/group-sessions")) return "/group-sessions";
    if (pathname.startsWith("/bowling-machine")) return "/bowling-machine";
    if (pathname.startsWith("/side-arm")) return "/side-arm";
    if (pathname.startsWith("/coaching")) return "/coaching";
    if (pathname.startsWith("/birthday-parties")) return "/birthday-parties";
    return "/lane-hire";
  };

  const ctaLink = getCTALink();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Already on the target page — jump straight to the booking form.
    if (pathname === ctaLink) {
      e.preventDefault();
      document
        .getElementById("booking-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
                <Link href={`${ctaLink}#booking-form`} onClick={handleClick}>
                  {getCTAText()}
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
