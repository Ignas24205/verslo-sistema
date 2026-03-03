import { supabase } from "@/src/lib/supabaseClient";

export default async function TestDbPage() {
  const { data, error } = await supabase
    .from("products")
    .select("id,name")
    .limit(5);

  return (
    <main style={{ padding: 24 }}>
      <h1>DB test</h1>
      {error && <pre>{JSON.stringify(error, null, 2)}</pre>}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}