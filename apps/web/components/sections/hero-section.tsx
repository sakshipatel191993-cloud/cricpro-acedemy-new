"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { Button } from "@workspace/ui/components/button"
import Link from "next/link"
import { services } from "@/lib/data"

export function HeroSection() {
  return (
    <section className="relative isolate min-h-[calc(100dvh-6rem)] overflow-hidden bg-[#090b0f] text-white">
      <Image
        src="/cricpro-hero-training.png"
        alt="Cricketer training in a Cricpro indoor lane"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[68%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,11,15,.98)_0%,rgba(9,11,15,.88)_38%,rgba(9,11,15,.26)_69%,rgba(9,11,15,.12)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(9,11,15,.72)_0%,transparent_42%)]" />
      <div className="absolute left-0 top-0 h-1 w-full bg-primary" />

      <div className="relative z-10 container flex min-h-[calc(100dvh-6rem)] items-center px-4 py-16 sm:px-6 lg:py-20">
        <div className="max-w-2xl space-y-7 md:space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="inline-flex items-center gap-2 border border-white/20 bg-black/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 bg-primary" aria-hidden="true" />
              Indoor cricket, every season
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl text-5xl font-semibold leading-[0.96] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl"
          >
            Practice with
            <span className="block text-primary">
              Perfection
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="max-w-xl text-lg leading-8 text-white/75 md:text-xl"
          >
            Premium indoor lanes, structured sessions and coaching built for every stage of your game.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col gap-3 pt-2 sm:flex-row"
          >
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Button
                asChild
                size="lg"
                className="rounded-md px-7 text-base shadow-lg shadow-primary/25"
              >
                <Link href={`${services.laneHire.path}#booking-form`}>Book a Lane</Link>
              </Button>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-md border-white/35 bg-white/5 px-7 text-base text-white hover:border-white hover:bg-white/12 hover:text-white"
              >
                <Link href="/group-sessions">Explore Sessions</Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 text-sm text-white/70"
          >
            <span className="inline-block h-1 w-1 bg-primary" />
            <span>Open 7 days</span>
            <span className="inline-block h-1 w-1 bg-primary" />
            <span>Weekdays 3 PM to 11 PM · Weekends 9 AM to 11 PM</span>
            <span className="inline-block h-1 w-1 bg-primary" />
            <span>4 Indoor Lanes</span>
          </motion.p>
        </div>
      </div>
    </section>
  )
}
