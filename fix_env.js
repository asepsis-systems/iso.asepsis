const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '.env');
fs.writeFileSync(target, 'DATABASE_URL="mysql://iso_user:Iso_2026_Asepsis!@127.0.0.1:3307/Iso_Asepsis"\n');
console.log('Fixed .env file successfully!');
