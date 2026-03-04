const fs = require('fs');
const path = require('path');

// Language directories
const localesDir = path.join(__dirname, '../locales');
const languages = ['ar', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'tr', 'ua', 'zh'];

console.log('🔄 Updating translations from "ticket" to "claim" terminology...\n');

languages.forEach(lang => {
  const filePath = path.join(localesDir, lang, 'translation.json');
  
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  Skipping ${lang} - file not found`);
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Navigation updates
    content = content.replace(/"tickets":\s*"[^"]*Tickets[^"]*"/gi, (match) => {
      return match.replace(/Tickets/gi, 'Claims');
    });
    content = content.replace(/"ticketsDesc":\s*"[^"]*tickets[^"]*"/gi, (match) => {
      return match.replace(/tickets/gi, 'claims');
    });
    
    // General ticket references in tickets section
    content = content.replace(/"title":\s*"Support Tickets"/gi, '"title": "Support Claims"');
    content = content.replace(/"createTicket":\s*"[^"]*Ticket[^"]*"/gi, (match) => {
      return match.replace(/Ticket/gi, 'Claim');
    });
    content = content.replace(/"ticketNumber":\s*"[^"]*Ticket[^"]*"/gi, (match) => {
      return match.replace(/Ticket/gi, 'Claim');
    });
    content = content.replace(/"noTickets":\s*"[^"]*tickets[^"]*"/gi, (match) => {
      return match.replace(/tickets/gi, 'claims');
    });
    
    // Search placeholder
    content = content.replace(/"searchPlaceholder":\s*"Search tickets[^"]*"/gi, '"searchPlaceholder": "Search claims..."');
    
    // Empty state
    content = content.replace(/"title":\s*"No Tickets[^"]*"/gi, '"title": "No Claims Yet"');
    content = content.replace(/"text":\s*"[^"]*support tickets[^"]*"/gi, (match) => {
      return match.replace(/support tickets/gi, 'support claims');
    });
    content = content.replace(/"createFirst":\s*"[^"]*First Ticket[^"]*"/gi, (match) => {
      return match.replace(/Ticket/gi, 'Claim');
    });
    
    // Details section
    content = content.replace(/"title":\s*"Ticket Details"/gi, '"title": "Claim Details"');
    content = content.replace(/"backToTickets":\s*"[^"]*Tickets[^"]*"/gi, (match) => {
      return match.replace(/Tickets/gi, 'Claims');
    });
    content = content.replace(/"ticketInfo":\s*"[^"]*Ticket[^"]*"/gi, (match) => {
      return match.replace(/Ticket/gi, 'Claim');
    });
    
    // Create section
    content = content.replace(/"title":\s*"Create Support Ticket"/gi, '"title": "Create Support Claim"');
    content = content.replace(/"cardTitle":\s*"Ticket Information"/gi, '"cardTitle": "Claim Information"');
    
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ Updated ${lang}/translation.json`);
    } else {
      console.log(`○ No changes needed for ${lang}`);
    }
  } catch (error) {
    console.error(`✗ Error updating ${lang}: ${error.message}`);
  }
});

console.log('\n✅ Translation update complete!\n');
