// withTimeout — garde-fou des appels réseau (Supabase auth, etc.)
const { withTimeout } = require('../utils/withTimeout');

describe('withTimeout', () => {
  test('laisse passer la valeur si la promesse résout avant le timeout', async () => {
    const fast = new Promise((resolve) => setTimeout(() => resolve('ok'), 10));
    await expect(withTimeout(fast, 500, 'test')).resolves.toBe('ok');
  });

  test('rejette avec un message explicite (label + durée) au timeout', async () => {
    const never = new Promise(() => {});
    await expect(withTimeout(never, 20, 'supabase.auth')).rejects.toThrow(
      'supabase.auth timeout after 20ms'
    );
  });

  test('utilise "request" comme label par défaut', async () => {
    const never = new Promise(() => {});
    await expect(withTimeout(never, 20)).rejects.toThrow('request timeout after 20ms');
  });

  test('propage le rejet original s’il survient avant le timeout', async () => {
    const failing = new Promise((_, reject) => setTimeout(() => reject(new Error('boom')), 10));
    await expect(withTimeout(failing, 500, 'test')).rejects.toThrow('boom');
  });
});
