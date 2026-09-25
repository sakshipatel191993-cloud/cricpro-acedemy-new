"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { services } from "@/lib/data";

export function TrainingCardsSection() {
  return (
    <section className="py-20 md:py-28" aria-labelledby="training-heading">
      <div className="container px-4">
        <FadeIn className="mb-10 grid gap-4 md:mb-14 md:grid-cols-[1fr_0.8fr] md:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.17em] text-primary">Find your next session</p>
            <h2 id="training-heading" className="max-w-lg text-4xl font-semibold leading-[1.05] tracking-[-0.045em] md:text-5xl">
              More ways to build your game.
            </h2>
          </div>
          <p className="max-w-md text-base leading-7 text-muted-foreground md:justify-self-end md:text-lg">
            Join a coached group or add focused repetitions to your own practice.
          </p>
        </FadeIn>

        <StaggerChildren className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:gap-5">
          <StaggerItem>
            <Link href={services.groupSessions.path} className="group relative flex h-full min-h-[350px] flex-col justify-between overflow-hidden rounded-xl border border-primary/30 bg-[#11161d] p-7 text-white transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:p-9">
              <div className="absolute -right-16 -top-20 size-72 rounded-full bg-primary/15 blur-3xl transition-transform duration-500 group-hover:scale-125" aria-hidden="true" />
              <div className="relative flex items-start justify-between gap-4">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">Coached training</span>
                <ArrowUpRight className="size-6 text-primary transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden="true" />
              </div>
              <div className="relative">
                <h3 className="max-w-md text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">{services.groupSessions.title}</h3>
                <p className="mt-3 max-w-md text-base leading-7 text-white/65">{services.groupSessions.description}</p>
                <div className="mt-7 flex flex-wrap items-end justify-between gap-4 border-t border-white/15 pt-5">
                  <span className="text-sm text-white/65">{services.groupSessions.ageGroup} · Find your group</span>
                  <span className="text-xl font-semibold text-white">£{services.groupSessions.price.perSession.toFixed(2)}<span className="ml-1 text-sm font-normal text-white/60">/ session</span></span>
                </div>
              </div>
            </Link>
          </StaggerItem>

          <div className="grid gap-4 lg:gap-5">
            <StaggerItem>
              <Link href={services.bowlingMachine.path} className="group flex h-full min-h-[168px] flex-col justify-between rounded-xl border border-border bg-card p-6 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">Batting repetitions</p>
                    <h3 className="text-2xl font-semibold tracking-tight">{services.bowlingMachine.title}</h3>
                  </div>
                  <ArrowUpRight className="size-5 shrink-0 text-primary transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden="true" />
                </div>
                <p className="mt-5 text-sm leading-6 text-muted-foreground">From £{services.bowlingMachine.price.offPeak}/hr · Set the pace of your practice</p>
              </Link>
            </StaggerItem>
            <StaggerItem>
              <Link href={services.sideArm.path} className="group flex h-full min-h-[168px] flex-col justify-between rounded-xl border border-border bg-card p-6 transition-[border-color,transform,box-shadow] duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-primary">Match simulation</p>
                    <h3 className="text-2xl font-semibold tracking-tight">{services.sideArm.title}</h3>
                  </div>
                  <ArrowUpRight className="size-5 shrink-0 text-primary transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" aria-hidden="true" />
                </div>
                <p className="mt-5 text-sm leading-6 text-muted-foreground">£{services.sideArm.price.perHour}/hour · Build confidence against pace</p>
              </Link>
            </StaggerItem>
          </div>
        </StaggerChildren>
      </div>
    </section>
  );
}
