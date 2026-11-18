// Install modules before the main entry point registers Discord event listeners.
require('./social-interactions').install();
require('./prefix-commands').install();
require('./slash-security').install();
require('./automod').install();
require('./prefix-utility').install();
process.env.ENABLE_PRIVILEGED_INTENTS = 'true';
require('./index');
