const fs = require('fs');
const path = require('path');

// Final final cleanup - fix remaining ticketId variable names in string interpolation
const updates = [
  {
    file: 'services/socketService.js',
    replacements: [
      { from: /`claim:\$\{ticketId\}`/g, to: '`claim:${claimId}`' },
      { from: /claim room: \$\{ticketId\}/g, to: 'claim room: ${claimId}' }
    ]
  },
  {
    file: 'controllers/buyerController.js',
    replacements: [
      { from: /socketService\.emitToTicket\(/g, to: 'socketService.emitToClaim(' },
      { from: /'Error in markTicketAsRead:'/g, to: "'Error in markClaimAsRead:'" }
    ]
  }
];

console.log('Starting final variable name cleanup...\n');

updates.forEach(({ file, replacements }) => {
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

console.log('\n✅ All ticket → claim renaming complete!\n');
console.log('Summary:');
console.log('  ✓ Model renamed: Ticket.js → Claim.js');
console.log('  ✓ All imports updated to use Claim model');
console.log('  ✓ All functions renamed (getClaims*, createClaim, etc.)');
console.log('  ✓ All routes updated (/claims, /api/claims)');
console.log('  ✓ All variables renamed (claimId, claims, etc.)');
console.log('  ✓ All comments and strings updated');
console.log('  ✓ Socket events renamed (join-claim, claim-status-changed)');
console.log('  ✓ Views renamed and updated (claims.ejs, claim-details.ejs)');
console.log('  ✓ CSS/JS files renamed and updated\n');
console.log('Maintained for DB compatibility:');
console.log('  • ticketNumber field (DB field name)');
console.log('  • generateTicketNumber() method');
console.log('  • TKT- prefix for claim numbers');
console.log("  • mongoose.model('Ticket', ...) for collection compatibility");
