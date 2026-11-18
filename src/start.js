// Install prefix handlers before the existing bot registers its message listeners.
require('./social-interactions').install();
require('./prefix-commands').install();

// The current entry point requests privileged intents for prefix commands.
// Enable Message Content Intent and Server Members Intent in Discord Developer Portal.
process.env.ENABLE_PRIVILEGED_INTENTS = 'true';
require('./index');
