import { useCallback, useEffect, useState } from 'react';
import {
  clearAuthToken,
  createAccount,
  createTransaction,
  getAccounts,
  getAudit,
  getBalance,
  getStoredToken,
  login,
  register
} from './api';

const styles = {
  page: {
    minHeight: '100vh',
    padding: '36px 20px 72px',
    background: 'radial-gradient(circle at 10% 0%, rgba(91, 141, 239, 0.12), transparent 34%), radial-gradient(circle at 90% 0%, rgba(61, 220, 151, 0.10), transparent 28%), var(--bg)'
  },
  container: {
    maxWidth: 960,
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    paddingBottom: 20,
    marginBottom: 24,
    gap: 12,
    flexWrap: 'wrap'
  },
  eyebrow: {
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    color: 'var(--muted)',
    fontSize: 11,
    marginBottom: 8
  },
  title: {
    margin: 0,
    fontSize: 'clamp(28px, 4vw, 44px)',
    lineHeight: 1,
    letterSpacing: '-0.04em'
  },
  subtext: {
    color: 'var(--muted)',
    marginTop: 12,
    marginBottom: 0,
    maxWidth: 640,
    lineHeight: 1.5,
    fontSize: 14
  },
  panel: {
    background: 'rgba(19, 23, 32, 0.92)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 18
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: 16
  },
  authGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16
  },
  field: {
    marginBottom: 12
  },
  label: {
    display: 'block',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--muted)',
    marginBottom: 6
  },
  input: {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: '#0C1018',
    color: 'var(--text)',
    padding: '10px 12px',
    fontSize: 14
  },
  button: {
    border: 'none',
    borderRadius: 10,
    background: 'var(--action)',
    color: '#09101B',
    fontWeight: 700,
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 14
  },
  ghostButton: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    background: 'transparent',
    color: 'var(--muted)',
    fontWeight: 600,
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 13
  },
  error: {
    background: 'var(--danger-bg)',
    color: 'var(--danger-text)',
    border: '1px solid #3A1E20',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 16,
    fontSize: 13
  },
  table: {
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden'
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.6fr 0.6fr 0.5fr',
    gap: 10,
    color: 'var(--muted)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)'
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 0.6fr 0.6fr 0.5fr',
    gap: 10,
    alignItems: 'center',
    padding: '12px 14px',
    borderBottom: '1px solid #1C2230'
  },
  empty: {
    color: 'var(--muted)',
    textAlign: 'center',
    padding: '26px 10px',
    fontSize: 13
  },
  small: {
    color: 'var(--muted)',
    fontSize: 13,
    marginTop: 8
  },
  footer: {
    marginTop: 12,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10
  }
};

function formatError(err) {
  return err?.response?.data?.error || err?.message || 'Something went wrong';
}

