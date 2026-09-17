import Image from "next/image";

export default function Header() {
  return (
    <header className="flex items-center mb-4" id="hemolens-header">
      <Image
        src="/assets/logo.png"
        alt="HemoLens Logo"
        width={180}
        height={46}
        className="h-9 sm:h-10 w-auto object-contain"
        priority
      />
    </header>
  );
}
