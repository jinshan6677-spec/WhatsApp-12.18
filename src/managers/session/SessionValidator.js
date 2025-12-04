class SessionValidator {
  constructor(sessionStorage, logger) {
    this.sessionStorage = sessionStorage;
    this.log = logger;
  }
}

module.exports = SessionValidator;
