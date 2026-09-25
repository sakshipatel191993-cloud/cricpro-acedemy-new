import Image from "next/image";
import { FadeIn } from "@/components/motion/fade-in";
import { features } from "@/lib/data";

export function WhyUsSection() {
  return (
    <section className="bg-[#11161d] py-16 text-white md:py-24">
      <div className="container px-4">
        <FadeIn className="mb-10 max-w-2xl md:mb-14">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Built for better practice
          </p>
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-5xl md:text-6xl">
            A place to put in the work.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            Space, support and equipment for every stage of your cricket journey.
          </p>
        </FadeIn>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
          <FadeIn className="relative min-h-[260px] overflow-hidden rounded-xl border border-white/10 sm:min-h-[360px] lg:min-h-[540px]">
            <Image
              src="/indoor-cricket-facility.webp"
              alt="Professional indoor cricket lanes with a player practising in the distance"
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#090b0f]/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
              <span className="mb-3 block h-1 w-8 bg-primary" aria-hidden="true" />
              <p className="max-w-xs text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                Make every session count.
              </p>
            </div>
          </FadeIn>

          <div className="border-t border-white/15">
            {features.map((feature, index) => (
              <FadeIn
                key={feature.title}
                delay={index * 0.08}
                className="grid gap-3 border-b border-white/15 py-6 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-5 sm:py-7 lg:py-8"
              >
                <span className="font-mono text-sm text-primary">0{index + 1}</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{feature.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-white/60 sm:text-base sm:leading-7">
                    {feature.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
