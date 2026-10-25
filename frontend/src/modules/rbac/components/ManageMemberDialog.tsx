import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog } from '@global-components';
import { formatDate } from '@utils/format';
import type { Member } from '../api';
import { errorCode, memberErrorKey } from '../errors';
import { useResetMemberPassword, useSetMemberActive } from '../hooks';

type Step = 'details' | 'confirmActive' | 'confirmReset' | 'password';

// One person's access in this company: switch the membership off or on, or reset a forgotten password. The one-time
// password lives only in this dialog's state; closing the dialog unmounts it and the password is gone, so while it
// shows only the Close button closes the dialog.
export function ManageMemberDialog({
	member,
	company,
	onClose,
}: {
	member: Member;
	company: string;
	onClose: () => void;
}) {
	const { t, i18n } = useTranslation('rbac');
	const [step, setStep] = useState<Step>('details');
	const [temporaryPassword, setTemporaryPassword] = useState('');
	const [copied, setCopied] = useState(false);
	const setActive = useSetMemberActive();
	const reset = useResetMemberPassword();
	// Only the refusal of what this step asks for: a mutation keeps its error until it runs again, so an earlier
	// refusal would otherwise stay under the next step, even under a change that worked.
	const failure =
		step === 'confirmActive' ? setActive.error : step === 'confirmReset' ? reset.error : null;
	const name = member.username;

	const cancel = (
		<button
			type="button"
			className="btn btn-ghost bg-base-200"
			onClick={() => setStep('details')}
		>
			{t('manage.cancel')}
		</button>
	);
	const close = (
		<button type="button" className="btn btn-ghost bg-base-200" onClick={onClose}>
			{t('manage.close')}
		</button>
	);

	let description = t('manage.description', { company });
	let body = null;
	let actions = (
		<>
			{close}
			<button
				type="button"
				className="btn btn-ghost bg-base-200"
				onClick={() => setStep('confirmReset')}
			>
				{t('manage.reset')}
			</button>
			<Button onClick={() => setStep('confirmActive')}>
				{member.isActive ? t('manage.deactivate') : t('manage.reactivate')}
			</Button>
		</>
	);

	if (step === 'confirmActive') {
		description = member.isActive
			? t('manage.deactivateConfirm', { name, company })
			: t('manage.reactivateConfirm', { name, company });
		actions = (
			<>
				{cancel}
				<Button
					disabled={setActive.isPending}
					onClick={() =>
						setActive.mutate(
							{ userId: member.userId, isActive: !member.isActive },
							{ onSuccess: () => setStep('details') },
						)
					}
				>
					{member.isActive ? t('manage.deactivate') : t('manage.reactivate')}
				</Button>
			</>
		);
	} else if (step === 'confirmReset') {
		description = t('manage.resetConfirm', { name });
		actions = (
			<>
				{cancel}
				<Button
					disabled={reset.isPending}
					onClick={() =>
						reset.mutate(member.userId, {
							onSuccess: (answer) => {
								setTemporaryPassword(answer.temporaryPassword);
								setStep('password');
							},
						})
					}
				>
					{t('manage.reset')}
				</Button>
			</>
		);
	} else if (step === 'password') {
		description = t('manage.passwordIntro', { name });
		body = (
			<div className="flex flex-col gap-3">
				<p
					className="rounded-box bg-base-200 p-4 text-center font-mono text-2xl tracking-wider"
					dir="ltr"
				>
					{temporaryPassword}
				</p>
				<p className="text-sm text-[var(--color-slate)]">{t('manage.passwordNote')}</p>
			</div>
		);
		actions = (
			<>
				{close}
				<Button
					onClick={() =>
						void navigator.clipboard
							.writeText(temporaryPassword)
							.then(() => setCopied(true))
					}
				>
					{copied ? t('manage.copied') : t('manage.copy')}
				</Button>
			</>
		);
	}

	return (
		<Dialog
			open
			onClose={onClose}
			title={t('manage.title', { name })}
			description={description}
			actions={actions}
			dismissible={step !== 'password'}
		>
			{step === 'details' && (
				<dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
					<dt className="text-[var(--color-slate)]">{t('manage.email')}</dt>
					<dd>{member.email}</dd>
					<dt className="text-[var(--color-slate)]">{t('manage.role')}</dt>
					<dd>{member.role.name}</dd>
					<dt className="text-[var(--color-slate)]">{t('manage.status')}</dt>
					<dd>
						{member.isActive
							? member.mustChangePassword
								? t('status.mustChange')
								: t('status.active')
							: t('status.inactive')}
					</dd>
					<dt className="text-[var(--color-slate)]">{t('manage.lastLogin')}</dt>
					<dd>
						{member.lastLoginAt
							? formatDate(new Date(member.lastLoginAt), i18n.language, {
									dateStyle: 'medium',
									timeStyle: 'short',
								})
							: t('table.never')}
					</dd>
				</dl>
			)}
			{body}
			{failure && (
				<p role="alert" className="alert alert-error alert-soft text-sm">
					{t(memberErrorKey(failure))}
					{errorCode(failure) === 'MEMBER_NOT_FOUND' && ` ${t('manage.listReloaded')}`}
				</p>
			)}
		</Dialog>
	);
}
