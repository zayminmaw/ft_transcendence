import type { RouteObject } from 'react-router-dom';
import { AddContactPage } from './pages/AddContactPage';
import { ContactsPage } from './pages/ContactsPage';

// The app wraps every contacts route in contacts.manage_own (app/navigation.ts).
export const contactsRoutes: RouteObject[] = [
	{ path: 'contacts', element: <ContactsPage /> },
	{ path: 'contacts/add', element: <AddContactPage /> },
];
