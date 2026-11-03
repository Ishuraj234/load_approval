import { useEffect, useState } from "react";

const get = (u) => fetch(u).then((r) => r.json());
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";

const FIELDS = [
  { k: "credit_score", label: "Credit score (CIBIL)", min: 300, max: 900, step: 1 },
  { k: "monthly_income", label: "Monthly income", min: 10000, max: 300000, step: 1000, money: true },
  { k: "loan_amount", label: "Loan amount", min: 50000, max: 5000000, step: 10000, money: true },
  { k: "loan_term_months", label: "Loan term (months)", min: 12, max: 120, step: 12 },
  { k: "existing_emi", label: "Existing monthly EMIs", min: 0, max: 100000, step: 500, money: true },
  { k: "employment_years", label: "Work experience (years)", min: 0, max: 40, step: 0.5 },
  { k: "age", label: "Age", min: 21, max: 65, step: 1 },
];
const PRESETS = {
  "Strong applicant": { credit_score: 780, monthly_income: 90000, loan_amount: 800000, loan_term_months: 60, existing_emi: 3000, employment_years: 8, age: 33, self_employed: 0, property_owner: 1 },
  "Borderline": { credit_score: 650, monthly_income: 45000, loan_amount: 900000, loan_term_months: 48, existing_emi: 6000, employment_years: 3, age: 29, self_employed: 0, property_owner: 0 },
  "Risky applicant": { credit_score: 540, monthly_income: 28000, loan_amount: 1800000, loan_term_months: 36, existing_emi: 8000, employment_years: 1, age: 24, self_employed: 1, property_owner: 0 },
};
const emiCalc = (p, n, r = 0.105) => { const m = r / 12; return (p * m * (1 + m) ** n) / ((1 + m) ** n - 1); };

function Gauge({ value, good }) {
  const R = 70, C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 180 180" className="gauge">
      <circle cx="90" cy="90" r={R} className="g-bg" />
      <circle cx="90" cy="90" r={R} className={"g-fg " + (good ? "good" : "badc")}
        strokeDasharray={C} strokeDashoffset={C * (1 - value)} transform="rotate(-90 90 90)" />
      <text x="90" y="88" textAnchor="middle" className="g-num">{Math.round(value * 100)}%</text>
      <text x="90" y="110" textAnchor="middle" className="g-sub">approval chance</text>
    </svg>
  );
}

