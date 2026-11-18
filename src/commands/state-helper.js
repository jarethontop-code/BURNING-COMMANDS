// Exposes the state persistence function without leaking internal data.
module.exports = { persist: require('../state').save };
