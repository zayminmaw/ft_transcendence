export function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
	return <section className="mx-auto max-w-7xl px-6 pb-12 pt-16 md:px-10 md:pt-24">
		<p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-base-content">{eyebrow}</p>
		<h1 className="marketing-title max-w-4xl text-5xl md:text-7xl">{title}</h1>
		<p className="mt-7 max-w-2xl text-lg leading-relaxed opacity-70">{description}</p>
	</section>;
}
