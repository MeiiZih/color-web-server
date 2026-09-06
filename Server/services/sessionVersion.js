// Old JWTs and pre-existing accounts both start at version zero.
module.exports = function currentSession(payload, account, role) {
  const version = payload.sessionVersion ?? 0;
  return Boolean(account && payload.role === role && Number.isInteger(version) && version === (account.sessionVersion || 0));
};
