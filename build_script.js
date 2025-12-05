const { execSync } = require('child_process');
const fs = require('fs');
try {
    console.log('Starting build...');
    const output = execSync('npm run build', { encoding: 'utf8', stdio: 'pipe' });
    fs.writeFileSync('build_output.txt', output);
    console.log('Build success');
} catch (e) {
    console.log('Build failed');
    const errorLog = (e.stdout || '') + '\n' + (e.stderr || '') + '\n' + e.message;
    fs.writeFileSync('build_output.txt', errorLog);
}
