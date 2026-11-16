import { shownName } from '@modules/auth';
import type { Contact } from '../api';

type Role = Contact['role'];

// The roles that appear in a list, one each, for the role filter.
export function distinctRoles(contacts: Contact[]): Role[] {
	return [...new Map(contacts.map(({ role }) => [role.code, role])).values()];
}

// 'all' keeps every role. The search matches the name the person chose or their username.
export function filterContacts(contacts: Contact[], search: string, roleCode: string): Contact[] {
	const needle = search.trim().toLowerCase();
	return contacts.filter(
		(contact) =>
			(roleCode === 'all' || contact.role.code === roleCode) &&
			(!needle ||
				[contact.username, contact.displayName ?? ''].some((text) =>
					text.toLowerCase().includes(needle),
				)),
	);
}

export type ContactGroupData = { role: Role; contacts: Contact[] };

// One group per role, groups and people in alphabetical order for the current language.
export function groupByRole(
	contacts: Contact[],
	roleName: (role: Role) => string,
	language: string,
): ContactGroupData[] {
	const collator = new Intl.Collator(language);
	const groups = new Map<string, ContactGroupData>();
	for (const contact of contacts) {
		const group = groups.get(contact.role.code) ?? { role: contact.role, contacts: [] };
		group.contacts.push(contact);
		groups.set(contact.role.code, group);
	}
	return [...groups.values()]
		.map(({ role, contacts: people }) => ({
			role,
			contacts: people.sort((a, b) => collator.compare(shownName(a), shownName(b))),
		}))
		.sort((a, b) => collator.compare(roleName(a.role), roleName(b.role)));
}
