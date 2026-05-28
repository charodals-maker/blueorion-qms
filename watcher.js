// watcher.js
// Watches fra_tracker_db.json for changes and auto-pushes to GitHub

const chokidar = require('chokidar');
const { exec } = require('child_process');
const path = require('path');

// Path to the file to watch
const fileToWatch = path.join(__dirname, 'qms_safe_zone', 'fra_tracker_db.json');

console.log('Watching for changes to:', fileToWatch);

const watcher = chokidar.watch(fileToWatch, { persistent: true });

watcher.on('change', (filePath) => {
  console.log(`Detected change in ${filePath}. Running git add, commit, and push...`);
  exec('git add . && git commit -m "Auto: Update fra_tracker_db.json" && git push origin main', (err, stdout, stderr) => {
    if (err) {
      console.error('Git push failed:', stderr);
    } else {
      console.log('Git push successful:', stdout);
    }
  });
});
