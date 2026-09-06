/**
 * Converts the database-generated Ticket ID into the public ticket number.
 * The backend owns this identifier; the frontend never sends or chooses it.
 */
export function generateTicketNumber(ticketId: number): string {
  return `TK-${String(ticketId).padStart(6, "0")}`;
}
