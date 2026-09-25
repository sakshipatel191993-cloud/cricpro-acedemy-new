"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@workspace/ui/components/button";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";

export function CtaSection() {
  const reducedMotion = useReducedMotion();
  return (
    <section className="bg-[#0b0e13] py-16 text-white md:py-24">
      <div className="container px-4">
        <div className="grid items-end gap-8 py-10 md:grid-cols-[1.2fr_.8fr] md:py-14">
          <FadeIn>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Train your way</p>
            <h2 className="max-w-xl text-4xl font-semibold tracking-[-0.04em] md:text-6xl">
              Ready to Start?
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/70">
              Your next level starts with practice. Book online in under 2 minutes.
            </p>
          </FadeIn>

          <FadeIn delay={0.2} className="flex flex-col gap-3 sm:flex-row md:justify-end">
            <motion.div whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }}>
              <Button asChild size="lg" className="rounded-md px-7 text-base shadow-lg shadow-primary/25">
                <Link href="/lane-hire#booking-form">Book a Lane</Link>
              </Button>
            </motion.div>
            <motion.div whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }}>
              <Button asChild variant="outline" size="lg" className="rounded-md border-white/30 bg-white/5 px-7 text-base text-white hover:border-white hover:bg-white/10 hover:text-white">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </motion.div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
