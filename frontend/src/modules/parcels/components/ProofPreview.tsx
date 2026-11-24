import { useCallback, useEffect, useRef, useState } from 'react';
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

function Pdf({ src, name, onError }: { src: string; name: string; onError?: () => void }) {
	return (
		<div className="flex flex-col gap-2">
			<iframe title={name} src={src} onError={onError} className={`${frame} h-72`} />
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

function Picture({ src, label, onError }: { src: string; label: string; onError?: () => void }) {
	return (
		<ImageViewer src={src} label={`View ${label}`} className="!rounded-box w-full">
			<img
				src={src}
				alt={label}
				onError={onError}
				className={`${frame} h-40 object-contain`}
			/>
		</ImageViewer>
	);
}

function Shown({
	src,
	mimeType,
	name,
	label,
	onError,
}: {
	src: string;
	mimeType: string;
	name: string;
	label: string;
	onError?: () => void;
}) {
	return mimeType === PDF_TYPE ? (
		<Pdf src={src} name={name} onError={onError} />
	) : (
		<Picture src={src} label={label} onError={onError} />
	);
}

function Local({ file, label }: { file: File; label: string }) {
	const src = useObjectUrl(file);
	return src && <Shown src={src} mimeType={file.type} name={file.name} label={label} />;
}

function proofLinkExpiresAt(url: string): number | null {
	const exp = new URL(url, 'https://proof.invalid').searchParams.get('exp');
	const seconds = Number(exp);
	return exp !== null && Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

type SavedProof = { url: string; mimeType: string; name: string };

// Remounted for each new signed URL. A failed request pauses renewal until Retry; there is no retry loop.
function Saved({
	saved,
	label,
	onRefresh,
}: {
	saved: SavedProof;
	label: string;
	onRefresh: () => Promise<void>;
}) {
	const expiry = proofLinkExpiresAt(saved.url);
	const [state, setState] = useState<'ready' | 'refreshing' | 'failed'>(() =>
		expiry !== null && Date.now() >= expiry - 30_000 ? 'refreshing' : 'ready',
	);
	const pending = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const refresh = useCallback(() => {
		if (pending.current) return;
		clearTimeout(timer.current);
		pending.current = true;
		setState('refreshing');
		// A new URL remounts this component. If no replacement arrived, keep the old preview hidden and offer Retry.
		void onRefresh()
			.then(
				() => setState('failed'),
				() => setState('failed'),
			)
			.finally(() => {
				pending.current = false;
			});
	}, [onRefresh]);
	useEffect(() => {
		if (expiry === null) return;
		timer.current = setTimeout(refresh, Math.max(0, expiry - Date.now() - 30_000));
		return () => clearTimeout(timer.current);
	}, [expiry, refresh]);
	if (state !== 'ready') {
		return (
			<div className="flex flex-col gap-2 text-sm" aria-live="polite">
				<p role={state === 'failed' ? 'alert' : 'status'}>
					{state === 'failed'
						? `Could not refresh ${label}. Try again.`
						: `Refreshing ${label}…`}
				</p>
				{state === 'failed' && (
					<button type="button" className="btn btn-sm w-fit" onClick={refresh}>
						Retry
					</button>
				)}
			</div>
		);
	}
	return (
		<div
			onClickCapture={(event) => {
				// Background-tab timers can be delayed: never open a URL that expired while the tab was asleep.
				if (expiry !== null && Date.now() >= expiry) {
					event.preventDefault();
					event.stopPropagation();
					refresh();
				}
			}}
		>
			<Shown
				src={saved.url}
				mimeType={saved.mimeType}
				name={saved.name}
				label={label}
				onError={refresh}
			/>
		</div>
	);
}

// A proof file as it is: a picture (click to see it large) or a PDF in the page. Either a saved file, by its signed
// link, or a file on this device that is still being sent.
export function ProofPreview({
	label,
	saved,
	local,
	onRefresh,
}: {
	label: string;
	saved?: SavedProof;
	local?: File;
	onRefresh?: () => Promise<void>;
}) {
	if (local) return <Local file={local} label={label} />;
	return (
		saved &&
		onRefresh && <Saved key={saved.url} saved={saved} label={label} onRefresh={onRefresh} />
	);
}
