function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function badRequest(message) {
  return httpError(400, message);
}

module.exports = { httpError, badRequest };
