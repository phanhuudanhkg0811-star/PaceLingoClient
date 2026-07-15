import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Liên hệ — PaceLingo" };

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <ContactForm />
      <SiteFooter />
    </main>
  );
}
