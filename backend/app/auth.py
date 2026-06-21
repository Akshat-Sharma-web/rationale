import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, jwk
from jose.utils import base64url_decode
import json

from app.config import settings

security = HTTPBearer(auto_error=True)

# Fetch Supabase public JWKS once at startup
def _get_jwks() -> dict:
    url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    response = httpx.get(url)
    return response.json()

JWKS = _get_jwks()


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials,
            JWKS,
            algorithms=["ES256", "HS256"],
            options={"verify_aud": False},
        )
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise credentials_exception
        return user_id

    except JWTError:
        raise credentials_exception