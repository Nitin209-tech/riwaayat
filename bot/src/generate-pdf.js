const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

async function main() {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  const outputDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputFilePath = path.join(outputDir, 'Riwaayat-Bot-Manual.pdf');
  doc.pipe(fs.createWriteStream(outputFilePath));

  // --- HELPER FOR SECTION HEADER ---
  function addSectionHeader(title) {
    doc.moveDown(1.5);
    const y = doc.y;
    doc.rect(40, y, 515, 20).fill('#2B2D31');
    doc.fillColor('#FFFFFF')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text(title.toUpperCase(), 50, y + 4);
    doc.moveDown(1.2);
  }

  // --- HELPER FOR COMMAND LINE ---
  function addCommandLine(command, desc) {
    doc.fillColor('#7396F1')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(command, { continued: true });
    doc.fillColor('#DBDEE1')
       .font('Helvetica')
       .text(` - ${desc}`);
    doc.moveDown(0.4);
  }

  // ==================== PAGE 1 ====================
  // Header Box
  doc.rect(40, 40, 515, 80).fill('#1A1A1E');
  doc.fillColor('#FFFFFF')
     .fontSize(22)
     .font('Helvetica-Bold')
     .text('RIWAAYAT BOT MANUAL', 60, 58);
  doc.fillColor('#5865F2')
     .fontSize(11)
     .font('Helvetica-Bold')
     .text('THE ULTIMATE TELEMETRY & PROOFMAKE MANUAL', 60, 88);

  doc.y = 140;

  doc.fillColor('#DBDEE1')
     .fontSize(10.5)
     .font('Helvetica')
     .text('Yeh manual aapke Discord Riwaayat Bot ki sabhi commands aur features ko acche se samajhne ke liye banaya gaya hai. Isme aapko har ek command ki details aur custom visual proof engine (/proofmake) ke exact templates milenge.', 40, doc.y, { align: 'justify', width: 515 });

  addSectionHeader('1. MEMBER COMMANDS (Normal Users ke liye)');

  addCommandLine('/invites', 'User apna khud ka accurate invite count dekh sakta hai (Active, Leaved, Fake aur Total).');
  addCommandLine('/leaderboard', 'Server ke top 10 inviters ki list real-time mein dikhata hai.');
  addCommandLine('/claim', 'Invites complete hone par user isse direct reward ticket ke andar claim kar sakta hai.');
  addCommandLine('/stock', 'Server mein kitne gift cards ya codes bache hain (Stock check karne ke liye).');
  addCommandLine('/help', 'Bot ke saare details aur guidelines dikhane ke liye help window open karta hai.');

  addSectionHeader('2. ADMIN & STAFF COMMANDS (Control & Settings)');

  addCommandLine('/panel', 'Ultimate control room! Isse pure bot ke events, config, tickets aur agents ko manage kiya jata hai.');
  addCommandLine('/sendticketpanel', 'Server mein support/reward ticket open karne wala banner post karta.');
  addCommandLine('/deletetickets', 'Closed aur inactive tickets ko bulk mein delete karke channels clean karta hai.');
  addCommandLine('/revoke', 'Server ki invite links ko delete karta hai (Admins ki links ko safe rakhta hai).');
  addCommandLine('/dbstatus', 'Check karta hai ki bot PostgreSQL database ke saath connected hai.');
  addCommandLine('/addinvites', 'Kisi member ke account mein extra invites add karne ke liye.');
  addCommandLine('/removeinvites', 'Kisi member ke account se invites remove karne ke liye.');

  // Footer Page 1
  doc.fillColor('#949BA4')
     .fontSize(8)
     .text('Page 1 of 3', 40, doc.page.height - 30, { align: 'right', width: 515 });

  // ==================== PAGE 2 ====================
  doc.addPage();
  
  // Header
  doc.rect(40, 40, 515, 30).fill('#1A1A1E');
  doc.fillColor('#FFFFFF')
     .fontSize(12)
     .font('Helvetica-Bold')
     .text('/PROOFMAKE SPECIAL LAYOUT GUIDE', 55, 49);

  doc.y = 90;

  doc.fillColor('#DBDEE1')
     .fontSize(10.5)
     .font('Helvetica')
     .text('`/proofmake` command ek ultra-realistic, custom-rendered Discord screenshot generate karti hai. Is screenshot mein koi square empty box ("tofu") nahi banta kyunki sabhi emojis natively vector paths se draw hote hain. Isme do layouts hote hain:', 40, doc.y, { align: 'justify', width: 515 });

  doc.moveDown(1);

  // Section: Nitro Layout
  doc.fillColor('#F5B418')
     .fontSize(12)
     .font('Helvetica-Bold')
     .text('Layout A: Classic Nitro Payouts (Basic / Boost)');
  doc.moveDown(0.5);
  doc.fillColor('#DBDEE1')
     .font('Helvetica')
     .fontSize(10)
     .list([
       'Target user admin ko tag karke ticket mein invites complete hone ki request karta hai.',
       'Admin ke tag/mention par accurate golden row highlight background (#2D241C) aur left vertical bar (#B06B0A) banega.',
       'Admin ke avatar aur name ke saath realistic rounded Gift Card deliver hota hai.',
       'Gift code ke upar elegant redaction spoiler block drawing banti hai.',
       'End mein user khushi se "thankyou legit" bolega jiske conversation templates random change hote hain.'
     ], { bulletRadius: 2 });

  doc.moveDown(1.5);

  // Section: Non-Nitro Layout
  doc.fillColor('#5865F2')
     .fontSize(12)
     .font('Helvetica-Bold')
     .text('Layout B: Modern Non-Nitro Payouts (Robux / Minecraft)');
  doc.moveDown(0.5);
  doc.fillColor('#DBDEE1')
     .font('Helvetica')
     .fontSize(10)
     .list([
       'Curved grey reply lines aur Riwaayat app profile structure banta hai.',
       'Header par crisp, natively drawn Gift Box, Minecraft bricks ya Gold Coins emojis banenge.',
       'Redeem code aur claim website par grey spoiler bands (#2E3035) bante hain.',
       'Niche 460x110 size ka rounded dark attachment block banta hai jiske center mein capital bold "SPOILER" pill button hota hai.',
       'End mein user ka vouch status text Discord green color (#57F287) mein print hota hai.'
     ], { bulletRadius: 2 });

  // Footer Page 2
  doc.fillColor('#949BA4')
     .fontSize(8)
     .text('Page 2 of 3', 40, doc.page.height - 30, { align: 'right', width: 515 });

  // ==================== PAGE 3 ====================
  doc.addPage();

  // Header
  doc.rect(40, 40, 515, 30).fill('#1A1A1E');
  doc.fillColor('#FFFFFF')
     .fontSize(12)
     .font('Helvetica-Bold')
     .text('/PROOFMAKE CONVERSATION TEMPLATES & CODES', 55, 49);

  doc.y = 90;

  doc.fillColor('#DBDEE1')
     .fontSize(10)
     .font('Helvetica')
     .text('Screenshots ko natural aur trustable dikhane ke liye templates randomly select hote hain. Ye templates exact ye hain:', 40, doc.y, { width: 515 });

  doc.moveDown(1);

  // Template 1
  doc.fillColor('#E1E1E3')
     .font('Helvetica-Bold')
     .fontSize(10)
     .text('Template 1 (Urgent/Jaldi):');
  doc.font('Helvetica-Oblique')
     .fillColor('#B5BAC1')
     .text('  User: "i have made like X invites"\n  User: "@Count WHEN U PAY MY NITRO BASIC BITCH"\n  User: "HUH????"\n  Admin: Deliverable Gift Embed Card & Code\n  User Reply: "HAHAHAHAH GOOOD BOOY", "REAL THOUGH BTW"');
  doc.moveDown(1);

  // Template 2
  doc.fillColor('#E1E1E3')
     .font('Helvetica-Bold')
     .fontSize(10)
     .text('Template 2 (Request):');
  doc.font('Helvetica-Oblique')
     .fillColor('#B5BAC1')
     .text('  User: "hello bro"\n  User: "i invite X people now"\n  User: "pls @Count give nitro basic"\n  User: "fast reply pls"\n  Admin: Deliverable Gift Embed Card & Code\n  User Reply: "omg it is real!", "tysm for the legit nitro!! <3"');
  doc.moveDown(1);

  // Template 3
  doc.fillColor('#E1E1E3')
     .font('Helvetica-Bold')
     .fontSize(10)
     .text('Template 3 (Formal):');
  doc.font('Helvetica-Oblique')
     .fillColor('#B5BAC1')
     .text('  User: "Sir i completed the invite milestone"\n  User: "already got X invites successfully"\n  User: "let me know when @Count sends it"\n  User: "waiting here"\n  Admin: Deliverable Gift Embed Card & Code\n  User Reply: "Yo no way it actually worked!", "legit bot and server tysm!"');
  doc.moveDown(1);

  // Template 4
  doc.fillColor('#E1E1E3')
     .font('Helvetica-Bold')
     .fontSize(10)
     .text('Template 4 (Simple):');
  doc.font('Helvetica-Oblique')
     .fillColor('#B5BAC1')
     .text('  User: "hey"\n  User: "i did the X invites for nitro"\n  User: "@Count check ticket pls and pay"\n  User: "is it active?"\n  Admin: Deliverable Gift Embed Card & Code\n  User Reply: "Thank you so much!!", "highly recommended legit proof"');

  // Footer Page 3
  doc.fillColor('#949BA4')
     .fontSize(8)
     .text('Page 3 of 3', 40, doc.page.height - 30, { align: 'right', width: 515 });

  doc.end();
  console.log('Successfully generated beautiful manual PDF to:', outputFilePath);
}

main().catch(console.error);
