"use client";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import Link from "next/link";
import { Check } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { services } from "@/lib/data";

export function LaneHireSection() {
  return (
    <section className="py-16 md:py-24 bg-muted/30 border-y border-border/40">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <FadeIn fromX={-24} fromY={0}>
              <div className="space-y-4">
                <Badge className="bg-primary/10 text-primary border border-primary/30">Start Here</Badge>
                <h2 className="text-3xl md:text-4xl font-bold">
                  Your Training Starts Here
                </h2>
                <p className="text-muted-foreground text-lg">
                  {services.laneHire.description}
                </p>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Practice at your own pace</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Flexible 1-3 hour sessions</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary flex-shrink-0" /> Perfect for all skill levels</li>
                </ul>
                <div className="pt-4">
                  <p className="text-2xl font-bold text-primary">
                    From £{services.laneHire.price.offPeak}/hour
                  </p>
                  <p className="text-sm text-muted-foreground">Off-peak: {services.laneHire.offPeakHours}</p>
                </div>
                <Button asChild size="lg" className="mt-4">
                  <Link href={services.laneHire.path}>Book Your Lane</Link>
                </Button>
              </div>
            </FadeIn>

            <FadeIn fromX={24} fromY={0} delay={0.15}>
              <Card className="border-border/60 bg-card/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                  <CardDescription>Simple, transparent pricing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-background/60 rounded-lg border border-border/40">
                    <div>
                      <p className="font-semibold">Off Peak</p>
                      <p className="text-sm text-muted-foreground">Weekdays · 12–4 PM</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">£15/hr</p>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-background/60 rounded-lg border border-border/40">
                    <div>
                      <p className="font-semibold">Peak</p>
                      <p className="text-sm text-muted-foreground">Weekdays 4–11 PM · Weekends all day</p>
                    </div>
                    <p className="text-2xl font-bold text-primary">£25/hr</p>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}
