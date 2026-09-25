import Script from "next/script";

export function VercelTelemetry() {
  return (
    <>
      <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
      <Script src="/_vercel/speed-insights/script.js" strategy="afterInteractive" />
    </>
  );
}
