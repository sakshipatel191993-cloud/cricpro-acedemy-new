"use client";

import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import Link from "next/link";
import { Cake, Trophy, PartyPopper, Check } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { services } from "@/lib/data";

export function BirthdaySection() {
  return (
    <section className="py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <FadeIn fromX={-24} fromY={0} className="order-2 md:order-1">
              <div>
                <Badge variant="secondary" className="mb-4 bg-primary/10 text-primary border border-primary/20">Celebrate</Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Cricket Parties Kids Love
                </h2>
                <p className="text-muted-foreground text-lg mb-6">
                  {services.birthdayParties.description}
                </p>
                <ul className="space-y-2 text-muted-foreground mb-6">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Active, fun-filled celebrations</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Professional setup</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Stress-free for parents</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Memorable experiences</li>
                </ul>
                <Button asChild variant="outline" size="lg" className="border-border/60 hover:border-primary/60 hover:bg-primary/5">
                  <Link href={services.birthdayParties.path}>Plan Your Party</Link>
                </Button>
              </div>
            </FadeIn>

            <FadeIn fromX={24} fromY={0} delay={0.15} className="order-1 md:order-2">
              <div className="p-8 bg-card/80 rounded-xl border border-primary/20 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <p className="text-muted-foreground mb-2">Custom quotes available</p>
                <p className="text-3xl font-bold">Birthday Packages</p>
                <p className="text-sm text-muted-foreground mt-2">Tailored to your needs</p>
                <div className="mt-6 flex justify-center gap-6">
                  <Cake className="h-8 w-8 text-primary" />
                  <Trophy className="h-8 w-8 text-primary" />
                  <PartyPopper className="h-8 w-8 text-primary" />
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}
