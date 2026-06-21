import httpx
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from app.config import settings


def create_supabase_client() -> Client:
    options = ClientOptions(
        postgrest_client_timeout=30,
        storage_client_timeout=30,
    )
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, options=options)
    client.postgrest.session = httpx.Client(http2=False)
    return client


supabase: Client = create_supabase_client()
