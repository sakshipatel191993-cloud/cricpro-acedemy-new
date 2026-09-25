"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@workspace/ui/components/button";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";

export function CtaSection() {
  const reducedMotion = useReducedMotion();
  return (
    <section data-home-cta className="bg-[#0b0e13] py-14 text-white md:py-24">
      <div className="container px-4">
        <div className="grid items-end gap-8 py-2 md:grid-cols-[1.2fr_.8fr] md:py-14">
          <FadeIn>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Train your way</p>
            <h2 className="max-w-2xl text-[clamp(2.7rem,9vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.055em]">
              Put practice<br />into <span className="text-primary">play.</span>
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
              Choose a lane and book your next session in under two minutes.
            </p>
          </FadeIn>

          <FadeIn delay={0.2} className="flex gap-2 sm:gap-3 md:justify-end">
            <motion.div className="min-w-0 flex-1 sm:flex-none" whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }}>
              <Button asChild size="lg" className="w-full rounded-md px-2 text-sm shadow-lg shadow-primary/25 sm:w-auto sm:px-7 sm:text-base">
                <Link href="/lane-hire#booking-form">Book a Lane</Link>
              </Button>
            </motion.div>
            <motion.div className="min-w-0 flex-1 sm:flex-none" whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }}>
              <Button asChild variant="outline" size="lg" className="w-full rounded-md border-white/30 bg-white/5 px-2 text-sm text-white hover:border-white hover:bg-white/10 hover:text-white sm:w-auto sm:px-7 sm:text-base">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </motion.div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
