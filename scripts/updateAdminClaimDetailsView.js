const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../views/admin/claim-details.ejs');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all ticket references with claim
content = content.replace(/data-claim-id="<%= ticket\./g, 'data-claim-id="<%= claim.');
content = content.replace(/data-claim-oid="<%= ticket\./g, 'data-claim-oid="<%= claim.');
content = content.replace(/pageTitle: 'Ticket Chat'/g, "pageTitle: 'Claim Chat'");
content = content.replace(/Back to Tickets/g, 'Back to Claims');
content = content.replace(/<!-- Ticket Info -->/g, '<!-- Claim Info -->');
content = content.replace(/<i data-lucide="ticket"><\/i> Ticket Information/g, '<i data-lucide="ticket"></i> Claim Information');
content = content.replace(/<%= ticket\./g, '<%= claim.');
content = content.replace(/ticket\./g, 'claim.');
content = content.replace(/closeTicket\(\)/g, 'closeClaim()');
content = content.replace(/Close Ticket/g, 'Close Claim');
content = content.replace(/ticket %>/g, 'claim %>');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Updated views/admin/claim-details.ejs');
