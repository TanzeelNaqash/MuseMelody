// Simple environment setup for development
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envContent = `# Development Environment Variables
DATABASE_URL=postgresql://localhost:5432/aerogroove_dev
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Google OAuth (Optional - Get from Google Cloud Console)
# GOOGLE_CLIENT_ID=your-google-client-id
# GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Configuration (Optional - for production)
# EMAIL_USER=your-email@gmail.com
# EMAIL_PASS=your-app-password

# YouTube API (Optional - for music features)
# YOUTUBE_API_KEY=your-youtube-api-key
`;

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file with development configuration');
  console.log('📝 Please update the values in .env file as needed');
} else {
  console.log('⚠️  .env file already exists');
}

console.log('\n🚀 To get Google OAuth working:');
console.log('1. Go to https://console.cloud.google.com/');
console.log('2. Create a new project or select existing one');
console.log('3. Enable Google+ API');
console.log('4. Create OAuth 2.0 credentials');
console.log('5. Add authorized redirect URI: http://localhost:3000/api/auth/google/callback');
console.log('6. Copy Client ID and Secret to .env file');
