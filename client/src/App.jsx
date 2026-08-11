import { useState, useEffect } from 'react';
import { getAccounts, createAccount, getBalance, getAudit, createTransaction } from './api';

const styles = {
  page: {
    minHeight: '100vh',
    padding: '48px 24px 80px',
  },
  container: {
    maxWidth: 880,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 40,
    paddingBottom: 24,
    borderBottom: '1px solid var(--border)',
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: '0.08em',
    color: 'var(--muted)',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: 700,
    margin: 0,
    letterSpacing: '-0.01em',
  },
  liveTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--muted)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: 'var(--credit)',
    boxShadow: '0 0 0 3px rgba(61, 220, 151, 0.15)',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--muted)',
    marginBottom: 14,
    letterSpacing: '0.02em',
  },
  section: { marginBottom: 44 },
  ledgerCard: {
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  accountRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 100px 160px 90px',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    gap: 12,
  },
  accountRowHead: {
    display: 'grid',
    gridTemplateColumns: '1fr 100px 160px 90px',
    padding: '12px 20px',
    fontSize: 11,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid var(--border)',
  },
  accountName: { fontWeight: 500, fontSize: 14.5 },
  typeTag: {
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 5,
    background: '#1A2030',
    color: 'var(--muted)',
    width: 'fit-content',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  balance: { fontSize: 15, fontWeight: 600, textAlign: 'right' },
  ghostBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--muted)',
    borderRadius: 6,
    padding: '6px 12px',
    fontSize: 12.5,
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    justifySelf: 'end',
  },
  formsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
  },
  formCard: {
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: 22,
  },
  formTitle: { fontSize: 14.5, fontWeight: 600, marginBottom: 16 },
  field: { marginBottom: 12 },
  label: {
    display: 'block',
    fontSize: 11.5,
    color: 'var(--muted)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  input: {
    width: '100%',
    background: '#0D1119',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '9px 11px',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
  },
  primaryBtn: {
    width: '100%',
    background: 'var(--action)',
    border: 'none',
    borderRadius: 6,
    padding: '10px 14px',
    color: '#0B0E14',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    marginTop: 6,
  },
  errorBox: {
    background: 'var(--danger-bg)',
    color: 'var(--danger-text)',
    border: '1px solid #3A1E20',
    borderRadius: 8,
    padding: '12px 16px',
    fontSize: 13.5,
    marginBottom: 24,
  },
  auditPanel: {
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '22px 24px',
    marginTop: 44,
  },
  auditHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: '1px solid var(--border)',
  },
  auditRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #1A1F2B',
    fontSize: 13,
  },
  emptyState: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: 13.5,
  },
};

function formatAmount(n) {
  const num = Number(n);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [balances, setBalances] = useState({});
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('asset');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [auditAccount, setAuditAccount] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const list = await getAccounts();
    setAccounts(list);
    const balanceMap = {};
    for (const acc of list) {
      const b = await getBalance(acc.id);
      balanceMap[acc.id] = b.balance;
    }
    setBalances(balanceMap);
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  async function handleCreateAccount(e) {
    e.preventDefault();
    setError('');
    try {
      await createAccount(newName, newType);
      setNewName('');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setError('');
    if (fromId === toId) {
      setError('Choose two different accounts to transfer between.');
      return;
    }
    try {
      await createTransaction('Transfer', [
        { accountId: fromId, amount: -Number(amount) },
        { accountId: toId, amount: Number(amount) }
      ]);
      setAmount('');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }

  async function handleViewAudit(id) {
    setAuditAccount(id);
    const data = await getAudit(id);
    setAuditData(data);
  }

  const totalBalance = Object.values(balances).reduce((a, b) => a + Number(b), 0);

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        <div style={styles.header}>
          <div>
            <div style={styles.eyebrow}>Event-Sourced Core</div>
            <h1 style={styles.title}>Ledger</h1>
          </div>
          <div style={styles.liveTag}>
            <span style={styles.dot}></span>
            {accounts.length} accounts &middot; <span className="mono">{formatAmount(totalBalance)}</span> in system
          </div>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        <div style={styles.section}>
          <div style={styles.sectionLabel}>Accounts</div>
          <div style={styles.ledgerCard}>
            <div style={styles.accountRowHead}>
              <span>Name</span><span>Type</span><span style={{textAlign: 'right'}}>Balance</span><span></span>
            </div>
            {loading && <div style={styles.emptyState}>Loading ledger…</div>}
            {!loading && accounts.length === 0 && (
              <div style={styles.emptyState}>No accounts yet. Create one below to start the ledger.</div>
            )}
            {accounts.map(acc => (
              <div key={acc.id} style={styles.accountRow}>
                <span style={styles.accountName}>{acc.name}</span>
                <span style={styles.typeTag}>{acc.type}</span>
                <span
                  className="mono"
                  style={{
                    ...styles.balance,
                    color: Number(balances[acc.id]) < 0 ? 'var(--debit)' : 'var(--text)'
                  }}
                >
                  {balances[acc.id] !== undefined ? Number(balances[acc.id]).toFixed(2) : '···'}
                </span>
                <button style={styles.ghostBtn} onClick={() => handleViewAudit(acc.id)}>Audit</button>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionLabel}>Actions</div>
          <div style={styles.formsGrid}>

            <div style={styles.formCard}>
              <div style={styles.formTitle}>New account</div>
              <form onSubmit={handleCreateAccount}>
                <div style={styles.field}>
                  <label style={styles.label}>Name</label>
                  <input style={styles.input} placeholder="e.g. Alice Checking" value={newName} onChange={e => setNewName(e.target.value)} required />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Type</label>
                  <select style={styles.input} value={newType} onChange={e => setNewType(e.target.value)}>
                    <option value="asset">Asset</option>
                    <option value="liability">Liability</option>
                    <option value="equity">Equity</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
                <button style={styles.primaryBtn} type="submit">Create account</button>
              </form>
            </div>

            <div style={styles.formCard}>
              <div style={styles.formTitle}>Transfer funds</div>
              <form onSubmit={handleTransfer}>
                <div style={styles.field}>
                  <label style={styles.label}>From</label>
                  <select style={styles.input} value={fromId} onChange={e => setFromId(e.target.value)} required>
                    <option value="">Select account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>To</label>
                  <select style={styles.input} value={toId} onChange={e => setToId(e.target.value)} required>
                    <option value="">Select account</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Amount</label>
                  <input style={styles.input} className="mono" type="number" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} required />
                </div>
                <button style={styles.primaryBtn} type="submit">Send transfer</button>
              </form>
            </div>

          </div>
        </div>

        {auditData && (
          <div style={styles.auditPanel}>
            <div style={styles.auditHeader}>
              <div>
                <div style={styles.sectionLabel}>Audit trail</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {accounts.find(a => a.id === auditAccount)?.name}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 700 }}>
                {Number(auditData.finalBalance).toFixed(2)}
              </div>
            </div>
            {auditData.trail.length === 0 && (
              <div style={styles.emptyState}>No entries yet for this account.</div>
            )}
            {auditData.trail.map(t => (
              <div key={t.entryId} style={styles.auditRow}>
                <span style={{ color: 'var(--muted)' }}>{t.description}</span>
                <span className="mono" style={{ color: t.amount >= 0 ? 'var(--credit)' : 'var(--debit)', fontWeight: 600 }}>
                  {formatAmount(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}