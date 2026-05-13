'use strict';

// Compatibility entrypoint.
// Some deployments may still run `node server.js`.
// Delegate to the maintained server implementation that includes
// Applicant Lifecycle Tracker routes (/lifecycle and /api/lifecycle/*).

module.exports = require('./server-enhanced');
