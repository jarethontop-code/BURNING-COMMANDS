'use strict';

// Define la constante requerida por el juego de la galleta.
const GOLD = 0xF1C40F;
global.GOLD = GOLD;

// Install modules before the main entry point registers Discord event listeners.
require('./social-interactions').install();
require('./prefix-commands').install();
require('./slash-security').install();
require('./automod').install();
require('./prefix-utility').install();
require('./interaction-fixes').install();
require('./social-events').install();
require('./package5').install();
require('./package6').install();
process.env.ENABLE_PRIVILEGED_INTENTS = 'true';
require('./index');
