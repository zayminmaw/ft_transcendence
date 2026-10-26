export interface ActivityListQuery {
  search?: string;
  action: 'all' | 'created' | 'details' | 'status' | 'administrators';
  tenantId?: string;
  sort: 'createdAt' | 'tenant';
  direction: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

// What the activity page shows about one change. Picked from the audit row's old and new values, so a field that
// was never meant for display (an email, an address) does not leave the server.
export interface ActivityDetails {
  reason?: string | null;
  // The administrator assigned or revoked, or the first one created with the tenant.
  administrator?: string;
  // assign: a new account or an existing member. revoke: moved to another role, or removed from the company.
  account?: 'new' | 'existing';
  revoke?: 'change_role' | 'remove';
  role?: string;
  previousRole?: string;
  // update: the tenant fields that changed.
  fields?: string[];
  // suspend: set when revoking the last administrator suspended the tenant.
  cause?: 'last_administrator_revoked';
}

export interface ActivityEvent {
  id: string;
  createdAt: Date;
  action: string;
  // Null only if the company or account has since been deleted.
  tenant: { id: string; name: string } | null;
  actor: string | null;
  details: ActivityDetails;
}

// The last ACTIVITY_COUNT_DAYS days, of one tenant when the list is narrowed to one; search and action are ignored.
export interface ActivityCounts {
  events: number;
  created: number;
  details: number;
  status: number;
  administrators: number;
}
