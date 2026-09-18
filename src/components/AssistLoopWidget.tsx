"use client";

import Script from "next/script";

declare global {
  interface Window {
    AssistLoopWidget?: {
      init: (config: { agentId?: string }) => void;
    };
  }
}

const agentId = process.env.NEXT_PUBLIC_ASSISTLOOP_AGENT_ID;

export function AssistLoopWidget() {
  if (!agentId) return null;

  return (
    <Script
      src="https://assistloop.ai/assistloop-widget.js"
      strategy="afterInteractive"
      onLoad={() => {
        window.AssistLoopWidget?.init({
          agentId,
        });
      }}
    />
  );
}
