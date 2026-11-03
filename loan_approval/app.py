"""Flask API.  Run: python app.py  (http://localhost:5000)"""
import re
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

from db import get_db
from features import RATE, emi
from seed_data import seed
from train_model import predict_one, train

app = Flask(__name__)
CORS(app)
db = get_db()
if db.applications.count_documents({}) == 0:
    seed(db)
STATE = train(db)
print("Model trained. Test accuracy:", round(STATE["metrics"]["accuracy"], 4))

LIMITS = {"credit_score": (300, 900), "monthly_income": (5000, 1000000),
          "loan_amount": (10000, 20000000), "loan_term_months": (6, 360),
          "existing_emi": (0, 500000), "employment_years": (0, 50), "age": (18, 75),
          "self_employed": (0, 1), "property_owner": (0, 1)}


@app.get("/api/summary")
def summary():
    total = db.applications.count_documents({})
    ok = db.applications.count_documents({"approved": 1})
    return jsonify({"total": total, "approved": ok, "rejected": total - ok,
                    "metrics": STATE["metrics"], "rate": RATE})


@app.get("/api/analytics")
def analytics():
    df = pd.DataFrame(list(db.applications.find({}, {"_id": 0})))
    bands = pd.cut(df.credit_score, [299, 550, 650, 700, 750, 900],
                   labels=["<550", "550-650", "650-700", "700-750", "750+"])
    by = df.groupby(bands, observed=False).approved.agg(["mean", "count"]).reset_index()
    return jsonify([{"band": str(r.credit_score), "rate": float(r["mean"]), "count": int(r["count"])}
                    for _, r in by.iterrows()])


@app.get("/api/applications")
def applications():
    page = max(int(request.args.get("page", 1)), 1)
    limit = min(max(int(request.args.get("limit", 10)), 1), 100)
    q = {}
    s = request.args.get("search", "").strip()
    if s:
        q["name"] = {"$regex": re.escape(s), "$options": "i"}
    if request.args.get("approved") in ("0", "1"):
        q["approved"] = int(request.args["approved"])
    total = db.applications.count_documents(q)
    rows = list(db.applications.find(q, {"_id": 0}).sort("application_id", 1)
                .skip((page - 1) * limit).limit(limit))
    return jsonify({"total": total, "page": page, "pages": max(-(-total // limit), 1), "rows": rows})


@app.post("/api/predict")
def predict():
    data = request.get_json(silent=True) or {}
    raw = {}
    for f, (lo, hi) in LIMITS.items():
        try:
            v = float(data[f])
        except (KeyError, TypeError, ValueError):
            return jsonify({"error": f"'{f}' is required and must be a number"}), 400
        if not lo <= v <= hi:
            return jsonify({"error": f"'{f}' must be between {lo} and {hi}"}), 400
        raw[f] = v
    prob, dti, impact = predict_one(STATE, raw)
    decision = "Approved" if prob >= 0.5 else "Rejected"
    risk = "Low" if prob >= 0.8 else "Medium" if prob >= 0.5 else "High"
    monthly = emi(raw["loan_amount"], raw["loan_term_months"])
    db.loan_predictions.insert_one({**raw, "approval_probability": prob, "decision": decision})
    return jsonify({"probability": prob, "decision": decision, "risk": risk,
                    "emi": monthly, "dti": dti, "impact": impact})


@app.get("/api/predictions")
def predictions():
    return jsonify(list(db.loan_predictions.find({}, {"_id": 0}).sort("_id", -1).limit(8)))


if __name__ == "__main__":
    app.run(port=5000, debug=False)
