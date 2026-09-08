import type { Metadata } from "next";

export const metadata: Metadata = { title: "About Us" };

const steps = [
  { n: "01", title: "Quality Control", text: "Strict standards applied throughout every stage of handling." },
  { n: "02", title: "Verification", text: "Commitment to consistency and dependable quality procedures." },
  { n: "03", title: "Secure Packaging", text: "Professional packaging designed for protection and reliability." },
  { n: "04", title: "Fast Fulfillment", text: "Prompt processing and efficient order management." },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-5 py-16">
      <p className="mb-3 text-xs tracking-[0.28em] text-[#d4af37] uppercase">Redline Labs</p>
      <h1 className="mb-4 text-4xl font-semibold tracking-tight">Precision. Quality. Consistency.</h1>
      <p className="mb-12 max-w-2xl text-lg leading-8 text-[#cfcfcf]">
        Built for professionals who demand excellence, reliability, and premium
        standards in every order.
      </p>

      <p className="mb-3 text-xs font-bold tracking-[0.24em] text-[#d4af37] uppercase">
        Our mission
      </p>
      <h2 className="mb-5 text-3xl font-semibold tracking-tight">Built For Serious Research</h2>
      <div className="space-y-5 text-base leading-8 text-[#c8c8c8]">
        <p>
          Redline Labs was created with a simple mission: provide premium
          research-focused solutions backed by consistency, professionalism,
          and uncompromising quality standards.
        </p>
        <p>
          Every aspect of our operation is designed around precision and
          reliability. From product handling to fulfillment, we focus on
          delivering a seamless experience that reflects our commitment to
          excellence.
        </p>
        <p>
          Our dedication to quality assurance, secure packaging, and exceptional
          customer support has helped establish Redline Labs as a trusted name
          among professionals seeking dependable research solutions.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {steps.map((step) => (
          <article
            key={step.n}
            className="border border-[rgba(212,175,55,0.18)] bg-[#0a0a0a] p-6"
          >
            <p className="mb-2 text-sm font-bold text-[#d4af37]">{step.n}</p>
            <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
            <p className="text-sm leading-7 text-[#bdbdbd]">{step.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
