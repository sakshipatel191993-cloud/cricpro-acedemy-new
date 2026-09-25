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
  duration = 0.55,
  className,
  fromY = 18,
  fromX = 0,
}: FadeInProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: fromY, x: fromX }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -5%" }}
      transition={{ duration: reducedMotion ? 0 : duration, delay: reducedMotion ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
