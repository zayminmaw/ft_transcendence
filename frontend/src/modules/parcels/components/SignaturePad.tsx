import { useRef, type PointerEvent } from 'react';

// Draws with a mouse, finger or stylus. White with a dark line in every theme, so the signature is always readable.
export function SignaturePad() {
	const canvas = useRef<HTMLCanvasElement>(null);

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
		// Start the next segment here, so each move draws only the new part of the line.
		context.beginPath();
		context.moveTo(x, y);
	};

	const clear = () => {
		const element = canvas.current;
		element?.getContext('2d')?.clearRect(0, 0, element.width, element.height);
	};

	return (
		<div>
			<div className="mb-2 flex items-center justify-between gap-2">
				<p className="text-sm font-medium">Recipient signature *</p>
				<button type="button" className="link link-hover text-sm" onClick={clear}>
					Clear
				</button>
			</div>
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
		</div>
	);
}
