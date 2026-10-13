import { PageIntro } from '../components/PageIntro';

const terms = [
	{
		title: '1. Acceptance of Terms',
		content:
			'By accessing or using the Transcend platform, you agree to be bound by these Terms of Service. If you are using the service on behalf of an organization or courier enterprise, you represent that you have authority to bind that entity to these terms.',
	},
	{
		title: '2. Description of Service',
		content:
			'Transcend provides a multi-tenant logistics ERP platform encompassing parcel tracking, fleet management, driver dispatch, staff administration, and financial reconciliation ledgers.',
	},
	{
		title: '3. Account Responsibilities & Security',
		content:
			'Users are responsible for maintaining the confidentiality of their login credentials and session tokens. You must notify your system administrator immediately if you suspect unauthorized access to your account or organizational workspace.',
	},
	{
		title: '4. Acceptable Use',
		content:
			'You agree not to misuse the platform, interfere with platform operations, attempt unauthorized penetration testing, reverse engineer private services, or submit fraudulent parcel and ledger entries.',
	},
	{
		title: '5. Financial & Settlement Disclaimer',
		content:
			'Financial ledgers, fee estimates, and merchant cash-on-delivery calculations provided within the platform are operational tools intended to assist organizational reconciliation. Organizations are ultimately responsible for auditing their own books and commercial settlements.',
	},
	{
		title: '6. Service Availability & Changes',
		content:
			'We continuously improve the platform and reserve the right to deploy updates, perform scheduled maintenance, or modify available features. While we strive for high uptime, the service is provided on an "as is" and "as available" basis.',
	},
	{
		title: '7. Termination',
		content:
			'We reserve the right to suspend or terminate access to accounts that violate these Terms or present operational and security risks to other tenants.',
	},
];

export function TermsPage() {
	return (
		<>
			<PageIntro
				eyebrow="Legal & Compliance"
				title="Terms of Service"
				description="The guidelines and conditions governing access to and use of the Transcend platform and services."
			/>
			<section className="mx-auto max-w-4xl px-6 pb-24 md:px-10">
				<div className="space-y-10">
					{terms.map(({ title, content }) => (
						<article key={title} className="border-t border-base-300 pt-8">
							<h2 className="text-xl font-semibold tracking-tight text-base-content">{title}</h2>
							<p className="mt-3 leading-relaxed opacity-75">{content}</p>
						</article>
					))}
				</div>
			</section>
		</>
	);
}

