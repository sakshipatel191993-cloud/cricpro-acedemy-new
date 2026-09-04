"use client";

import { motion } from "framer-motion";
import { Button } from "@workspace/ui/components/button";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";

export function CtaSection() {
  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] rounded-full bg-primary/8 blur-[100px]" />
      </div>

      <div className="container px-4 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Ready to Start?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Your next level starts with practice. Book online in under 2 minutes.
            </p>
          </FadeIn>

          <FadeIn delay={0.2} className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button asChild size="lg" className="text-lg px-8 shadow-lg hover:shadow-primary/40">
                <Link href="/lane-hire#booking-form">Book a Lane</Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button asChild variant="outline" size="lg" className="text-lg px-8 border-border/60 hover:border-primary/60 hover:bg-primary/5">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </motion.div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
