// Test if electron mock works
jest.mock('electron', () => {
  return {
    BrowserWindow: jest.fn(),
    app: {
      getPath: jest.fn(() => '/test/path')
    },
    session: {
      fromPartition: jest.fn(() => ({
        setProxy: jest.fn().mockResolvedValue(undefined)
      }))
    }
  };
});

const { session } = require('electron');

test('session should be defined', () => {
  expect(session).toBeDefined();
  expect(session.fromPartition).toBeDefined();
  
  const mockSession = session.fromPartition('test');
  expect(mockSession).toBeDefined();
  expect(mockSession.setProxy).toBeDefined();
});
