const FAILURE_THRESHOLD = 3;

// session_id -> { service_name -> failureCount }
const failureCounts = new Map();

function recordFailure(sessionId, serviceName) {
  if (!failureCounts.has(sessionId)) failureCounts.set(sessionId, {});
  const bucket = failureCounts.get(sessionId);
  bucket[serviceName] = (bucket[serviceName] || 0) + 1;
}

function recordSuccess(sessionId, serviceName) {
  const bucket = failureCounts.get(sessionId);
  if (bucket) bucket[serviceName] = 0;
}

function isOpen(sessionId, serviceName) {
  const bucket = failureCounts.get(sessionId);
  if (!bucket) return false;
  return (bucket[serviceName] || 0) >= FAILURE_THRESHOLD;
}

function clearSession(sessionId) {
  failureCounts.delete(sessionId);
}

module.exports = { recordFailure, recordSuccess, isOpen, clearSession };
