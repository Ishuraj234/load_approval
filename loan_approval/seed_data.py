"""Import data/loans.csv into MongoDB (loanDB.applications)."""
import os
import pandas as pd
from db import get_db

CSV = os.path.join(os.path.dirname(__file__), "data", "loans.csv")


def seed(db=None):
    db = db if db is not None else get_db()
    if not os.path.exists(CSV):
        import generate_dataset  # noqa: F401
    rows = pd.read_csv(CSV).to_dict("records")
    db.applications.drop()
    db.applications.insert_many(rows)
    print(f"Imported {len(rows)} loan applications into loanDB.applications")


if __name__ == "__main__":
    seed()
