export type Fetch = typeof fetch;

const UA = "Mozilla/5.0 (compatible; simbolik-bot/1.0)";

/** GET lewat https dengan batas waktu dan batas ukuran. Mengembalikan isi sebagai teks. */
export async function getText(url: string, fetchFn: Fetch = fetch, timeoutMs = 8000): Promise<string> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error(`hanya https yang diizinkan (${u.protocol})`);
  let res: Response;
  try {
    res = await fetchFn(url, {
      headers: { "user-agent": UA, accept: "text/html,application/json;q=0.9" },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
  } catch (e) {
    const name = (e as Error).name;
    if (name === "TimeoutError" || name === "AbortError") throw new Error(`waktu habis (${timeoutMs / 1000} dtk) menghubungi ${u.host}`);
    throw e;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} dari ${u.host}`);
  return (await res.text()).slice(0, 2_000_000);
}
