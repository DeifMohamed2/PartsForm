const fs = require('fs');
const path = require('path');

// Final cleanup script for remaining ticket references
const updates = [
  {
    file: 'controllers/adminController.js',
    replacements: [
      { from: /Ticket\.find\(/g, to: 'Claim.find(' },
      { from: /Ticket\.countDocuments\(/g, to: 'Claim.countDocuments(' }
    ]
  },
  {
    file: 'middleware/auth.js',
    replacements: [
      { from: /const Ticket = require\('\.\.\/models\/Ticket'\);/g, to: "const Claim = require('../models/Claim');" },
      { from: /Ticket\.countDocuments\(/g, to: 'Claim.countDocuments(' }
    ]
  },
  {
    file: 'services/socketService.js',
    replacements: [
      { from: /\(ticketId\)/g, to: '(claimId)' },
      { from: /ticketId:/g, to: 'claimId:' },
      { from: /ticketId,/g, to: 'claimId,' },
      { from: /ticketId \}/g, to: 'claimId }' },
      { from: /ticketId\)/g, to: 'claimId)' },
      { from: /data\.ticketId/g, to: 'data.claimId' },
      { from: /\{ ticketId, /g, to: '{ claimId, ' },
      { from: /emitToTicket/g, to: 'emitToClaim' },
      { from: /'ticket-new-message'/g, to: "'claim-new-message'" },
      { from: /'ticket-status-changed'/g, to: "'claim-status-changed'" },
      { from: /emitToClaim: emitToClaim:/g, to: 'emitToClaim:' },
      { from: /sockets, ticketId/g, to: 'sockets, claimId' }
    ]
  },
  {
    file: 'controllers/buyerController.js',
    replacements: [
      { from: /socketService\.notifyNewTicket\(/g, to: 'socketService.notifyNewClaim(' }
    ]
  }
];

console.log('Starting final ticket → claim cleanup...\n');

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

console.log('\n✅ Final cleanup complete!');
console.log('\nNote: The following are kept for DB compatibility:');
console.log('  - ticketNumber field name (DB field)');
console.log('  - generateTicketNumber() method name');
console.log('  - TKT- prefix in number generation');
console.log("  - mongoose.model('Ticket', ...) for collection name");
