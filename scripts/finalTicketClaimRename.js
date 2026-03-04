const fs = require('fs');
const path = require('path');

// Files to update with comprehensive ticket → claim replacements
const filesToUpdate = [
  'controllers/adminController.js',
  'middleware/auth.js',
  'services/socketService.js',
  'public/js/adminJS/admin-ticket-details.js'
];

const replacements = [
  // Variable names and comments in adminController
  { from: /recentTickets/g, to: 'recentClaims' },
  { from: /formattedTickets/g, to: 'formattedClaims' },
  { from: /pendingTicketsCount/g, to: 'pendingClaimsCount' },
  { from: /openTicketsCount/g, to: 'openClaimsCount' },
  { from: /openTickets:/g, to: 'openClaims:' },
  { from: /\{ newOrders: 0, openTickets: 0 \}/g, to: '{ newOrders: 0, openClaims: 0 }' },
  
  // Comments
  { from: /\/\/ Only fetch 5 tickets/g, to: '// Only fetch 5 claims' },
  { from: /\/\/ Format tickets/g, to: '// Format claims' },
  { from: /\/\/ Pending tickets/g, to: '// Pending claims' },
  { from: /\/\/ Count open\/in-progress tickets \(tickets that need attention\)/g, to: '// Count open/in-progress claims (claims that need attention)' },
  { from: /notification counts for orders and tickets/g, to: 'notification counts for orders and claims' },
  { from: /new orders and open tickets/g, to: 'new orders and open claims' },
  
  // Socket service - internal variables and comments
  { from: /tickets: new Map\(\)    \/\/ Map<ticketId, Set<socketId>> - users currently viewing a ticket/g, to: 'claims: new Map()    // Map<claimId, Set<socketId>> - users currently viewing a claim' },
  { from: /connections\.tickets/g, to: 'connections.claims' },
  { from: /Join a ticket room/g, to: 'Join a claim room' },
  { from: /'join-ticket'/g, to: "'join-claim'" },
  { from: /'leave-ticket'/g, to: "'leave-claim'" },
  { from: /socket\.on\('join-ticket'/g, to: "socket.on('join-claim'" },
  { from: /socket\.on\('leave-ticket'/g, to: "socket.on('leave-claim'" },
  { from: /socket\.join\(`ticket:/g, to: "socket.join(`claim:" },
  { from: /socket\.leave\(`ticket:/g, to: "socket.leave(`claim:" },
  { from: /socket\.to\(`ticket:/g, to: "socket.to(`claim:" },
  { from: /io\.to\(`ticket:/g, to: "io.to(`claim:" },
  { from: /Leave a ticket room/g, to: 'Leave a claim room' },
  { from: /Track who's viewing this ticket/g, to: "Track who's viewing this claim" },
  { from: /joined ticket room:/g, to: 'joined claim room:' },
  { from: /Broadcast to all users in the ticket room/g, to: 'Broadcast to all users in the claim room' },
  { from: /Remove from any ticket rooms/g, to: 'Remove from any claim rooms' },
  { from: /showing notifications on the tickets list page/g, to: 'showing notifications on the claims list page' },
  { from: /Emit event to a specific ticket room/g, to: 'Emit event to a specific claim room' },
  { from: /const emitToTicket = \(ticketId/g, to: 'const emitToTicket = (claimId' },
  { from: /Emit new ticket notification/g, to: 'Emit new claim notification' },
  { from: /const notifyNewTicket = \(ticket\)/g, to: 'const notifyNewClaim = (claim)' },
  { from: /'ticket-created'/g, to: "'claim-created'" },
  { from: /ticketId: ticket\.ticketNumber/g, to: 'claimId: claim.ticketNumber' },
  { from: /subject: ticket\.subject/g, to: 'subject: claim.subject' },
  { from: /buyerName: ticket\.buyerName/g, to: 'buyerName: claim.buyerName' },
  { from: /category: ticket\.category/g, to: 'category: claim.category' },
  { from: /priority: ticket\.priority/g, to: 'priority: claim.priority' },
  { from: /Emit ticket update notification/g, to: 'Emit claim update notification' },
  { from: /const notifyTicketUpdate = \(ticketId/g, to: 'const notifyClaimUpdate = (claimId' },
  { from: /'ticket-updated'/g, to: "'claim-updated'" },
  { from: /Get users currently viewing a ticket/g, to: 'Get users currently viewing a claim' },
  { from: /const getTicketViewers = \(ticketId\)/g, to: 'const getClaimViewers = (claimId)' },
  { from: /emitToTicket,/g, to: 'emitToClaim: emitToTicket, // Alias maintained for compatibility' },
  { from: /notifyNewTicket,/g, to: 'notifyNewClaim,' },
  { from: /notifyNewClaim: \(payload\) => module\.exports\.notifyNewTicket\(payload\), \/\/ Alias/g, to: '' },
  { from: /notifyTicketUpdate,/g, to: 'notifyClaimUpdate,' },
  { from: /notifyClaimUpdate: \(payload\) => module\.exports\.notifyTicketUpdate\(payload\), \/\/ Alias/g, to: '' },
  { from: /getTicketViewers/g, to: 'getClaimViewers' },
  { from: /Handles real-time communication for the ticket\/chat system/g, to: 'Handles real-time communication for the claim/chat system' },
  { from: /need to know the buyer ID for this ticket/g, to: 'need to know the buyer ID for this claim' },
  
  // Admin ticket details JS
  { from: /\/\/ Ticket number like TKT-202602-0001/g, to: '// Claim number like TKT-202602-0001' },
  { from: /var ticketOid = null;/g, to: 'var claimOid = null;' },
  { from: /ticketOid =/g, to: 'claimOid =' },
  { from: /window\.adminTicketId/g, to: 'window.adminClaimId' },
  { from: /window\.adminTicketOid/g, to: 'window.adminClaimOid' },
  { from: /dataset\.ticketOid/g, to: 'dataset.claimOid' },
  { from: /Mark ticket as read/g, to: 'Mark claim as read' },
  { from: /Mark ticket as resolved/g, to: 'Mark claim as resolved' },
  { from: /Close ticket/g, to: 'Close claim' }
];

console.log('Starting comprehensive ticket → claim renaming in remaining files...\n');

filesToUpdate.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  
  replacements.forEach(({ from, to }) => {
    if (content.match(from)) {
      content = content.replace(from, to);
      hasChanges = true;
    }
  });
  
  if (hasChanges) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Updated ${file}`);
  } else {
    console.log(`- No changes needed for ${file}`);
  }
});

console.log('\n✅ Comprehensive ticket → claim renaming complete!');
