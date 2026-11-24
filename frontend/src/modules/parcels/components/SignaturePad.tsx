import { useRef, useState, type PointerEvent } from 'react';

// Draws with a mouse, finger or stylus. White with a dark line in every theme, so the signature is always readable.
// "Use signature" hands it over as a PNG file.
export function SignaturePad({
	onSave,
	disabled = false,
}: {
	onSave: (file: File) => void;
	disabled?: boolean;
}) {
	const canvas = useRef<HTMLCanvasElement>(null);
	const [drawn, setDrawn] = useState(false);

	const position = (event: PointerEvent<HTMLCanvasElement>) => {
		// The canvas is drawn at a fixed size and stretched by CSS, so screen positions need scaling.
		const box = event.currentTarget.getBoundingClientRect();
		return {
			x: ((event.clientX - box.left) * event.currentTarget.width) / box.width,
			y: ((event.clientY - box.top) * event.currentTarget.height) / box.height,
		};
	};

	const start = (event: PointerEvent<HTMLCanvasElement>) => {
		const context = event.currentTarget.getContext('2d');
		if (!context) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		const { x, y } = position(event);
		context.lineWidth = 2;
		context.lineCap = 'round';
		context.strokeStyle = '#111111';
		context.beginPath();
		context.moveTo(x, y);
	};

	// The browser keeps the capture until the pointer is released, so it also says whether a stroke is under way.
	const draw = (event: PointerEvent<HTMLCanvasElement>) => {
		const context = event.currentTarget.getContext('2d');
		if (!context || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
		const { x, y } = position(event);
		context.lineTo(x, y);
		context.stroke();
		setDrawn(true);
		// Start the next segment here, so each move draws only the new part of the line.
		context.beginPath();
		context.moveTo(x, y);
	};

	const clear = () => {
		const element = canvas.current;
		element?.getContext('2d')?.clearRect(0, 0, element.width, element.height);
		setDrawn(false);
	};

	// On a white background, so the saved picture reads like the pad does.
	const save = () => {
		const element = canvas.current;
		if (!element) return;
		const copy = document.createElement('canvas');
		copy.width = element.width;
		copy.height = element.height;
		const context = copy.getContext('2d');
		if (!context) return;
		context.fillStyle = '#ffffff';
		context.fillRect(0, 0, copy.width, copy.height);
		context.drawImage(element, 0, 0);
		copy.toBlob((blob) => {
			if (blob) onSave(new File([blob], 'signature.png', { type: 'image/png' }));
		}, 'image/png');
	};

	return (
		<div className="flex flex-col gap-2">
			<canvas
				ref={canvas}
				width={600}
				height={200}
				role="img"
				aria-label="Recipient signature pad"
				className="h-40 w-full cursor-crosshair touch-none rounded-box border border-base-300 bg-white"
				onPointerDown={start}
				onPointerMove={draw}
			/>
			<div className="flex flex-wrap items-center gap-2">
				<button
					type="button"
					className="btn btn-sm border-0 bg-base-200"
					disabled={!drawn || disabled}
					onClick={save}
				>
					Use signature
				</button>
				<button
					type="button"
					className="btn btn-ghost btn-sm"
					disabled={!drawn || disabled}
					onClick={clear}
				>
					Clear
				</button>
				<p className="text-sm text-[var(--color-slate)]">
					Ask the recipient to sign, then use the signature.
				</p>
			</div>
		</div>
	);
}
