/**
 * 翻译系统入口文件
 */

const TranslationManager = require('./managers/TranslationManager');
const ConfigManager = require('./managers/ConfigManager');
const CacheManager = require('./managers/CacheManager');
const TranslationAdapter = require('./adapters/TranslationAdapter');
const GoogleTranslateAdapter = require('./adapters/GoogleTranslateAdapter');
const AITranslationAdapter = require('./adapters/AITranslationAdapter');
const CustomAPIAdapter = require('./adapters/CustomAPIAdapter');

module.exports = {
  TranslationManager,
  ConfigManager,
  CacheManager,
  TranslationAdapter,
  GoogleTranslateAdapter,
  AITranslationAdapter,
  CustomAPIAdapter
};
