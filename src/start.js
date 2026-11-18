// Install social, prefix, and slash-only security features before the main entry point registers listeners.
require('./social-interactions').install();
require('./prefix-commands').install();
require('./slash-security').install();
process.env.ENABLE_PRIVILEGED_INTENTS = 'true';
require('./index');