function formatAmount(value) {
  const n = Number(value || 0);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}`;
}

export default function App() {
  const [session, setSession] = useState(() => (getStoredToken() ? { token: getStoredToken() } : null));
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [accountsCursor, setAccountsCursor] = useState(null);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('asset');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');

  const [auditAccountId, setAuditAccountId] = useState('');
  const [auditData, setAuditData] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadBalances = useCallback(async (list) => {
    const pairs = await Promise.all(
      list.map(async (acc) => {
        const data = await getBalance(acc.id);
        return [acc.id, Number(data.balance || 0)];
      })
    );

    setBalances((prev) => {
      const next = { ...prev };
      for (const [id, value] of pairs) {
        next[id] = value;
      }
      return next;
    });
  }, []);

  const loadAccounts = useCallback(async ({ cursor, append = false } = {}) => {
    if (!session) return;
    setLoading(true);
    setError('');

    try {
      const page = await getAccounts({ cursor, limit: 10 });
      const list = page.items || [];
      setAccounts((prev) => (append ? [...prev, ...list] : list));
      setAccountsCursor(page.nextCursor || null);
      await loadBalances(list);
    } catch (err) {
      if (err?.response?.status === 401) {
        clearAuthToken();
        setSession(null);
      }
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, [loadBalances, session]);

  const loadAudit = useCallback(async (accountId, cursor, append = false) => {
    setAuditLoading(true);
    setError('');

    try {
      const page = await getAudit(accountId, cursor, 10);
      setAuditAccountId(accountId);
      setAuditData((prev) => {
        if (!append || !prev) return page;
        return { ...page, trail: [...prev.trail, ...page.trail] };
      });
    } catch (err) {
      if (err?.response?.status === 401) {
        clearAuthToken();
        setSession(null);
      }
      setError(formatError(err));
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) {
      queueMicrotask(() => {
        void loadAccounts();
      });
    }
  }, [loadAccounts, session]);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthBusy(true);
    setError('');

    try {
      const result = mode === 'register' ? await register(email, password) : await login(email, password);
      setSession(result);
      setPassword('');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleCreateAccount(event) {
    event.preventDefault();
    setError('');

    try {
      await createAccount(newName, newType);
      setNewName('');
      await loadAccounts();
    } catch (err) {
      setError(formatError(err));
    }
  }

  async function handleTransfer(event) {
    event.preventDefault();
    setError('');

    if (fromId === toId) {
      setError('Choose two different accounts.');
      return;
    }

    try {
      await createTransaction('Transfer', [
        { accountId: fromId, amount: -Number(amount) },
        { accountId: toId, amount: Number(amount) }
      ]);
      setAmount('');
      await loadAccounts();
      if (auditAccountId) {
        await loadAudit(auditAccountId, null, false);
      }
    } catch (err) {
      setError(formatError(err));
    }
  }

  const total = Object.values(balances).reduce((sum, value) => sum + Number(value || 0), 0);

  if (!session) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.header}>
            <div>
              <div style={styles.eyebrow}>Ledger Access</div>
              <h1 style={styles.title}>Authenticate to access your ledger.</h1>
              <p style={styles.subtext}>
                The API is now protected by JWT auth and account ownership checks. Register once, then sign in and work only with your own accounts.
              </p>
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.authGrid}>
            <div style={styles.panel}>
              <h2 style={styles.sectionTitle}>Session model</h2>
              <p style={styles.subtext}>
                Tokens are stored locally and sent as Bearer headers through the Axios interceptor. Rate limits are applied on auth and transaction routes.
              </p>
            </div>

            <div style={styles.panel}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button type="button" style={{ ...styles.ghostButton, ...(mode === 'login' ? { color: 'var(--text)', borderColor: 'var(--action)' } : {}) }} onClick={() => setMode('login')}>
                  Login
                </button>
                <button type="button" style={{ ...styles.ghostButton, ...(mode === 'register' ? { color: 'var(--text)', borderColor: 'var(--action)' } : {}) }} onClick={() => setMode('register')}>
                  Register
                </button>
              </div>

              <form onSubmit={handleAuthSubmit}>
                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <input style={styles.input} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Password</label>
                  <input style={styles.input} type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
                </div>
                <button style={styles.button} type="submit" disabled={authBusy}>
                  {authBusy ? 'Working...' : mode === 'register' ? 'Create account' : 'Sign in'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>Event-Sourced Core</div>
            <h1 style={styles.title}>Ledger</h1>
            <p style={styles.subtext}>Authenticated session. Accounts: {accounts.length}. Total balance: <span className="mono">{formatAmount(total)}</span>.</p>
          </div>
          <button type="button" style={styles.ghostButton} onClick={() => { clearAuthToken(); setSession(null); }}>
            Log out
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.panel}>
          <h2 style={styles.sectionTitle}>Accounts</h2>
          <div style={styles.table}>
            <div style={styles.tableHead}>
              <span>Name</span>
              <span>Type</span>
              <span style={{ textAlign: 'right' }}>Balance</span>
              <span />
            </div>
            {accounts.map((acc) => (
              <div key={acc.id} style={styles.row}>
                <span>{acc.name}</span>
                <span>{acc.type}</span>
                <span style={{ textAlign: 'right' }} className="mono">{formatAmount(balances[acc.id])}</span>
                <button type="button" style={styles.ghostButton} onClick={() => loadAudit(acc.id, null, false)}>
                  Audit
                </button>
              </div>
            ))}
            {loading && <div style={styles.empty}>Loading...</div>}
            {!loading && accounts.length === 0 && <div style={styles.empty}>No accounts yet.</div>}
          </div>
          <div style={styles.footer}>
            <span style={styles.small}>Cursor-based pagination for account listing is enabled.</span>
            {accountsCursor && (
              <button type="button" style={styles.ghostButton} onClick={() => loadAccounts({ cursor: accountsCursor, append: true })}>
                Load more accounts
              </button>
            )}
          </div>
        </div>

        <div style={{ ...styles.formGrid, marginTop: 16 }}>
          <div style={styles.panel}>
            <h2 style={styles.sectionTitle}>Create account</h2>
            <form onSubmit={handleCreateAccount}>
              <div style={styles.field}>
                <label style={styles.label}>Name</label>
                <input style={styles.input} value={newName} onChange={(event) => setNewName(event.target.value)} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Type</label>
                <select style={styles.input} value={newType} onChange={(event) => setNewType(event.target.value)}>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <button style={styles.button} type="submit">Create</button>
            </form>
          </div>

          <div style={styles.panel}>
            <h2 style={styles.sectionTitle}>Transfer</h2>
            <form onSubmit={handleTransfer}>
              <div style={styles.field}>
                <label style={styles.label}>From</label>
                <select style={styles.input} value={fromId} onChange={(event) => setFromId(event.target.value)} required>
                  <option value="">Select</option>
                  {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>To</label>
                <select style={styles.input} value={toId} onChange={(event) => setToId(event.target.value)} required>
                  <option value="">Select</option>
                  {accounts.map((acc) => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                </select>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Amount</label>
                <input style={styles.input} type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
              </div>
              <button style={styles.button} type="submit">Send</button>
            </form>
          </div>
        </div>

        {auditData && (
          <div style={{ ...styles.panel, marginTop: 16 }}>
            <h2 style={styles.sectionTitle}>Audit trail</h2>
            <p style={styles.subtext}>
              Account: <span className="mono">{auditAccountId}</span> | Final balance: <span className="mono">{formatAmount(auditData.finalBalance)}</span>
            </p>
            {(auditData.trail || []).map((item) => (
              <div key={item.entryId} style={{ ...styles.row, gridTemplateColumns: '1.4fr 0.4fr' }}>
                <div>
                  <div>{item.description}</div>
                  <div style={styles.small}>{item.explanation}</div>
                </div>
                <div className="mono" style={{ textAlign: 'right' }}>{formatAmount(item.amount)}</div>
              </div>
            ))}
            {auditLoading && <div style={styles.empty}>Loading audit...</div>}
            {auditData.nextCursor && (
              <div style={styles.footer}>
                <span style={styles.small}>Audit trail pagination is enabled.</span>
                <button type="button" style={styles.ghostButton} onClick={() => loadAudit(auditAccountId, auditData.nextCursor, true)}>
                  Load more entries
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
