// The socket.io rooms a connection joins: everyone in a company, and one person in a company.
export const organizationRoom = (organizationId: string) => `org:${organizationId}`;
export const userRoom = (organizationId: string, userId: string) => `org:${organizationId}:user:${userId}`;
