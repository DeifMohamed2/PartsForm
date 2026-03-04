#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Files to process
const filesToProcess = [
  // CSS Files
  'public/css/adminCSS/admin-claims.css',
  'public/css/adminCSS/admin-responsive.css',
  'public/css/buyerCSS/create-claim.css',
  'public/css/buyerCSS/claim-details.css',
  'public/css/buyerCSS/claims.css',
  'public/css/rtl.css',
  
  // JavaScript Files
  'public/js/claim-details.js',
  'public/js/claims.js',
  'public/js/adminJS/admin-ticket-details.js',
  
  // View Files
  'views/admin/claims.ejs',
  'views/admin/claim-details.ejs',
  'views/buyer/claims.ejs',
  'views/buyer/claim-details.ejs',
  'views/buyer/create-claim.ejs',
];

// Replacement patterns
const replacements = [
  // CSS class names and IDs
  { from: /ticket-/g, to: 'claim-' },
  { from: /tickets-/g, to: 'claims-' },
  { from: /'tickets'/g, to: "'claims'" },
  { from: /"tickets"/g, to: '"claims"' },
  { from: /\/tickets/g, to: '/claim-support' },
  { from: /\/api\/tickets/g, to: '/api/claims' },
  
  // Variable names
  { from: /allTickets/g, to: 'allClaims' },
  { from: /currentTicket/g, to: 'currentClaim' },
  { from: /currentTickets/g, to: 'currentClaims' },
  { from: /ticketId/g, to: 'claimId' },
  { from: /ticketsList/g, to: 'claimsList' },
  { from: /ticketsEmpty/g, to: 'claimsEmpty' },
  { from: /loadTickets/g, to: 'loadClaims' },
  { from: /loadTicketData/g, to: 'loadClaimData' },
  { from: /renderTickets/g, to: 'renderClaims' },
  { from: /updateTicketHeader/g, to: 'updateClaimHeader' },
  { from: /updateTicketInfo/g, to: 'updateClaimInfo' },
  { from: /initializeTickets/g, to: 'initializeClaims' },
  
  // Comments and strings
  { from: /Ticket Details/g, to: 'Claim Details' },
  { from: /Ticket details/g, to: 'Claim details' },
  { from: /Tickets Page/gi, to: 'Claims Page' },
  { from: /Support Tickets/g, to: 'Claim Support' },
  { from: /support tickets/g, to: 'claim support' },
  { from: /Loading tickets/g, to: 'Loading claims' },
  { from: /loading tickets/g, to: 'loading claims' },
  { from: /load tickets/g, to: 'load claims' },
  { from: /ticket list/g, to: 'claim list' },
  { from: /Ticket list/g, to: 'Claim list' },
  { from: /ticket management/g, to: 'claim management' },
  { from: /Ticket management/g, to: 'Claim management' },
  { from: /CREATE TICKET/g, to: 'CREATE CLAIM' },
  { from: /Create Ticket/g, to: 'Create Claim' },
  { from: /create ticket/g, to: 'create claim' },
  { from: /new ticket/g, to: 'new claim' },
  { from: /New ticket/g, to: 'New claim' },
  { from: /Admin Tickets/g, to: 'Admin Claims' },
  { from: /'join-ticket'/g, to: "'join-claim'" },
  { from: /'leave-ticket'/g, to: "'leave-claim'" },
  { from: /'ticket-status-changed'/g, to: "'claim-status-changed'" },
  { from: /Ticket status/g, to: 'Claim status' },
  { from: /ticket status/g, to: 'claim status' },
  { from: /Ticket ID/g, to: 'Claim ID' },
  { from: /ticket ID/g, to: 'claim ID' },
  { from: /Ticket not found/g, to: 'Claim not found' },
  { from: /ticket not found/g, to: 'claim not found' },
  { from: /ticket room/g, to: 'claim room' },
  { from: /Ticket room/g, to: 'Claim room' },
  { from: /This ticket/g, to: 'This claim' },
  { from: /this ticket/g, to: 'this claim' },
];

console.log('Starting ticket to claim renaming...\n');

filesToProcess.forEach(relPath => {
  const filePath = path.join(__dirname, '..', relPath);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${relPath} - file not found`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    replacements.forEach(({ from, to }) => {
      if (content.match(from)) {
        content = content.replace(from, to);
        modified = true;
      }
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Updated ${relPath}`);
    } else {
      console.log(`- No changes needed for ${relPath}`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${relPath}:`, error.message);
  }
});

console.log('\n✅ Ticket to claim renaming complete!');
