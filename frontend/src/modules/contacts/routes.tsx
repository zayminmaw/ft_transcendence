import type { RouteObject } from 'react-router-dom';
import { ContactsPage } from './pages/ContactsPage';

// The app wraps every contacts route in contacts.manage_own (app/navigation.ts). The add page joins with its task.
export const contactsRoutes: RouteObject[] = [{ path: 'contacts', element: <ContactsPage /> }];
