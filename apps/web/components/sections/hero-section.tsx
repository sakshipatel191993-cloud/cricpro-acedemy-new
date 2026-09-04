"use client"

import { motion } from "framer-motion"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { services } from "@/lib/data"

export function HeroSection() {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-background">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[400px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      {/* Animated diagonal accent line */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ originX: 0 }}
        className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
      />

      <div className="relative z-10 container px-4 pt-5 pb-16 md:pb-24">
        <div className="mx-auto max-w-3xl space-y-6 text-center md:space-y-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {/* <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 px-4 py-1 text-sm tracking-wide">
              Premium Indoor Cricket Training
            </Badge> */}
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-4xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl"
          >
            Practice to{" "}
            <span className="relative text-primary">
              Perfection
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{
                  duration: 0.6,
                  delay: 0.9,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ originX: 0 }}
                className="absolute right-0 -bottom-1 left-0 h-0.5 bg-primary/60"
              />
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl"
          >
            Where casual players become serious cricketers. Book your lane, join
            a session, or train with our expert coaches.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col justify-center gap-4 pt-4 sm:flex-row"
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button
                asChild
                size="lg"
                className="px-8 text-lg shadow-lg hover:shadow-primary/40"
              >
                <Link href={`${services.laneHire.path}#booking-form`}>Book a Lane</Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-border/60 px-8 text-lg hover:border-primary/60 hover:bg-primary/5"
              >
                <Link href="/group-sessions">Explore Sessions</Link>
              </Button>
            </motion.div>
          </motion.div>

          {/* Sub-info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex items-center justify-center gap-3 pt-4 text-sm text-muted-foreground"
          >
            <span className="inline-block h-1 w-1 rounded-full bg-primary" />
            Open 7 days
            <span className="inline-block h-1 w-1 rounded-full bg-primary" />
            Weekdays 12–11 PM · Weekends 9 AM–9 PM
            <span className="inline-block h-1 w-1 rounded-full bg-primary" />4
            Indoor Lanes
          </motion.p>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}
