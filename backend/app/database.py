from supabase import create_client, Client
from app.config import settings


def create_supabase_client() -> Client:
    """
    Returns a Supabase client authenticated with the service_role key.

    The service key bypasses Row Level Security — use only in backend
    server contexts, never in client-facing code.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


# Module-level singleton so connections are reused across requests
supabase: Client = create_supabase_client()
