/**
 * Root entrypoint — imports express then starts the game server.
 */
const express = require('express');
const path = require('path');
if (!express) throw new Error('express is required');
require(path.join(__dirname, 'server', 'index.js'));
