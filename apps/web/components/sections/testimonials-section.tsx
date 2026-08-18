"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { Star } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { testimonials } from "@/lib/data";

export function TestimonialsSection() {
  return (
    <section className="py-16 md:py-24 bg-muted/30 border-y border-border/40">
      <div className="container mx-auto px-4">
        <FadeIn className="text-center mb-12">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Testimonials</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            What Our Cricketers Say
          </h2>
        </FadeIn>

        <div className="max-w-5xl mx-auto">
        <StaggerChildren className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <StaggerItem key={index}>
              <motion.div whileHover={{ y: -4, boxShadow: "0 0 30px rgba(225,29,72,0.15)" }} transition={{ duration: 0.2 }}>
                <Card className="p-6 border-l-2 border-l-primary border-border/60 bg-card/80 h-full">
                  <CardContent className="pt-0">
                    {/* Stars */}
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-4 italic leading-relaxed">
                      &ldquo;{testimonial.content}&rdquo;
                    </p>
                    <div className="pt-4 border-t border-border/40">
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-primary">{testimonial.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerChildren>
        </div>
      </div>
    </section>
  );
}
