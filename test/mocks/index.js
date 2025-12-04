/**
 * Test Mocks Index
 * Exports all mock implementations for testing
 * 
 * @module test/mocks
 * Requirements: 10.1
 */

'use strict';

const {
  ElectronMock,
  AppMock,
  IpcMainMock,
  IpcRendererMock,
  BrowserWindowMock,
  WebContentsMock,
  SessionMock,
  CookiesMock,
  DialogMock
} = require('./ElectronMock');

const {
  StorageMock,
  FileSystemMock,
  JsonStoreMock
} = require('./StorageMock');

const {
  NetworkMock,
  MockResponse,
  MockHeaders,
  WebSocketMock
} = require('./NetworkMock');

module.exports = {
  // Electron mocks
  ElectronMock,
  AppMock,
  IpcMainMock,
  IpcRendererMock,
  BrowserWindowMock,
  WebContentsMock,
  SessionMock,
  CookiesMock,
  DialogMock,
  
  // Storage mocks
  StorageMock,
  FileSystemMock,
  JsonStoreMock,
  
  // Network mocks
  NetworkMock,
  MockResponse,
  MockHeaders,
  WebSocketMock
};
