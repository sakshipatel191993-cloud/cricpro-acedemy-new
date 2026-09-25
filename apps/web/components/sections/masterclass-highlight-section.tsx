import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";

export function MasterclassHighlightSection() {
  return (
    <section aria-labelledby="masterclass-heading" className="relative overflow-hidden bg-[#10151c] py-20 text-white md:py-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_8%_90%,rgba(225,29,72,0.12),transparent_45%)]" aria-hidden="true" />
      <div className="container relative px-4">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
          <FadeIn className="max-w-2xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">The Cricpro Masterclass</p>
            <h2 id="masterclass-heading" className="text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl xl:text-6xl">
              Train with intent. <span className="text-primary">Play with an edge.</span>
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/70 sm:text-lg">
              Step beyond the usual practice session. Choose your coach, work on the details that matter, and turn focused feedback into more confident cricket.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/15 pt-6 text-sm font-medium text-white/70">
              <span>Coach-led learning</span>
              <span>Purposeful practice</span>
              <span>Skills you can apply</span>
            </div>
            <Link href="/masterclass" className="group mt-9 inline-flex min-h-12 items-center justify-center gap-3 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
              Explore Masterclasses
              <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </FadeIn>

          <FadeIn fromY={18} delay={0.12} className="relative min-h-[320px] overflow-hidden rounded-xl border border-white/15 sm:min-h-[430px] lg:min-h-[500px]">
            <Image
              src="/masterclass-coaching.webp"
              alt="Coach guiding a player through batting technique in an indoor net"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover object-[68%_center]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090b0f]/85 via-[#090b0f]/15 to-transparent" aria-hidden="true" />
            <div className="absolute inset-x-0 bottom-0 border-t border-white/20 p-6 sm:p-8">
              <p className="max-w-sm text-xl font-semibold leading-snug tracking-tight sm:text-2xl">A sharper session for the moments that count.</p>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
