"use client";

import { motion, useReducedMotion } from "framer-motion";

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.075,
      delayChildren: 0.04,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

interface StaggerChildrenProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function StaggerChildren({ children, className, delay = 0 }: StaggerChildrenProps) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={{ ...container, show: { ...container.show, transition: { ...container.show.transition, delayChildren: delay } } }}
      initial={reducedMotion ? false : "hidden"}
      whileInView={reducedMotion ? undefined : "show"}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -5%" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}
