import { useState } from 'react';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from './Input';

// A password field with an eye button at its end that shows or hides what was typed.
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, 'type' | 'suffix'>) {
	const { t } = useTranslation();
	const [visible, setVisible] = useState(false);

	return (
		<Input
			{...props}
			type={visible ? 'text' : 'password'}
			suffix={
				<button
					type="button"
					className="btn btn-ghost btn-sm btn-square"
					aria-label={t('password.show')}
					aria-pressed={visible}
					onClick={() => setVisible((shown) => !shown)}
				>
					<EyeIcon crossed={visible} />
				</button>
			}
		/>
	);
}

// The eye while the password is hidden; the crossed-out eye while it is shown.
function EyeIcon({ crossed }: { crossed: boolean }) {
	return (
		<svg
			aria-hidden="true"
			className="h-[1.1em]"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{crossed ? (
				<>
					<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
					<path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
					<path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
					<path d="m2 2 20 20" />
				</>
			) : (
				<>
					<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
					<circle cx="12" cy="12" r="3" />
				</>
			)}
		</svg>
	);
}
