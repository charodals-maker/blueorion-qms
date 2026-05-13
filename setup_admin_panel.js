#!/usr/bin/env node

/**
 * Admin Panel Setup Script
 * Automates setup and initialization of the Staff Monitoring & Approval Panel
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    log('\n🔐 BLUEORION QMS - Admin Panel Setup', 'bright');
    log('======================================\n', 'bright');

    try {
        // Step 1: Check dependencies
        log('Step 1: Checking dependencies...', 'blue');
        const packagePath = path.join(process.cwd(), 'package.json');
        
        if (!fs.existsSync(packagePath)) {
            log('⚠️  package.json not found in current directory!', 'red');
            process.exit(1);
        }

        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        let needsUpdate = false;

        if (!packageJson.dependencies.exceljs) {
            log('  ⚠️  ExcelJS not found', 'yellow');
            needsUpdate = true;
        } else {
            log('  ✅ ExcelJS found', 'green');
        }

        if (!packageJson.dependencies.mongoose) {
            log('  ⚠️  Mongoose not found', 'yellow');
            needsUpdate = true;
        } else {
            log('  ✅ Mongoose found', 'green');
        }

        if (needsUpdate) {
            const install = await question('  Would you like to install missing dependencies? (yes/no): ');
            if (install.toLowerCase() === 'yes' || install.toLowerCase() === 'y') {
                log('  Installing dependencies...', 'yellow');
                const { execSync } = require('child_process');
                execSync('npm install exceljs mongoose', { stdio: 'inherit' });
                log('  ✅ Dependencies installed', 'green');
            }
        }

        // Step 2: Create required directories
        log('\nStep 2: Creating required directories...', 'blue');
        const dirs = ['logs', 'exports', 'modules', 'models'];
        
        dirs.forEach(dir => {
            const dirPath = path.join(process.cwd(), dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                log(`  ✅ Created ${dir}/`, 'green');
            } else {
                log(`  ℹ️  ${dir}/ already exists`, 'blue');
            }
        });

        // Step 3: Check required files
        log('\nStep 3: Checking required files...', 'blue');
        const requiredFiles = {
            'staff_approval_panel.html': 'Admin panel interface',
            'modules/admin_approval_routes.js': 'Backend API routes',
            'models/admin_models.js': 'Database models'
        };

        const missingFiles = [];
        Object.entries(requiredFiles).forEach(([file, desc]) => {
            const filePath = path.join(process.cwd(), file);
            if (fs.existsSync(filePath)) {
                log(`  ✅ ${desc} (${file})`, 'green');
            } else {
                log(`  ❌ ${desc} (${file}) - MISSING`, 'red');
                missingFiles.push(file);
            }
        });

        if (missingFiles.length > 0) {
            log(`\n⚠️  Missing ${missingFiles.length} required file(s)!`, 'red');
            log('Please ensure all files are in place before proceeding.\n', 'yellow');
            process.exit(1);
        }

        // Step 4: Create initialization file for server integration
        log('\nStep 4: Creating server integration template...', 'blue');
        const integrationTemplate = `
// Add this to your server.js file to enable the Admin Panel

const path = require('path');
const express = require('express');

// Import admin routes
const adminRoutes = require('./modules/admin_approval_routes');

// Import database models
const { 
    StaffSubmission, 
    CVAssignment, 
    AuditLog, 
    AdminUser, 
    FRAStats 
} = require('./models/admin_models');

// Add to your Express app:
// 1. Mount static files for admin panel
app.use(express.static(path.join(__dirname, '.')));

// 2. Mount admin API routes (requires authentication middleware)
app.use('/api/admin', adminRoutes);

// 3. Serve admin panel HTML
app.get('/admin-panel', (req, res) => {
    res.sendFile(path.join(__dirname, 'staff_approval_panel.html'));
});

// 4. Ensure your authentication middleware is configured
// Example:
// function authenticateAdmin(req, res, next) {
//     if (!req.user || !req.user.isAdmin) {
//         return res.status(403).json({ error: 'Admin access required' });
//     }
//     next();
// }

// Access panel at: http://localhost:3000/admin-panel
`;

        const integrationPath = path.join(process.cwd(), 'ADMIN_PANEL_INTEGRATION.js');
        fs.writeFileSync(integrationPath, integrationTemplate);
        log('  ✅ Created ADMIN_PANEL_INTEGRATION.js template', 'green');

        // Step 5: Create database initialization script
        log('\nStep 5: Creating database initialization script...', 'blue');
        const dbInitScript = `
const mongoose = require('mongoose');
const { AdminUser } = require('./models/admin_models');

async function initializeDatabase(mongoUri) {
    try {
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB');

        // Create default admin user (CHANGE CREDENTIALS!)
        const defaultAdmin = await AdminUser.findOne({ username: 'admin' });
        
        if (!defaultAdmin) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash('CHANGE_ME_2026', 10);
            
            await AdminUser.create({
                username: 'admin',
                email: 'admin@blueorion.local',
                passwordHash: hashedPassword,
                role: 'super_admin',
                permissions: {
                    canApprove: true,
                    canReject: true,
                    canAssignCV: true,
                    canViewAudit: true,
                    canExport: true,
                    canManageAdmins: true,
                    canDeleteSubmissions: true
                }
            });
            console.log('✅ Created default admin user');
            console.log('⚠️  IMPORTANT: Change default password immediately!');
        } else {
            console.log('ℹ️  Admin user already exists');
        }

        // Create indexes
        await AdminUser.collection.createIndexes();
        console.log('✅ Database indexes created');
        console.log('✅ Database initialization complete');

    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
}

// Run initialization
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/blueorion-qms';
initializeDatabase(mongoUri);
`;

        const dbInitPath = path.join(process.cwd(), 'scripts', 'init_admin_db.js');
        const scriptsDir = path.join(process.cwd(), 'scripts');
        if (!fs.existsSync(scriptsDir)) {
            fs.mkdirSync(scriptsDir, { recursive: true });
        }
        fs.writeFileSync(dbInitPath, dbInitScript);
        log('  ✅ Created database initialization script', 'green');

        // Step 6: Summary and next steps
        log('\n' + '='.repeat(50), 'bright');
        log('✅ Setup Complete!', 'green');
        log('='.repeat(50), 'bright');

        log('\n📋 Next Steps:', 'bright');
        log('1. Update your server.js with the integration code', 'yellow');
        log('   (Reference: ADMIN_PANEL_INTEGRATION.js)', 'yellow');
        log('2. Initialize the database:', 'yellow');
        log('   node scripts/init_admin_db.js', 'yellow');
        log('3. Start your server:', 'yellow');
        log('   npm start', 'yellow');
        log('4. Access admin panel at:', 'yellow');
        log('   http://localhost:3000/admin-panel', 'yellow');

        log('\n📚 Documentation:', 'bright');
        log('• Full Guide: STAFF_APPROVAL_PANEL_GUIDE.md', 'blue');
        log('• Quick Reference: ADMIN_PANEL_QUICK_REFERENCE.md', 'blue');

        log('\n🔐 Security Reminders:', 'bright');
        log('• Change default admin password immediately', 'red');
        log('• Use HTTPS in production', 'red');
        log('• Set up proper authentication middleware', 'red');
        log('• Configure session timeout (15 min recommended)', 'red');
        log('• Enable audit logging', 'red');
        log('• Back up database regularly', 'red');

        log('\n✅ Setup complete! Happy monitoring!\n', 'green');

    } catch (error) {
        log(`\n❌ Setup failed: ${error.message}\n`, 'red');
        process.exit(1);
    } finally {
        rl.close();
    }
}

main();
