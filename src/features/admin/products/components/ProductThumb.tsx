import Image from "next/image";

/** A small square product picture for the admin list. Empty well when there is no image yet. */
export function ProductThumb({ src, name }: { src: string | null; name: string }) {
  return (
    <div className="bg-ink-200 relative size-12 shrink-0 overflow-hidden rounded-md">
      {src ? (
        <Image src={src} alt={`Photo of ${name}`} fill sizes="48px" className="object-cover" />
      ) : null}
    </div>
  );
}
