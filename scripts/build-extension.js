const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 Building Chaptr Chrome Extension...\n');

const extensionDir = path.join(__dirname, '..', 'extension');
const buildDir = path.join(extensionDir, 'build');

// Create build directory
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// Files to copy
const filesToCopy = [
  'manifest.json',
  'background.js',
  'content.js',
  'content.css',
  'popup.html',
  'popup.js'
];

// Copy files to build directory
console.log('📁 Copying extension files...');
filesToCopy.forEach(file => {
  const src = path.join(extensionDir, file);
  const dest = path.join(buildDir, file);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ Copied ${file}`);
  } else {
    console.warn(`  ⚠ Warning: ${file} not found`);
  }
});

// Create icons directory if it doesn't exist
const iconsDir = path.join(buildDir, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create placeholder icons (replace with real icons later)
console.log('\n📷 Creating placeholder icons...');
const iconSizes = [16, 32, 48, 128];

iconSizes.forEach(size => {
  const iconPath = path.join(iconsDir, `icon${size}.png`);
  // Create a simple SVG and convert it (for now, just note that icons are needed)
  console.log(`  ℹ  Note: Create icon${size}.png manually`);
});

// Update manifest with production settings
console.log('\n⚙️  Updating manifest for production...');
const manifestPath = path.join(buildDir, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Update any development URLs to production
if (manifest.host_permissions) {
  manifest.host_permissions = manifest.host_permissions.map(permission => {
    if (permission.includes('localhost')) {
      return permission.replace('localhost:3000', 'chaptr.app');
    }
    return permission;
  });
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('  ✓ Manifest updated');

// Create ZIP for Chrome Web Store upload
console.log('\n📦 Creating extension.zip...');
try {
  const zipPath = path.join(__dirname, '..', 'extension.zip');

  // Remove old zip if exists
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  // Create new zip
  execSync(`cd ${buildDir} && zip -r ${zipPath} .`, { stdio: 'inherit' });
  console.log(`  ✓ Created extension.zip`);
} catch (error) {
  console.error('  ✗ Failed to create zip:', error.message);
}

console.log('\n✅ Extension build complete!');
console.log('\n📝 Next steps:');
console.log('  1. Add icon images to extension/icons/ directory');
console.log('  2. Update manifest.json with your Google OAuth client ID');
console.log('  3. Test the extension locally by loading extension/build in Chrome');
console.log('  4. Upload extension.zip to Chrome Web Store\n');
