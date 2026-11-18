// Install the social prefix handler before the application registers its listeners.
require('./social-interactions').install();

// The existing entry point gates prefix-command intents behind this flag.
// Discord still requires these privileged intents to be enabled in the Developer Portal.
process.env.ENABLE_PRIVILEGED_INTENTS = 'true';
require('./index');
