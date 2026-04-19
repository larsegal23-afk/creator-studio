// Project startup script
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check if required files exist
function checkProjectStructure() {
  const requiredFiles = [
    'backend/package.json',
    'backend/server.js',
    'frontend/package.json',
    'frontend/index.html',
    'backend/.env.example'
  ];

  log('Checking project structure...', 'cyan');
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      log(`Missing required file: ${file}`, 'red');
      return false;
    }
  }

  log('Project structure OK!', 'green');
  return true;
}

// Check if .env exists, create from example if needed
function setupEnvironment() {
  const envPath = 'backend/.env';
  const envExamplePath = 'backend/.env.example';
  
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      log('Creating .env from example...', 'yellow');
      fs.copyFileSync(envExamplePath, envPath);
      log('Please edit backend/.env with your API keys!', 'yellow');
      return false; // Stop to let user configure
    } else {
      log('No .env.example found!', 'red');
      return false;
    }
  }
  
  return true;
}

// Install dependencies if needed
function installDependencies() {
  return new Promise((resolve) => {
    log('Checking dependencies...', 'cyan');
    
    // Use exec for npm commands on Windows
    const { exec } = require('child_process');
    
    exec('npm install', { cwd: path.join(process.cwd(), 'backend') }, (error, stdout, stderr) => {
      if (error) {
        log(`Backend install error: ${error.message}`, 'red');
      } else {
        log('Backend dependencies installed!', 'green');
      }
      
      exec('npm install', { cwd: path.join(process.cwd(), 'frontend') }, (error2, stdout2, stderr2) => {
        if (error2) {
          log(`Frontend install error: ${error2.message}`, 'red');
        } else {
          log('Frontend dependencies installed!', 'green');
        }
        resolve();
      });
    });
  });
}

// Start servers
function startServers() {
  log('Starting servers...', 'cyan');
  
  const { exec } = require('child_process');
  
  // Start backend
  const backend = exec('npm start', {
    cwd: path.join(process.cwd(), 'backend'),
    stdio: 'inherit'
  });
  
  backend.on('error', (error) => {
    log(`Backend failed to start: ${error.message}`, 'red');
  });
  
  // Wait a bit for backend to start
  setTimeout(() => {
    // Start frontend
    const frontend = exec('npm run dev', {
      cwd: path.join(process.cwd(), 'frontend'),
      stdio: 'inherit'
    });
    
    frontend.on('error', (error) => {
      log(`Frontend failed to start: ${error.message}`, 'red');
    });
    
    log('\n' + '='.repeat(50), 'bright');
    log('Creator Studio is starting up!', 'bright');
    log('='.repeat(50), 'bright');
    log('Frontend: http://localhost:5500', 'blue');
    log('Backend:  http://localhost:3000', 'blue');
    log('='.repeat(50), 'bright');
    log('Press Ctrl+C to stop both servers', 'yellow');
    log('='.repeat(50) + '\n', 'bright');
    
    // Handle shutdown
    process.on('SIGINT', () => {
      log('\nShutting down servers...', 'yellow');
      backend.kill();
      frontend.kill();
      process.exit(0);
    });
    
  }, 3000);
}

// Main startup sequence
async function main() {
  log('Creator Studio Startup Script', 'bright');
  log('='.repeat(30), 'bright');
  
  // Check project structure
  if (!checkProjectStructure()) {
    log('Project structure check failed!', 'red');
    process.exit(1);
  }
  
  // Setup environment
  if (!setupEnvironment()) {
    log('Please configure .env file and run again', 'yellow');
    process.exit(0);
  }
  
  // Install dependencies
  await installDependencies();
  
  // Start servers
  startServers();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log(`Uncaught error: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection: ${reason}`, 'red');
  process.exit(1);
});

// Run startup
main();
