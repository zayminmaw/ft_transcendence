import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTypeScript } from './load-typescript-for-test.js';

const workspace = {
	slug: 'meridian',
	name: 'Meridian',
	permissions: [],
	assignedPermissions: ['parcels.view', 'parcels.mark_delivered'],
};
const auth = loadTypeScript(new URL('../src/modules/auth/hooks.ts', import.meta.url), {
	'@tanstack/react-query': { useQuery: () => ({ data: { workspaces: [workspace] } }) },
	'react-router-dom': { useParams: () => ({ companySlug: 'meridian' }) },
	'@hooks/useAuth': { useAuth: () => ({ userId: '15' }) },
	'@app/store/session': {},
	'@services/session-refresh': {},
	'./api': {},
});

test('assigned grants only enable explicitly scoped UI routes, and do not become full-scope grants', () => {
	const can = auth.useCan();
	assert.equal(can('parcels.view'), false);
	assert.equal(can('parcels.mark_delivered'), false);
	assert.equal(can('parcels.view', true), true);
	assert.equal(can('parcels.mark_delivered', true), true);
	assert.equal(can('parcels.dispatch', true), false);
	const { MODULE_ACCESS, getTenantNavigation } = loadTypeScript(
		new URL('../src/app/navigation.ts', import.meta.url),
		{},
	);
	const navigation = getTenantNavigation((key) => key, '/app/meridian', can);
	const links = navigation.flatMap((group) => group.items);
	assert.equal(links.find((item) => item.to === '/app/meridian/parcels').hidden, false);
	assert.equal(links.find((item) => item.to === '/app/meridian/clients').hidden, true);
	const { RequirePermission } = loadTypeScript(
		new URL('../src/modules/auth/components/RequirePermission.tsx', import.meta.url),
		{
			'react-i18next': { useTranslation: () => ({ t: (key) => key }) },
			'react-router-dom': { Link: 'a' },
			'@global-components': { ModulePage: 'module' },
			'@hooks/useCompanyPath': { useCompanyPath: () => () => '/app/meridian' },
			'../hooks': auth,
		},
	);
	assert.equal(
		RequirePermission({ ...MODULE_ACCESS.parcels, children: 'parcel-page' }),
		'parcel-page',
	);
	assert.equal(
		RequirePermission({
			permission: 'parcels.view',
			label: 'workspace.nav.parcels',
			children: 'unscoped-page',
		}).type,
		'module',
	);
});

function nodes(node) {
	if (!node || typeof node !== 'object') return [];
	if (Array.isArray(node)) return node.flatMap(nodes);
	return [node, ...nodes(node.props?.children)];
}

test('the delivery page requires the parcel capability and sends the actual entered collection', () => {
	let parcel = {
		id: '7',
		trackingNumber: 'TRC-ABCDEFGH1',
		status: 'out_for_delivery',
		canRecordDelivery: false,
		codAmount: '120.00',
		proof: { signature: {}, photo: {}, note: null },
	};
	const requests = [];
	const values = [];
	let index = 0;
	const { RecordDeliveryPage } = loadTypeScript(
		new URL('../src/modules/parcels/pages/RecordDeliveryPage.tsx', import.meta.url),
		{
			react: {
				useState: (initial) => {
					const at = index++;
					if (!(at in values)) values[at] = initial;
					return [
						values[at],
						(next) => {
							values[at] = next;
						},
					];
				},
			},
			'react-router-dom': {
				useParams: () => ({ parcelId: '7' }),
				useNavigate: () => () => {},
				Link: 'a',
			},
			'@global-components': {
				Button: 'button',
				Input: 'input',
				ModulePage: 'module',
				Textarea: 'textarea',
				TipCard: 'tip',
				useToast: () => ({ toast() {} }),
			},
			'@hooks/useCompanyPath': { useCompanyPath: () => (path) => `/app/meridian/${path}` },
			'@utils/upload': { IMAGE_TYPES: ['image/png'], PDF_TYPE: 'application/pdf' },
			'../components/ProofField': { ProofField: 'proof' },
			'../components/SignaturePad': { SignaturePad: 'signature' },
			'../hooks/useParcelMutations': {
				useParcelMutations: () => ({
					deliverParcel: (request) => requests.push(request),
					isDelivering: false,
				}),
			},
			'../hooks/useParcels': { useParcelDetails: () => ({ parcel, isParcelPending: false }) },
			'../hooks/useProofFile': { useProofBusy: () => false },
			'../constants': { coordinatesLabel: () => '' },
		},
		{
			FormData: class {
				constructor(fields) {
					this.fields = fields;
				}
				get(name) {
					return this.fields[name];
				}
			},
		},
	);
	const render = () => {
		index = 0;
		return RecordDeliveryPage();
	};
	assert.equal(render().type, 'module');
	parcel = { ...parcel, canRecordDelivery: true };
	const form = nodes(render()).find((node) => node.type === 'form');
	const input = nodes(form).find(
		(node) => node.type === 'input' && node.props.name === 'collectedAmount',
	);
	assert.equal(input.props.required, true);
	assert.equal(input.props.defaultValue, undefined);
	form.props.onSubmit({ preventDefault() {}, currentTarget: { collectedAmount: '', notes: '' } });
	assert.equal(requests.length, 0);
	form.props.onSubmit({
		preventDefault() {},
		currentTarget: { collectedAmount: '120.00', notes: 'Handed to recipient' },
	});
	assert.equal(requests[0].values.collectedAmount, '120.00');
	assert.equal(requests[0].parcelId, '7');
	parcel = { ...parcel, status: 'delivered' };
	assert.equal(render().type, 'module');
});
