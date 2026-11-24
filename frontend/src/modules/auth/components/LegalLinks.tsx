import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

// The Privacy Policy and Terms of Service pages from the website, so they're one click away from the login page
// and from inside the app too.
export function LegalLinks({ className = '' }: { className?: string }) {
	const { t } = useTranslation('auth');

	return (
		<nav
			aria-label={t('legal.label')}
			className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--color-slate)] ${className}`}
		>
			<Link to="/privacy" className="link link-hover">
				{t('legal.privacy')}
			</Link>
			<Link to="/terms" className="link link-hover">
				{t('legal.terms')}
			</Link>
		</nav>
	);
}
