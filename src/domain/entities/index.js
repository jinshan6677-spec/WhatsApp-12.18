'use strict';

const Account = require('./Account');
const TranslationConfig = require('./TranslationConfig');

 

  module.exports = {
    Account,
    TranslationConfig,
    
  // Re-export enums for convenience
    AccountStatus: Account.Status,
    TranslationEngine: TranslationConfig.Engine,
    TranslationStyle: TranslationConfig.Style
  };
