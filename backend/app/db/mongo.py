from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database

from app.config import get_settings


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    s = get_settings()
    return MongoClient(s.mongo_uri, uuidRepresentation="standard")


def get_mongo_db() -> Database:
    s = get_settings()
    return get_mongo_client()[s.mongo_db]
