import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';

// Both codes carry the tracking number. Scanners need dark bars on white, so the panel stays white in every theme.
export function WaybillCodes({ tracking }: { tracking: string }) {
	const barcode = useRef<SVGSVGElement>(null);

	useEffect(() => {
		if (barcode.current) {
			JsBarcode(barcode.current, tracking, {
				format: 'CODE128',
				height: 56,
				margin: 0,
				displayValue: false,
			});
		}
	}, [tracking]);

	return (
		<section
			aria-labelledby="waybill-title"
			className="rounded-box border border-base-300 p-6 md:p-8"
		>
			<h2 id="waybill-title" className="text-lg font-semibold">
				Waybill
			</h2>
			<div className="mt-6 flex flex-col items-center gap-4 rounded-box bg-white p-4 text-black">
				<svg
					ref={barcode}
					role="img"
					aria-label={`Barcode for ${tracking}`}
					className="h-auto max-w-full"
				/>
				<QRCodeSVG value={tracking} size={112} title={`QR code for ${tracking}`} />
				<p dir="ltr" className="text-sm font-medium">
					{tracking}
				</p>
			</div>
		</section>
	);
}
