import { PageIntro } from '../components/PageIntro';

const sections = [
	{
		title: '1. Information We Collect',
		content:
			'Transcend collects information required to provide multi-tenant courier and logistics management services. This includes account credentials (such as 42 Intra login credentials and email), profile details, organization memberships, parcel waybill data, recipient contact information, driver assignments, and vehicle asset records.',
	},
	{
		title: '2. Operational & Telemetry Data',
		content:
			'To facilitate accurate dispatch and proof of delivery, our platform may process operational telemetry such as delivery timestamps, status update events, and geographic coordinates associated with parcel handoffs.',
	},
	{
		title: '3. Data Security & Tenant Isolation',
		content:
			'We implement strict organizational boundaries to protect tenant data. Data is protected in transit using HTTPS (TLS encryption) and access is strictly governed by role-based access control (RBAC). Data belonging to one organization is logically isolated and inaccessible to unauthorized tenants.',
	},
	{
		title: '4. Third-Party Services & OAuth',
		content:
			'Transcend integrates with third-party authentication providers, including the 42 School OAuth 2.0 API. When you authenticate using 42, we only retrieve authorized profile information necessary to verify your identity and manage workspace membership.',
	},
	{
		title: '5. Retention & Your Rights',
		content:
			'Logistics and financial ledger records are retained in accordance with operational and audit requirements. Users have the right to inspect their personal information, request corrections, or request account deactivation through their organization administrator.',
	},
	{
		title: '6. Updates & Contact',
		content:
			'We may update this Privacy Policy from time to time. If you have questions regarding data privacy or compliance, please reach out to the Transcend platform team via the contact form or through your system administrator.',
	},
];

export function PrivacyPage() {
	return (
		<>
			<PageIntro
				eyebrow="Legal & Compliance"
				title="Privacy Policy"
				description="How Transcend collects, safeguards, and handles organizational and personal data across our courier logistics workspace."
			/>
			<section className="mx-auto max-w-4xl px-6 pb-24 md:px-10">
				<div className="space-y-10">
					{sections.map(({ title, content }) => (
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

