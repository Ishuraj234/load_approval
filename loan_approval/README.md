# QuickLoan: Loan Approval Predictor (MongoDB + Logistic Regression + React)

```
data/loans.csv (5000 rows) -> MongoDB -> Flask API -> React UI
                                 |           |
                                 |     Logistic Regression (scikit-learn)
                                 +<-- saved checks
```

## Files
| File | Purpose |
|------|---------|
| `generate_dataset.py` | Creates `data/loans.csv` (5000 synthetic applications) |
| `db.py` | MongoDB connection (real server or `USE_MOCK=1` in-memory) |
| `features.py` | EMI formula + derived feature `dti` (EMI-to-income ratio), shared by training and prediction |
| `seed_data.py` | Imports the CSV into `loanDB.applications` |
| `train_model.py` | Fetch -> Pandas -> split -> scale -> train -> evaluate. `python train_model.py` prints metrics |
| `app.py` | Flask API: summary, analytics, applications, predict, predictions |
| `frontend/` | React (Vite) UI: Apply / Dashboard / Applications |

## Run (Windows PowerShell)
Open the folder that contains `app.py` first (`dir` should show it).

```powershell
# Terminal 1: backend
pip install -r requirements.txt
python seed_data.py              # needs MongoDB on localhost:27017
python app.py                    # http://localhost:5000
# No MongoDB?  ->  $env:USE_MOCK=1; python app.py

# Terminal 2: frontend
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

## About the 95% accuracy
Data is synthetic: approval = a rule on credit score, EMI-to-income ratio, income, experience, etc. plus random noise.
The noise level is set so the model really measures about 95% on unseen test data (and ~95% in 5-fold CV).
Real bank data is messier, expect ~80-90%. Change the noise: `python generate_dataset.py 1.5`, then `python seed_data.py`.

## Ideas to extend
Compare with Random Forest, tune the decision threshold, add login, upload your own CSV.
