import { ModulePage } from '@global-components';
import { useNavigate } from 'react-router-dom';

export function CreateTenantPage() {
	const navigate = useNavigate();
	return (
		<div className="flex flex-col gap-4">
			<ModulePage
				title="Create tenant"
				description="Organization setup and initial tenant administrator assignment."
			/>
			<div className="rounded-lg border p-4 border-base-content/20 max-w-2xl">
				<fieldset className="fieldset">
					<legend className="fieldset-legend">What is your name?</legend>
					<input type="text" className="input w-full" placeholder="Type here" />
				</fieldset>
				<fieldset className="fieldset">
					<legend className="fieldset-legend">What is your name?</legend>
					<input type="text" className="input w-full" placeholder="Type here" />
				</fieldset>
				<fieldset className="fieldset">
					<legend className="fieldset-legend">What is your name?</legend>
					<input type="text" className="input w-full" placeholder="Type here" />
				</fieldset>
				<fieldset className="fieldset">
					<legend className="fieldset-legend">What is your name?</legend>
					<input type="text" className="input w-full" placeholder="Type here" />
				</fieldset>
				<fieldset className="fieldset">
					<legend className="fieldset-legend">What is your name?</legend>
					<input type="text" className="input w-full" placeholder="Type here" />
				</fieldset>
				<fieldset className="fieldset">
					<legend className="fieldset-legend">What is your name?</legend>
					<input type="text" className="input w-full" placeholder="Type here" />
				</fieldset>
				<div className="mt-4 flex gap-2">
					<button className="btn" onClick={() => navigate(-1)}>
						Cancel
					</button>
					<button className="btn btn-primary">Create Tenant</button>
				</div>
			</div>
		</div>
	);
}
