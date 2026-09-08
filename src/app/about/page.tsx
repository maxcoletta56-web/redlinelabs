import type { Metadata } from "next";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "About" };

const steps = [
  { n: "01", title: "Quality control", text: "Defined standards applied throughout handling." },
  { n: "02", title: "Verification", text: "Consistent procedures for dependable supply." },
  { n: "03", title: "Secure packaging", text: "Packed to protect integrity through dispatch." },
  { n: "04", title: "Fulfillment", text: "Prompt processing and orderly order management." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[980px] px-5 py-16">
      <PageIntro kicker="Redline Labs" title="Precision. Quality. Consistency.">
        Built for professionals who need reliable materials and considered
        service in every order.
      </PageIntro>

      <div className="space-y-5 text-[15px] leading-8 text-[#cfc8b8]">
        <p>
          Redline Labs exists to provide research-focused supply backed by
          consistency, professionalism, and uncompromising quality standards.
        </p>
        <p>
          From handling to fulfillment, the operation is designed around
          precision. The aim is a seamless experience that reflects care rather
          than noise.
        </p>
        <p>
          Quality assurance, secure packaging, and responsive support have
          established Redline Labs among teams that need dependable research
          solutions.
        </p>
      </div>

      <div className="mt-14 grid border border-[rgba(212,175,55,0.14)] sm:grid-cols-2">
        {steps.map((step, i) => (
          <article
            key={step.n}
            className={`p-7 ${i % 2 === 1 ? "sm:border-l sm:border-[rgba(212,175,55,0.14)]" : ""} ${
              i > 1 ? "border-t border-[rgba(212,175,55,0.14)]" : ""
            }`}
          >
            <p className="mb-2 text-[11px] tracking-[0.18em] text-[#d4af37]">{step.n}</p>
            <h2 className="font-serif mb-2 text-2xl font-medium">{step.title}</h2>
            <p className="text-sm leading-7 text-[#a7a193]">{step.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
