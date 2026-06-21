from supabase import create_client, Client
from app.config import settings


def create_supabase_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


supabase: Client = create_supabase_client()
