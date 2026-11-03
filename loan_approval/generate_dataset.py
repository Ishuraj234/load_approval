"""Generate a synthetic 5000-row loan dataset -> data/loans.csv"""
import os, sys
import numpy as np
import pandas as pd
from features import add_dti

N = 5000
NOISE = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0   # higher = noisier labels
rng = np.random.default_rng(7)

first = ["Aarav","Vivaan","Aditya","Ananya","Diya","Ishaan","Kavya","Rohan","Sneha","Arjun",
         "Meera","Kabir","Riya","Neha","Karan","Simran","Rahul","Pooja","Vikas","Anjali"]
last = ["Sharma","Verma","Singh","Gupta","Kumar","Mehta","Jain","Yadav","Reddy","Patel"]

age = np.clip(rng.normal(35, 9, N), 21, 65).round().astype(int)
emp_years = np.clip(rng.normal((age - 21) * 0.5, 3), 0, 40).round(1)
income = np.clip(rng.lognormal(np.log(45000), 0.45, N) * (1 + 0.01 * emp_years), 15000, 300000)
income = (income / 100).round() * 100
credit = np.clip(rng.normal(690 + emp_years * 1.5, 80), 300, 900).round().astype(int)
loan = np.clip(income * rng.uniform(5, 50, N), 50000, 5000000)
loan = (loan / 10000).round() * 10000
term = rng.choice([12, 24, 36, 48, 60, 84], N)
existing = (income * rng.uniform(0, 0.4, N) * (rng.random(N) < 0.6) / 100).round() * 100
self_emp = (rng.random(N) < 0.3).astype(int)
prop = (rng.random(N) < np.clip(0.2 + income / 250000, 0, 0.9)).astype(int)

df = pd.DataFrame({"credit_score": credit, "monthly_income": income, "loan_amount": loan,
                   "loan_term_months": term, "existing_emi": existing,
                   "employment_years": emp_years, "age": age,
                   "self_employed": self_emp, "property_owner": prop})
df = add_dti(df)

z = (0.020 * (df.credit_score - 640) - 9.0 * (df.dti - 0.55) + 0.000012 * (df.monthly_income - 45000)
     + 0.05 * df.employment_years.clip(upper=10) + 0.5 * prop - 0.3 * self_emp)
approved = (rng.random(N) < 1 / (1 + np.exp(-z / (0.35 * NOISE)))).astype(int)

out = df.drop(columns="dti")
out.insert(0, "name", [f"{rng.choice(first)} {rng.choice(last)}" for _ in range(N)])
out.insert(0, "application_id", [f"LN{100000 + i}" for i in range(N)])
out["approved"] = approved
os.makedirs("data", exist_ok=True)
out.to_csv("data/loans.csv", index=False)
print(f"Saved data/loans.csv rows={N} approval rate={approved.mean():.1%}")
