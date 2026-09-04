import { Metadata } from "next";
import { HeroSection } from "@/components/sections/hero-section";
import { LaneHireSection } from "@/components/sections/lane-hire-section";
import { TrainingCardsSection } from "@/components/sections/training-cards-section";
import { CoachingSection } from "@/components/sections/coaching-section";
import { BirthdaySection } from "@/components/sections/birthday-section";
import { WhyUsSection } from "@/components/sections/why-us-section";
import { StatsSection } from "@/components/sections/stats-section";
import { TestimonialsSection } from "@/components/sections/testimonials-section";
import { CtaSection } from "@/components/sections/cta-section";

export const metadata: Metadata = {
  title: "Cricpro Centre of Excellence | Premium Indoor Cricket Training",
  description: "Book indoor cricket lanes, coaching sessions, and bowling machine hire. Practice to Perfection at our premium indoor cricket facility. Open 7 days a week.",
  keywords: ["cricket training", "indoor cricket", "cricket coaching", "cricket lane hire", "batting practice", "bowling machine hire"],
};

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <LaneHireSection />
      <TrainingCardsSection />
      <CoachingSection />
      <BirthdaySection />
      <WhyUsSection />
      <StatsSection />
      <TestimonialsSection />
      <CtaSection />
    </main>
  );
}
