"use client";

import { Button } from "@workspace/ui/components/button";
import { ExternalLink, Star } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";

const googleReviewsUrl = "https://share.google/QrYA2VqVli3hS7WJo";

export function TestimonialsSection() {
  return (
    <section className="border-y border-border/40 bg-muted/30 py-16 md:py-24">
      <div className="container mx-auto px-4">
        <FadeIn className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex w-fit items-center gap-1 text-primary" aria-label="Google Reviews">
            {Array.from({ length: 5 }).map((_, index) => <Star key={index} className="h-5 w-5 fill-current" />)}
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">Google Reviews</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">Hear directly from our customers</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Read the latest feedback on our official Google listing. Reviews are managed by Google and updated there directly.
          </p>
          <Button asChild size="lg" className="mt-8 rounded-md px-7">
            <a href={googleReviewsUrl} target="_blank" rel="noopener noreferrer">
              View Google Reviews <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
              <span className="sr-only"> (opens Google in a new tab)</span>
            </a>
          </Button>
        </FadeIn>
      </div>
    </section>
  );
}
