#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { Database } from '../src/config/database.js';
import { initializeSecurityTables } from '../src/utils/security.js';
import { initializeLoginAttemptsTable } from '../src/middleware/rateLimiter.js';
import User from '../src/models/User.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const setup = async () => {
  try {
    console.log('🚀 Setting up StellarFlow REST API...');
    
    // Create necessary directories
    console.log('📁 Creating directories...');
    const directories = [
      './data',
      './logs',
      './uploads',
      './backups'
    ];
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
        console.log(`  ✅ Created ${dir}`);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
        console.log(`  📋 ${dir} already exists`);
      }
    }
    
    // Initialize database
    console.log('\n💾 Initializing database...');
    await Database.initialize();
    console.log('  ✅ Database initialized');
    
    // Initialize security tables
    console.log('\n🔒 Setting up security features...');
    await initializeSecurityTables();
    console.log('  ✅ Security tables created');
    
    await initializeLoginAttemptsTable();
    console.log('  ✅ Rate limiting tables created');
    
    // Create admin user if specified
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
      console.log('\n👤 Creating admin user...');
      
      const existingAdmin = await User.findByEmail(process.env.ADMIN_EMAIL);
      if (!existingAdmin) {
        const adminUser = await User.create({
          username: 'admin',
          email: process.env.ADMIN_EMAIL,
          password: process.env.ADMIN_PASSWORD,
          first_name: 'System',
          last_name: 'Administrator',
          role: 'admin',
          bio: 'System administrator account'
        });
        
        console.log(`  ✅ Admin user created: ${adminUser.email}`);
      } else {
        console.log('  📋 Admin user already exists');
      }
    }
    
    // Create .env file if it doesn't exist
    console.log('\n📝 Setting up environment...');
    try {
      await fs.access('.env');
      console.log('  📋 .env file already exists');
    } catch (error) {
      console.log('  🔄 Creating .env file from template...');
      const envExample = await fs.readFile('.env.example', 'utf8');
      await fs.writeFile('.env', envExample);
      console.log('  ✅ .env file created');
      console.log('  ⚠️  Please update the .env file with your specific configuration');
    }
    
    // Display setup summary
    console.log('\n🎆 Setup completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  • Database initialized with security features');
    console.log('  • Rate limiting and authentication system ready');
    console.log('  • Directory structure created');
    console.log('  • Environment configuration ready');
    
    if (process.env.ADMIN_EMAIL) {
      console.log(`  • Admin user: ${process.env.ADMIN_EMAIL}`);
    }
    
    console.log('\n🚀 You can now start the server with:');
    console.log('  npm run dev   (development mode)');
    console.log('  npm start     (production mode)');
    
    console.log('\n📚 API Documentation:');
    console.log('  Authentication: POST /api/auth/register, /api/auth/login');
    console.log('  Users: GET,PUT,DELETE /api/users/:id');
    console.log('  Posts: GET,POST,PUT,DELETE /api/posts/:id');
    console.log('  Comments: GET,POST,PUT,DELETE /api/comments/:id');
    console.log('  Health: GET /health');
    
    await Database.close();
    
  } catch (error) {
    console.error('\n💥 Setup failed:', error);
    process.exit(1);
  }
};

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setup();
}

export { setup };
