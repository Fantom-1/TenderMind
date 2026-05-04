from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, validator
from sqlalchemy.orm import Session

from app.core.security import create_access_token, verify_password
from app.db.postgres import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str

    @validator("email")
    def validate_email(cls, value: str) -> str:
        value = value.strip()
        if "@" not in value or " " in value:
            raise ValueError("invalid email")
        return value


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    email: str


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.query(User).filter(User.email == body.email).one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid_credentials")
    token = create_access_token(sub=user.email, role=user.role)
    return LoginResponse(access_token=token, role=user.role, email=user.email)
