"use client"

import { motion, useReducedMotion } from "framer-motion"
import Image from "next/image"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { services } from "@/lib/data"

export function HeroSection() {
  const reducedMotion = useReducedMotion()
  return (
    <section className="relative isolate min-h-[calc(100dvh-6rem)] overflow-hidden bg-[#090b0f] text-white">
      <Image
        src="/cricpro-hero-training.png"
        alt="Cricketer training in a Cricpro indoor lane"
        fill
        priority
        sizes="100vw"
        className="!bottom-auto !h-[46dvh] object-cover object-[78%_center] md:!bottom-0 md:!h-full md:object-[68%_center]"
      />
      <div className="absolute inset-x-0 top-0 h-[46dvh] bg-[linear-gradient(0deg,#090b0f_0%,rgba(9,11,15,0)_48%)] md:inset-0 md:h-auto md:bg-[linear-gradient(90deg,rgba(9,11,15,.98)_0%,rgba(9,11,15,.88)_38%,rgba(9,11,15,.26)_69%,rgba(9,11,15,.12)_100%)]" />
      <div className="absolute inset-0 hidden bg-[linear-gradient(0deg,rgba(9,11,15,.72)_0%,transparent_42%)] md:block" />
      <div className="absolute left-0 top-0 h-1 w-full bg-primary" />

      <div className="relative z-10 container flex min-h-[calc(100dvh-6rem)] items-center px-4 pb-12 pt-[40dvh] sm:px-6 md:py-16 lg:py-20">
        <div className="max-w-2xl space-y-7 md:space-y-8">
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="inline-flex items-center gap-2 border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 bg-primary" aria-hidden="true" />
              Indoor cricket, every season
            </span>
          </motion.div>

          <motion.h1
            initial={reducedMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl text-[clamp(2.75rem,11vw,4rem)] font-semibold leading-[0.96] tracking-[-0.055em] text-white md:text-6xl lg:text-7xl"
          >
            Practice with
            <span className="block text-primary">
              Perfection
            </span>
          </motion.h1>

          <motion.p
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="max-w-xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8 md:text-xl"
          >
            Premium indoor lanes, structured sessions and coaching built for every stage of your game.
          </motion.p>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex gap-2 pt-2 sm:gap-3"
          >
            <motion.div className="min-w-0 flex-1 sm:flex-none" whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }}>
              <Button
                asChild
                size="lg"
                className="w-full rounded-md px-2 text-sm shadow-lg shadow-primary/25 sm:w-auto sm:px-7 sm:text-base"
              >
                <Link href={`${services.laneHire.path}#booking-form`}>Book a Lane</Link>
              </Button>
            </motion.div>
            <motion.div className="min-w-0 flex-1 sm:flex-none" whileHover={reducedMotion ? undefined : { y: -2 }} whileTap={reducedMotion ? undefined : { scale: 0.98 }}>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full rounded-md border-white/35 bg-white/5 px-2 text-sm text-white hover:border-white hover:bg-white/12 hover:text-white sm:w-auto sm:px-7 sm:text-base"
              >
                <Link href="/group-sessions">Explore Sessions</Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="pt-3 text-sm text-white/75"
          >
            <div className="border-l-2 border-primary pl-4 sm:hidden">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-semibold text-white">Open 7 days</span>
                <span className="text-xs text-white/60">4 indoor lanes</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Weekdays</span>
                  <span className="mt-0.5 block font-medium text-white/90">3–11 PM</span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Weekends</span>
                  <span className="mt-0.5 block font-medium text-white/90">9 AM–11 PM</span>
                </div>
              </div>
            </div>
            <div className="hidden flex-wrap items-center gap-x-4 gap-y-2 leading-6 sm:flex">
              <span>Open 7 days</span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span>Weekdays 3–11 PM · Weekends 9 AM–11 PM</span>
              <span className="h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span>4 indoor lanes</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
