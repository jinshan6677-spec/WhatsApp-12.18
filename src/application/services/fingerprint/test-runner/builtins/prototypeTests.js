'use strict';

function prototypeChainNoOriginalTest(config) {
  const hasNoOriginal = !Object.prototype.hasOwnProperty.call(config, '__original__');
  return {
    passed: hasNoOriginal,
    expected: 'No __original__ property',
    actual: hasNoOriginal ? 'No __original__ property' : '__original__ property found',
    details: 'Wrapped functions should not expose internal references'
  };
}

function prototypeChainDescriptorsTest(config) {
  const hasProperStructure = config.browser !== undefined && config.os !== undefined && config.hardware !== undefined;
  return {
    passed: hasProperStructure,
    expected: 'Proper object structure with browser, os, hardware',
    actual: hasProperStructure ? 'Structure is valid' : 'Missing required properties',
    details: 'Configuration should have consistent property structure'
  };
}

module.exports = {
  prototypeChainNoOriginalTest,
  prototypeChainDescriptorsTest
};

