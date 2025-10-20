import { createEvent } from './api';

describe('API service error handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.resetAllMocks();
    global.fetch = originalFetch;
  });

  it('propagate les détails des erreurs de validation côté serveur', async () => {
    const mockJson = jest.fn().mockResolvedValue({
      error: 'Le budget maximum est obligatoire.',
      details: {
        fieldErrors: { budget: 'Le budget maximum est obligatoire.' },
        step: 'details',
      },
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: mockJson,
    });

    await expect(
      createEvent({ name: 'Nope', participants: [] }, 'token')
    ).rejects.toMatchObject({
      message: 'Le budget maximum est obligatoire.',
      details: {
        fieldErrors: { budget: 'Le budget maximum est obligatoire.' },
        step: 'details',
      },
      status: 400,
    });

    expect(global.fetch).toHaveBeenCalled();
    expect(mockJson).toHaveBeenCalled();
  });
});
