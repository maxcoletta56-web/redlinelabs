export function IconTruck({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 7h11v10H3V7Zm11 3h4l3 3v4h-7v-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="18.5" r="1.5" fill="currentColor" />
      <circle cx="18" cy="18.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function IconBeaker({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3h6M10 3v5.2L5.4 19.1A2 2 0 0 0 7.2 22h9.6a2 2 0 0 0 1.8-2.9L13.9 8.2V3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 14h8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconShield({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3 5 6v6c0 5 3.2 7.7 7 9 3.8-1.3 7-4 7-9V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconLock({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="5" y="10" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconMicroscope({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 3h4v6H9V3ZM11 9v3m-4 9h12M7 21v-3a5 5 0 0 1 10-1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="16.5" cy="12.5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function IconStar({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="m12 3 2.6 6.4L21 10l-5 4.2L17.4 21 12 17.6 6.6 21 8 14.2 3 10l6.4-.6L12 3Z" />
    </svg>
  );
}

export function IconArrow({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
