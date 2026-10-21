import { useParams } from 'react-router-dom';

// Links inside a company keep its slug: companyPath('parcels') is /app/meridian-courier/parcels.
export function useCompanyPath() {
	const { companySlug } = useParams();
	return (path = '') => `/app/${companySlug}${path && `/${path}`}`;
}
