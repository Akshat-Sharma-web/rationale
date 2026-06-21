import httpx
from supabase import create_client, Client
from app.config import settings


class HTTP1Transport(httpx.HTTPTransport):
    def __init__(self, **kwargs):
        kwargs['http2'] = False
        super().__init__(**kwargs)


def create_supabase_client() -> Client:
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    # Patch postgrest client to use HTTP/1.1 only
    http1_client = httpx.Client(transport=HTTP1Transport())
    http1_client.headers.update(client.postgrest.session.headers)
    client.postgrest.session = http1_client
    return client


supabase: Client = create_supabase_client()
