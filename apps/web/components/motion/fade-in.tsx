"use client";

import { motion, useReducedMotion } from "framer-motion";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  fromY?: number;
  fromX?: number;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.6,
  className,
  fromY = 24,
  fromX = 0,
}: FadeInProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: fromY, x: fromX }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount: 0.18, margin: "0px 0px -8%" }}
      transition={{ duration: reducedMotion ? 0 : Math.max(duration, 0.72), delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
