import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

export default function Settings() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [geminiKeyConfigured, setGeminiKeyConfigured] = useState(null);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState('');
  const [keySaveError, setKeySaveError] = useState('');

  const loadSettings = useCallback(() => {
    api
      .get('/settings')
      .then((res) => setGeminiKeyConfigured(res.data.geminiKeyConfigured))
      .catch(() => setGeminiKeyConfigured(null));
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  async function handleSync() {
    setSyncing(true);
    setError('');
    setResult(null);
    try {
      const res = await api.post('/sync/amocrm');
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Sinxronlashda xatolik yuz berdi.');
    } finally {
      setSyncing(false);
    }
  }

  async function handleSaveGeminiKey(e) {
    e.preventDefault();
    setSavingKey(true);
    setKeySaveMessage('');
    setKeySaveError('');
    try {
      await api.put('/settings/gemini-key', { apiKey: geminiKeyInput });
      setGeminiKeyConfigured(true);
      setGeminiKeyInput('');
      setKeySaveMessage("Kalit saqlandi. Qayta ishga tushirishsiz darhol ishlaydi.");
    } catch (err) {
      setKeySaveError(err.response?.data?.error || 'Kalitni saqlashda xatolik yuz berdi.');
    } finally {
      setSavingKey(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <h3>amoCRM sinxronizatsiyasi</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Tizim amoCRM'dan Asadbekning qo'ng'iroqlarini avtomatik ravishda muntazam sinxronlaydi.
          Zarur bo'lsa, qo'lda ham ishga tushirishingiz mumkin.
        </p>
        <button className="analyze-btn" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Sinxronlanmoqda...' : 'Hozir sinxronlash'}
        </button>
        {result && (
          <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
            Tekshirildi: {result.fetched}, yangi qo'shildi: {result.created}
          </p>
        )}
        {error && <div className="error-text">{error}</div>}
      </div>

      <div className="panel">
        <h3>Gemini API kaliti</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
          AI tahlil qilish uchun zarur. Bu yerda saqlangan kalit serverni qayta ishga
          tushirmasdan darhol qo'llaniladi.
        </p>

        {geminiKeyConfigured !== null && (
          <p style={{ fontSize: 13, marginBottom: 16 }}>
            {geminiKeyConfigured ? (
              <span style={{ color: 'var(--good)' }}>Kalit saqlangan ✓</span>
            ) : (
              <span style={{ color: 'var(--critical)' }}>Kalit sozlanmagan</span>
            )}
          </p>
        )}

        <form onSubmit={handleSaveGeminiKey}>
          <div className="field">
            <label htmlFor="gemini-key">Yangi Gemini API kaliti</label>
            <input
              id="gemini-key"
              type="password"
              autoComplete="off"
              value={geminiKeyInput}
              onChange={(e) => setGeminiKeyInput(e.target.value)}
              placeholder="AQ...."
              required
            />
          </div>
          <button className="analyze-btn" type="submit" disabled={savingKey || !geminiKeyInput}>
            {savingKey ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
          {keySaveMessage && (
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--good)' }}>{keySaveMessage}</p>
          )}
          {keySaveError && <div className="error-text" style={{ marginTop: 12 }}>{keySaveError}</div>}
        </form>
      </div>

      <div className="panel">
        <h3>Sotuvchi</h3>
        <p style={{ fontSize: 14 }}>Asadbek</p>
      </div>
    </div>
  );
}
