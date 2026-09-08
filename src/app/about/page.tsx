import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "About Us" };

const steps = [
  { title: "Purity guaranteed", text: "Materials are supplied to a high-purity standard for laboratory research use only." },
  { title: "Support that cares", text: "We are here to answer questions and help with orders, whether you are new or returning." },
  { title: "Fast & secure delivery", text: "Orders are packed carefully and dispatched for Australia-wide delivery." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[860px] px-5 py-14">
      <PageIntro kicker="About us" title="Welcome to Redline Labs — precision you can trust">
        We specialise in delivering high-purity, research-grade peptides to
        qualified researchers and institutions across Australia.
      </PageIntro>
      <div className="space-y-5 text-[16px] leading-8 text-[#cfcfcf]">
        <p>
          Redline Labs is Australian-owned, with a focus on product quality,
          consistent handling, and professional customer service.
        </p>
        <h2 className="pt-4 text-2xl font-bold text-white">Our promise</h2>
      </div>
      <div className="mt-6 grid gap-6 sm:grid-cols-3">
        {steps.map((step) => (
          <article key={step.title} className="rounded-lg bg-[#161616] p-5">
            <h3 className="mb-2 font-bold">{step.title}</h3>
            <p className="text-sm leading-7 text-[#9a9a9a]">{step.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
