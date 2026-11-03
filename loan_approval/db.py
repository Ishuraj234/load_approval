"""MongoDB connection helper (real server, or USE_MOCK=1 for an in-memory fake)."""
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = "loanDB"
USE_MOCK = os.getenv("USE_MOCK", "0") == "1"
_mock = None


def get_db():
    global _mock
    if USE_MOCK:
        import mongomock
        _mock = _mock or mongomock.MongoClient()
        return _mock[DB_NAME]
    from pymongo import MongoClient
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
    try:
        client.admin.command("ping")
    except Exception as exc:
        raise SystemExit(f"\nMongoDB not reachable at {MONGO_URI}\n({exc})\n\n"
                         "Start MongoDB, or run without it:\n"
                         "  PowerShell:  $env:USE_MOCK=1; python app.py\n")
    return client[DB_NAME]
