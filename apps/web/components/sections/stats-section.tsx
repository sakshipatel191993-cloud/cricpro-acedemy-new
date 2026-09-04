"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Badge } from "@workspace/ui/components/badge";
import { FadeIn } from "@/components/motion/fade-in";

const stats = [
  { value: 4, suffix: "", label: "Indoor Lanes", desc: "Professional nets" },
  { value: 12, suffix: "hrs", label: "Weekend Access", desc: "9AM–9PM Sat & Sun" },
  { value: 7, suffix: "", label: "Days a Week", desc: "Always open" },
  { value: 100, suffix: "%", label: "Expert Coaches", desc: "Qualified team" },
];

function CountUp({ target, suffix, duration = 1.5 }: { target: number; suffix: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const step = target / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [isInView, target, duration]);

  return (
    <span ref={ref}>
      {count}{suffix}
    </span>
  );
}

export function StatsSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <FadeIn className="text-center mb-12">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Our Facility</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">See For Yourself</h2>
          <p className="text-muted-foreground text-lg">A professional cricket training environment</p>
        </FadeIn>

        <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ scale: 1.04 }}
              className="p-6 bg-card/80 rounded-xl border border-border/60 hover:border-primary/40 text-center transition-colors cursor-default"
            >
              <p className="text-3xl md:text-4xl font-bold text-primary mb-1">
                <CountUp target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="font-semibold text-sm mb-1">{stat.label}</p>
              <p className="text-xs text-muted-foreground">{stat.desc}</p>
            </motion.div>
          ))}
        </div>
        </div>
      </div>
    </section>
  );
}
