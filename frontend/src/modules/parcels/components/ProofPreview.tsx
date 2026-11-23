import { useEffect, useState } from 'react';
import { ImageViewer } from '@global-components';
import { PDF_TYPE } from '@utils/upload';

// A link to a file on this device for as long as the component shows it; null until it is ready. The link is made and
// revoked in the effect, so a remount (React's strict mode) never shows a revoked one.
function useObjectUrl(file: File) {
	const [made, setMade] = useState<{ file: File; url: string } | null>(null);
	useEffect(() => {
		const url = URL.createObjectURL(file);
		let current = true;
		queueMicrotask(() => {
			if (current) setMade({ file, url });
		});
		return () => {
			current = false;
			URL.revokeObjectURL(url);
		};
	}, [file]);
	return made?.file === file ? made.url : null;
}

const frame = 'w-full rounded-box border border-base-300 bg-base-200';

function Pdf({ src, name }: { src: string; name: string }) {
	return (
		<div className="flex flex-col gap-2">
			<iframe title={name} src={src} className={`${frame} h-72`} />
			<a
				href={src}
				target="_blank"
				rel="noreferrer"
				className="link link-hover w-fit text-sm"
			>
				Open {name}
			</a>
		</div>
	);
}

function Picture({ src, label }: { src: string; label: string }) {
	return (
		<ImageViewer src={src} label={`View ${label}`} className="!rounded-box w-full">
			<img src={src} alt={label} className={`${frame} h-40 object-contain`} />
		</ImageViewer>
	);
}

function Shown({
	src,
	mimeType,
	name,
	label,
}: {
	src: string;
	mimeType: string;
	name: string;
	label: string;
}) {
	return mimeType === PDF_TYPE ? (
		<Pdf src={src} name={name} />
	) : (
		<Picture src={src} label={label} />
	);
}

function Local({ file, label }: { file: File; label: string }) {
	const src = useObjectUrl(file);
	return src && <Shown src={src} mimeType={file.type} name={file.name} label={label} />;
}

// A proof file as it is: a picture (click to see it large) or a PDF in the page. Either a saved file, by its signed
// link, or a file on this device that is still being sent.
export function ProofPreview({
	label,
	saved,
	local,
}: {
	label: string;
	saved?: { url: string; mimeType: string; name: string };
	local?: File;
}) {
	if (local) return <Local file={local} label={label} />;
	return (
		saved && <Shown src={saved.url} mimeType={saved.mimeType} name={saved.name} label={label} />
	);
}
