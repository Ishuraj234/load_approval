"""Shared feature engineering (used by training AND live prediction)."""
RATE = 0.105  # assumed annual interest rate


def emi(principal, months, rate=RATE):
    r = rate / 12
    return principal * r * (1 + r) ** months / ((1 + r) ** months - 1)


def add_dti(df):
    """dti = (new EMI + existing EMI) / monthly income  -> key lending ratio."""
    df = df.copy()
    df["dti"] = (emi(df["loan_amount"], df["loan_term_months"]) + df["existing_emi"]) / df["monthly_income"]
    return df


FEATURES = ["credit_score", "monthly_income", "loan_amount", "loan_term_months",
            "existing_emi", "employment_years", "age", "self_employed",
            "property_owner", "dti"]

LABELS = {"credit_score": "Credit score", "monthly_income": "Monthly income",
          "loan_amount": "Loan amount", "loan_term_months": "Loan term",
          "existing_emi": "Existing EMIs", "employment_years": "Work experience",
          "age": "Age", "self_employed": "Self-employed",
          "property_owner": "Owns property", "dti": "EMI-to-income ratio"}
