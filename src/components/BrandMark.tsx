import Image from "next/image";
import Link from "next/link";

export function BrandMark({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link href="/" className={`inline-flex shrink-0 items-center ${className}`}>
      <Image
        src="/brand/logo-mark.png"
        alt="Redline Labs"
        width={170}
        height={44}
        className="h-8 w-auto"
        priority={priority}
      />
    </Link>
  );
}
