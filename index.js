/**
 * Root entrypoint for deployment platforms that scan for express.
 * Starts the Tower MMO server (static + WebSocket).
 */
const express = require('express');
const path = require('path');

// Ensure platform detectors see an express import in index.js
if (!express) {
  throw new Error('express is required');
}

// Boot the real server (also uses express)
require(path.join(__dirname, 'server', 'index.js'));
