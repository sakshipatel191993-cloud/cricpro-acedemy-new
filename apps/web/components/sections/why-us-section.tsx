"use client";

import { motion } from "framer-motion";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { features } from "@/lib/data";

export function WhyUsSection() {
  return (
    <section className="border-y border-border/40 bg-muted/30 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <FadeIn className="mb-12 max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Built for better practice</p>
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
            Why Cricpro Centre of Excellence
          </h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            The premier choice for cricket training in the area
          </p>
        </FadeIn>

        <StaggerChildren className="grid border-t border-border/70 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <StaggerItem key={index} className="border-b border-border/70 sm:[&:nth-child(odd)]:border-r lg:border-r lg:last:border-r-0">
              <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }} className="h-full p-6 sm:p-8">
                <span className="mb-10 block font-mono text-xs text-primary">0{index + 1}</span>
                <h3 className="text-xl font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.description}</p>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}
