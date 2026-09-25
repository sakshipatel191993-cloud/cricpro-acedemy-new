"use client";

import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import Link from "next/link";
import Image from "next/image";
import { FadeIn } from "@/components/motion/fade-in";
import { services } from "@/lib/data";

export function CoachingSection() {
  return (
    <section className="py-16 md:py-24 bg-muted/30 border-y border-border/40">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <FadeIn>
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Elite Development</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
               Elite Coaching with Individual Attention
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
              {services.coaching.description}
            </p>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div className="grid overflow-hidden rounded-xl border border-primary/20 bg-card/80 text-left md:grid-cols-[0.9fr_1fr]">
              <div className="relative min-h-[260px] md:min-h-[320px]">
                <Image
                  src="/one-to-one-coaching.webp"
                  alt="Coach giving individual batting guidance during indoor practice"
                  fill
                  sizes="(min-width: 768px) 40vw, 100vw"
                  className="object-cover object-[64%_center]"
                />
              </div>
              <div className="flex flex-col justify-center p-7 sm:p-9">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Personal attention</p>
                <h3 className="text-2xl font-semibold tracking-tight">{services.coaching.price}</h3>
                <p className="mb-7 mt-3 max-w-sm leading-7 text-muted-foreground">
                  Work directly with a coach on the skills and decisions that matter to your game.
                </p>
                <Button asChild size="lg" className="w-full sm:w-fit">
                  <Link href={services.coaching.path}>Enquire About Coaching</Link>
                </Button>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
