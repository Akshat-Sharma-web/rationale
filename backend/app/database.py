import httpx
from supabase import create_client, Client
from app.config import settings


def create_supabase_client() -> Client:
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    # Force HTTP/1.1 to avoid HTTP/2 stream reset errors on Render free tier
    client.postgrest.session = httpx.Client(
        http2=False,
        headers=client.postgrest.session.headers,
    )
    return client


supabase: Client = create_supabase_client()
