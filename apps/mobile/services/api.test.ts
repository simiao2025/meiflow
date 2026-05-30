import { api } from './api';

describe('API Service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    api.invalidateCache();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('get', () => {
    it('deve retornar dados quando a requisição for bem-sucedida', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test', balance: 1000 }),
      });

      const result = await api.get('/financial/balance/user-1', false);
      
      expect(result).toEqual({ data: 'test', balance: 1000 });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('deve fazer cache dos resultados', async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: 'test' }),
        });
      });

      await api.get('/test', true, 'test-key');
      await api.get('/test', true, 'test-key');

      expect(callCount).toBe(1);
    });

    it('deve invalidar cache por prefixo', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      await api.get('/test1', true, 'user-1');
      api.invalidateCache('user-1');
      
      const cached = await api.get('/test1', true, 'user-1');
      expect(cached).toEqual({ data: 'test' });
    });

    it('deve lançar erro quando fetch falhar', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(api.get('/test', false)).rejects.toThrow('Network error');
    });
  });

  describe('post', () => {
    it('deve enviar dados via POST', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, id: '123' }),
      });

      const result = await api.post('/transactions', { amount: 100, type: 'receita' });
      
      expect(result).toEqual({ success: true, id: '123' });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/transactions'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ amount: 100, type: 'receita' }),
        }),
      );
    });

    it('deve lançar erro quando response.ok for false', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
      });

      await expect(api.post('/transactions', {})).rejects.toThrow('API Error: 400');
    });
  });

  describe('invalidateCache', () => {
    it('deve limpar todo o cache', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });

      await api.get('/test1', true, 'key-1');
      await api.get('/test2', true, 'key-2');
      api.invalidateCache();

      const cached1 = await api.get('/test1', true, 'key-1');
      expect(cached1).toEqual({ data: 'test' });
    });
  });
});