function Apply({ onSaved }) {
  const [f, setF] = useState(PRESETS["Borderline"]);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const liveEmi = emiCalc(+f.loan_amount, +f.loan_term_months);

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const r = await fetch("/api/predict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json(); setBusy(false);
    if (!r.ok) return setErr(d.error);
    setRes(d); onSaved();
  };
  const maxImp = res ? Math.max(...res.impact.map((i) => Math.abs(i.impact))) : 1;

  return (
    <div className="grid2 apply">
      <form className="card" onSubmit={submit}>
        <h3>Loan application</h3>
        <div className="chips">
          {Object.keys(PRESETS).map((p) => <button type="button" key={p} className="chip" onClick={() => { setF(PRESETS[p]); setRes(null); }}>{p}</button>)}
        </div>
        {FIELDS.map((x) => (
          <div className="field" key={x.k}>
            <div className="row"><label>{x.label}</label><b>{x.money ? inr(f[x.k]) : f[x.k]}</b></div>
            <input type="range" min={x.min} max={x.max} step={x.step} value={f[x.k]} onChange={(e) => set(x.k, +e.target.value)} />
          </div>
        ))}
        <div className="toggles">
          {[["self_employed", "Self-employed"], ["property_owner", "Owns property"]].map(([k, l]) => (
            <label key={k} className={"toggle " + (f[k] ? "on" : "")}>
              <input type="checkbox" checked={!!f[k]} onChange={(e) => set(k, e.target.checked ? 1 : 0)} />{l}
            </label>
          ))}
        </div>
        <div className="emi">Estimated EMI <b>{inr(liveEmi)}</b>/month <span className="muted small">(10.5% p.a.)</span></div>
        {err && <p className="error">{err}</p>}
        <button className="primary" disabled={busy}>{busy ? "Checking..." : "Check eligibility"}</button>
      </form>

      <div className="card result">
        {!res ? (
          <div className="empty"><div className="icon">🏦</div><h3>Your decision appears here</h3>
            <p className="muted">Pick a profile or move the sliders, then press <b>Check eligibility</b>.</p></div>
        ) : (
          <>
            <Gauge value={res.probability} good={res.decision === "Approved"} />
            <div className={"verdict " + (res.decision === "Approved" ? "good" : "badc")}>
              {res.decision === "Approved" ? "✓ Loan Approved" : "✕ Loan Rejected"}
            </div>
            <div className="minis">
              <div><span>Risk</span><b>{res.risk}</b></div>
              <div><span>EMI</span><b>{inr(res.emi)}</b></div>
              <div><span>EMI / income</span><b>{pct(res.dti, 0)}</b></div>
            </div>
            <h4>Why this decision?</h4>
            {res.impact.slice(0, 5).map((i) => (
              <div className="why" key={i.feature}>
                <span>{i.feature}</span>
                <div className="track"><i className={i.impact >= 0 ? "good" : "badc"} style={{ width: (Math.abs(i.impact) / maxImp) * 100 + "%" }} /></div>
                <span className={"small " + (i.impact >= 0 ? "gt" : "rt")}>{i.impact >= 0 ? "helps" : "hurts"}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const [s, setS] = useState(null), [a, setA] = useState([]), [h, setH] = useState([]);
  useEffect(() => { get("/api/summary").then(setS); get("/api/analytics").then(setA); get("/api/predictions").then(setH); }, []);
  if (!s) return <p>Loading...</p>;
  const m = s.metrics, c = m.confusion;
  const maxCoef = Math.max(...m.coefficients.map((x) => Math.abs(x.coef)));
  return (
    <>
      <div className="grid4">
        <div className="card stat hero-stat"><span>Model accuracy</span><b>{pct(m.accuracy)}</b><small>5-fold CV: {pct(m.cv_accuracy)}</small></div>
        <div className="card stat"><span>Applications in MongoDB</span><b>{s.total.toLocaleString("en-IN")}</b><small>{pct(s.approved / s.total, 0)} approved</small></div>
        <div className="card stat"><span>Precision / Recall</span><b>{pct(m.precision, 0)} / {pct(m.recall, 0)}</b><small>F1 {pct(m.f1)}</small></div>
        <div className="card stat"><span>ROC-AUC</span><b>{m.roc_auc.toFixed(3)}</b><small>tested on {m.test_size} applications</small></div>
      </div>
      <div className="grid2">
        <div className="card"><h3>Approval rate by credit score</h3>
          <div className="bars">{a.map((b) => (
            <div key={b.band} className="vb"><em>{pct(b.rate, 0)}</em><div className="col"><i style={{ height: b.rate * 100 + "%" }} /></div><span>{b.band}</span></div>
          ))}</div>
        </div>
        <div className="card"><h3>Confusion matrix</h3>
          <div className="cm"><span /><b>Pred: Reject</b><b>Pred: Approve</b>
            <b>Actual: Reject</b><div className="good">TN {c.tn}</div><div className="badc">FP {c.fp}</div>
            <b>Actual: Approve</b><div className="badc">FN {c.fn}</div><div className="good">TP {c.tp}</div></div>
          <p className="muted small">FP = bad loan approved (costly for the bank). FN = good customer rejected.</p>
        </div>
      </div>
      <div className="grid2">
        <div className="card"><h3>What the model learned</h3>
          {[...m.coefficients].sort((x, y) => Math.abs(y.coef) - Math.abs(x.coef)).map((x) => (
            <div className="why" key={x.feature}><span>{x.label}</span>
              <div className="track"><i className={x.coef >= 0 ? "good" : "badc"} style={{ width: (Math.abs(x.coef) / maxCoef) * 100 + "%" }} /></div>
              <span className="small">{x.coef >= 0 ? "+" : "−"}{Math.abs(x.coef).toFixed(2)}</span></div>
          ))}
        </div>
        <div className="card"><h3>Recent checks (saved in MongoDB)</h3>
          {h.length === 0 && <p className="muted">No checks yet. Try the Apply tab.</p>}
          {h.map((x, i) => (<div className="hist" key={i}><span>{inr(x.loan_amount)} · CIBIL {x.credit_score}</span>
            <span className={"pill " + (x.decision === "Approved" ? "good" : "badc")}>{pct(x.approval_probability, 0)} {x.decision}</span></div>))}
        </div>
      </div>
    </>
  );
}

function Applications() {
  const [d, setD] = useState({ rows: [], pages: 1, total: 0 });
  const [page, setPage] = useState(1), [search, setSearch] = useState(""), [ap, setAp] = useState("");
  useEffect(() => {
    const t = setTimeout(() => get(`/api/applications?page=${page}&limit=10&search=${encodeURIComponent(search)}&approved=${ap}`).then(setD), 250);
    return () => clearTimeout(t);
  }, [page, search, ap]);
  return (
    <div className="card"><h3>Applications dataset ({d.total.toLocaleString("en-IN")})</h3>
      <div className="filters">
        <input placeholder="Search applicant name..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={ap} onChange={(e) => { setAp(e.target.value); setPage(1); }}>
          <option value="">All</option><option value="1">Approved</option><option value="0">Rejected</option></select>
      </div>
      <div className="scroll"><table><thead><tr><th>ID</th><th>Applicant</th><th>CIBIL</th><th>Income</th><th>Loan</th><th>Term</th><th>Status</th></tr></thead>
        <tbody>{d.rows.map((r) => (<tr key={r.application_id}><td>{r.application_id}</td><td>{r.name}</td><td>{r.credit_score}</td>
          <td>{inr(r.monthly_income)}</td><td>{inr(r.loan_amount)}</td><td>{r.loan_term_months}m</td>
          <td><span className={"pill " + (r.approved ? "good" : "badc")}>{r.approved ? "Approved" : "Rejected"}</span></td></tr>))}</tbody></table></div>
      <div className="pager"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
        <span>Page {d.page || page} of {d.pages}</span><button disabled={page >= d.pages} onClick={() => setPage(page + 1)}>Next</button></div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("apply");
  const [k, setK] = useState(0);
  const [down, setDown] = useState(false);
  useEffect(() => { get("/api/summary").catch(() => setDown(true)); }, []);
  return (
    <>
      <header className="nav"><div className="brand"><span>◆</span> QuickLoan</div>
        <nav>{[["apply", "Apply"], ["dash", "Dashboard"], ["apps", "Applications"]].map(([id, l]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{l}</button>))}</nav></header>
      <section className="hero"><h1>Instant loan eligibility</h1>
        <p>AI-powered decision in seconds. Logistic Regression trained on 5,000 applications stored in MongoDB.</p></section>
      <main className="wrap">
        {down ? <p className="error">Cannot reach the backend. Start it with: python app.py</p> :
          tab === "apply" ? <Apply onSaved={() => setK(k + 1)} /> : tab === "dash" ? <Dashboard key={k} /> : <Applications />}
      </main>
    </>
  );
}
