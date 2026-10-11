import { Link } from 'react-router-dom';
import { PageIntro } from '../components/PageIntro';

export function NotFoundPage() {
	return <><PageIntro eyebrow="404" title="This route leads nowhere." description="Head back to the homepage to explore Transcend." /><div className="mx-auto max-w-7xl px-6 pb-24 md:px-10"><Link to="/" className="btn btn-primary">Back to home</Link></div></>;
}
