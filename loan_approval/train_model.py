"""MongoDB -> Pandas -> feature engineering -> scale -> Logistic Regression."""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from db import get_db
from features import FEATURES, LABELS, add_dti


def train(db):
    df = pd.DataFrame(list(db.applications.find({}, {"_id": 0})))
    if df.empty:
        raise SystemExit("applications collection is empty. Run seed_data.py first.")
    df = add_dti(df)
    X, y = df[FEATURES], df["approved"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

    # Pipeline = scaler + model; the scaler is fitted on TRAIN data only (no leakage)
    pipe = make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000))
    pipe.fit(X_tr, y_tr)
    pred, proba = pipe.predict(X_te), pipe.predict_proba(X_te)[:, 1]
    tn, fp, fn, tp = confusion_matrix(y_te, pred, labels=[0, 1]).ravel()
    cv = cross_val_score(make_pipeline(StandardScaler(), LogisticRegression(max_iter=1000)),
                         X, y, cv=5).mean()
    coefs = pipe[-1].coef_[0]
    metrics = {
        "records": int(len(df)), "train_size": int(len(X_tr)), "test_size": int(len(X_te)),
        "accuracy": accuracy_score(y_te, pred), "precision": precision_score(y_te, pred),
        "recall": recall_score(y_te, pred), "f1": f1_score(y_te, pred),
        "roc_auc": roc_auc_score(y_te, proba), "cv_accuracy": float(cv),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "coefficients": [{"feature": f, "label": LABELS[f], "coef": float(c),
                          "odds_ratio": float(np.exp(c))} for f, c in zip(FEATURES, coefs)],
    }
    return {"pipe": pipe, "metrics": metrics}


def predict_one(state, raw: dict):
    """raw = dict of the 9 raw inputs. Returns probability + per-feature impact."""
    row = add_dti(pd.DataFrame([raw]))[FEATURES]
    scaler, model = state["pipe"][0], state["pipe"][-1]
    scaled = scaler.transform(row)[0]
    prob = float(model.predict_proba(scaler.transform(row))[0][1])
    impact = sorted(({"feature": LABELS[f], "impact": float(c * v)}
                     for f, c, v in zip(FEATURES, model.coef_[0], scaled)),
                    key=lambda d: abs(d["impact"]), reverse=True)
    return prob, float(row["dti"].iloc[0]), impact


if __name__ == "__main__":
    m = train(get_db())["metrics"]
    for k in ("accuracy", "cv_accuracy", "precision", "recall", "f1", "roc_auc"):
        print(f"{k:12s}: {m[k]:.4f}")
    print("Confusion:", m["confusion"])
