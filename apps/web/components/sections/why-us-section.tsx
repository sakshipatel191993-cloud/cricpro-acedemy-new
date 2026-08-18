"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children";
import { features } from "@/lib/data";

export function WhyUsSection() {
  return (
    <section className="py-16 md:py-24 bg-muted/30 border-y border-border/40">
      <div className="container mx-auto px-4">
        <FadeIn className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Why Cricpro Centre of Excellence
          </h2>
          <p className="text-muted-foreground text-lg">
            The premier choice for cricket training in the area
          </p>
        </FadeIn>

        <div className="max-w-5xl mx-auto">
        <StaggerChildren className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <StaggerItem key={index}>
              <motion.div whileHover={{ y: -4, boxShadow: "0 0 30px rgba(225,29,72,0.15)" }} transition={{ duration: 0.2 }}>
                <Card className="text-center p-6 border-border/60 bg-card/80 hover:border-primary/30 transition-colors h-full">
                  <CardHeader>
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
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
