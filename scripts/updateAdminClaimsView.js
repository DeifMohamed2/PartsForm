const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../views/admin/claims.ejs');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all ticket references with claim
content = content.replace(/pageTitle: 'Tickets'/g, "pageTitle: 'Claims'");
content = content.replace(/id="ticketsSearch"/g, 'id="claimsSearch"');
content = content.replace(/placeholder="Search tickets..."/g, 'placeholder="Search claims..."');
content = content.replace(/tickets\./g, 'claims.');
content = content.replace(/\(function\(ticket\)/g, '(function(claim)');
content = content.replace(/Open Tickets/g, 'Open Claims');
content = content.replace(/Total Tickets/g, 'Total Claims');
content = content.replace(/No Tickets Found/g, 'No Claims Found');
content = content.replace(/<% tickets\.forEach/g, '<% claims.forEach');
content = content.replace(/ticket\./g, 'claim.');
content = content.replace(/ticket,/g, 'claim,');
content = content.replace(/ticket %>/g, 'claim %>');
content = content.replace(/ticket\)/g, 'claim)');
content = content.replace(/ticket;/g, 'claim;');
content = content.replace(/\/admin\/claim-support\/<%= claim\.id %>/g, '/admin/claims/<%= claim.id %>');
content = content.replace(/Ticket Alerts/g, 'Claim Alerts');
content = content.replace(/support tickets/g, 'support claims');

fs.writeFileSync(filePath, content, 'utf8');
console.log('✓ Updated views/admin/claims.ejs');
